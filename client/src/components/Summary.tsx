import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { aggregateItems, renderSummaryText } from '../lib/aggregate';
import type { AggregateOption } from '../lib/aggregate';
import { fmtPrice, parsePrice } from '../lib/price';
import { cleanIban, formatIban, isValidIban } from '../lib/iban';
import type { Session } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { ApiError, getWorkspaceToken } from '../api/client';
import { updateSession } from '../api/sessions';
import { markPersonPaid, reportOwnPayment } from '../api/items';
import { buildPaymentText, buildSessionUrl, copyText } from '../lib/share';
import { useToast } from './Toast';
import { PaymentQr } from './PaymentQr';
import { ShareButton } from './ShareButton';

export interface SummaryProps {
  session: Session;
  profile: Profile;
  onSessionChanged: (session: Session) => void;
}

function OptionList({ options }: { options: AggregateOption[] }) {
  if (options.length === 0) return null;
  const byGroup = new Map<string, string[]>();
  for (const o of options) {
    const arr = byGroup.get(o.group);
    if (arr) arr.push(o.name);
    else byGroup.set(o.group, [o.name]);
  }
  const parts: string[] = [];
  for (const [group, names] of byGroup) {
    parts.push(`${group}: ${names.join(', ')}`);
  }
  return <p className="text-xs text-stone-600">{parts.join(' · ')}</p>;
}

function buildRemittance(restaurantName: string, payerName: string): string {
  const r = restaurantName.trim();
  const p = payerName.trim();
  if (r && p) return `${r}, ${p}`;
  return r || p;
}

interface KnownUser {
  user_id: string;
  user_name: string;
}

// Build the list of distinct users in this session: creator + everyone who
// has added an item. Dedup by user_id (two people may share the same name).
function collectUsers(session: Session): KnownUser[] {
  const map = new Map<string, KnownUser>();
  map.set(session.creator_id, {
    user_id: session.creator_id,
    user_name: session.creator_name,
  });
  for (const item of session.items) {
    if (!map.has(item.user_id)) {
      map.set(item.user_id, { user_id: item.user_id, user_name: item.user_name });
    }
  }
  return Array.from(map.values());
}

export function Summary({ session, profile, onSessionChanged }: SummaryProps) {
  const { showError, showInfo } = useToast();
  const [copied, setCopied] = useState<boolean>(false);

  const aggregate = useMemo(
    () => aggregateItems(session.items, session.discount_cents),
    [session.items, session.discount_cents],
  );

  const text = useMemo(
    () =>
      renderSummaryText({
        session_title: session.title,
        restaurant_name: session.restaurant_name,
        creator_name: session.creator_name,
        creator_iban: session.creator_iban,
        discount_label: session.discount_label,
        aggregate,
      }),
    [
      session.title,
      session.restaurant_name,
      session.creator_name,
      session.creator_iban,
      session.discount_label,
      aggregate,
    ],
  );

  const isCreator = profile.user_id === session.creator_id;
  const isClosed = session.status === 'closed';
  const hasDiscount = aggregate.discount_cents > 0;
  const effectivePayerId = session.paid_by_user_id ?? session.creator_id;
  const effectivePayerName =
    session.paid_by_user_id === null ? session.creator_name : session.paid_by_user_name;
  const effectivePayerIban =
    session.paid_by_user_id === null ? session.creator_iban : session.paid_by_iban;
  const isMarkedPayer =
    session.paid_by_user_id !== null && profile.user_id === session.paid_by_user_id;

  const knownUsers = useMemo(() => collectUsers(session), [session]);

  // Current viewer's own outstanding amount: their unpaid priced items minus
  // their proportional share of the discount. Used to populate the SEPA QR
  // with the exact transfer sum.
  const myAmountCents = useMemo(() => {
    let unpaidGross = 0;
    for (const item of session.items) {
      if (item.user_id === profile.user_id && item.price_cents !== null && item.paid_at === null) {
        unpaidGross += item.price_cents * item.quantity;
      }
    }
    const myShare = aggregate.per_person.find((p) => p.user_name === profile.user_name);
    return Math.max(0, unpaidGross - (myShare?.discount_cents ?? 0));
  }, [session.items, profile.user_id, profile.user_name, aggregate]);

  const isViewerPayer = profile.user_id === effectivePayerId;

  // Payment position per displayed person (keyed like per_person, by name).
  const payByName = useMemo(() => {
    const map = new Map<
      string,
      { user_id: string; gross: number; unpaid: number; reported: number }
    >();
    for (const item of session.items) {
      if (item.price_cents === null) continue;
      const line = item.price_cents * item.quantity;
      const entry = map.get(item.user_name) ?? {
        user_id: item.user_id,
        gross: 0,
        unpaid: 0,
        reported: 0,
      };
      entry.gross += line;
      if (item.paid_at === null) {
        entry.unpaid += line;
        if (item.payment_reported_at !== null) entry.reported += line;
      }
      map.set(item.user_name, entry);
    }
    return map;
  }, [session.items]);
  const [payBusy, setPayBusy] = useState<boolean>(false);

  async function handleMarkPerson(targetUserId: string, paid: boolean): Promise<void> {
    setPayBusy(true);
    try {
      const items = await markPersonPaid(session.id, {
        user_id: profile.user_id,
        target_user_id: targetUserId,
        paid,
      });
      onSessionChanged({ ...session, items });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setPayBusy(false);
    }
  }

  async function handleReportOwn(reported: boolean): Promise<void> {
    setPayBusy(true);
    try {
      const items = await reportOwnPayment(session.id, { user_id: profile.user_id, reported });
      onSessionChanged({ ...session, items });
      showInfo(reported ? 'Überweisung gemeldet.' : 'Meldung zurückgenommen.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setPayBusy(false);
    }
  }

  async function handleCopy(): Promise<void> {
    const ok = await copyText(text, navigator, document);
    if (!ok) {
      showError('Kopieren fehlgeschlagen.');
      return;
    }
    setCopied(true);
    showInfo('Zusammenfassung kopiert.');
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handlePayerChange(newPayerId: string): Promise<void> {
    try {
      let updated;
      if (newPayerId === session.creator_id) {
        // "Ersteller (default)" — clear the paid_by override.
        updated = await updateSession(session.id, {
          user_id: profile.user_id,
          paid_by_user_id: null,
        });
      } else {
        const picked = knownUsers.find((u) => u.user_id === newPayerId);
        if (!picked) return;
        updated = await updateSession(session.id, {
          user_id: profile.user_id,
          paid_by_user_id: picked.user_id,
          paid_by_user_name: picked.user_name,
        });
      }
      onSessionChanged({ ...updated, items: session.items });
      showInfo('Bezahler:in aktualisiert.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.');
    }
  }

  if (session.items.length === 0) {
    return null;
  }

  return (
    <section className="card-pad">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h-section">Zusammenfassung</h2>
        <div className="flex items-center gap-2">
          {isClosed ? (
            <ShareButton
              label="Teilen"
              title={`Zahlungsübersicht: ${session.title}`}
              getText={() =>
                buildPaymentText(
                  text,
                  buildSessionUrl(session.id, getWorkspaceToken() ?? '', window.location.origin),
                )
              }
            />
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary btn-sm"
            aria-label="Zusammenfassung als Text kopieren"
          >
            {copied ? 'Kopiert ✓' : 'Text kopieren'}
          </button>
        </div>
      </div>

      <div className="mb-5">
        <h3 className="h-card mb-2">Bestellungen</h3>
        <ul className="space-y-2">
          {aggregate.lines.map((line, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="text-stone-500">{line.count}× </span>
                  <span className="font-medium text-stone-900">{line.dish}</span>
                </p>
                <OptionList options={line.options} />
                {line.notes.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5">
                    {line.notes.map((n, i) => (
                      <li key={i} className="text-xs text-stone-700">
                        <span className="text-stone-500">Anmerkung ({n.user_name}):</span>{' '}
                        {n.note}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="help-xs">{line.users.join(', ')}</p>
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">
                {line.total_cents === null ? (
                  <span className="text-stone-500">kein Preis</span>
                ) : (
                  <>
                    {line.unit_price_cents !== null && line.count > 1 && (
                      <p className="help-xs">{fmtPrice(line.unit_price_cents)} / Stk</p>
                    )}
                    <p className="font-medium text-stone-900">{fmtPrice(line.total_cents)}</p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <h3 className="h-card mb-2">Pro Person</h3>
        <ul className="space-y-1.5">
          {aggregate.per_person.map((p) => {
            const pay = payByName.get(p.user_name);
            const isMe = pay?.user_id === profile.user_id;
            const settled = pay !== undefined && pay.gross > 0 && pay.unpaid === 0;
            const reported = pay !== undefined && pay.unpaid > 0 && pay.reported > 0;
            const showPayerControls =
              isClosed && isViewerPayer && pay !== undefined && pay.gross > 0 && !isMe;
            return (
              <li key={p.user_name} className="text-sm tabular-nums">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {showPayerControls ? (
                      <input
                        type="checkbox"
                        checked={settled}
                        disabled={payBusy}
                        onChange={() => void handleMarkPerson(pay.user_id, !settled)}
                        className="h-4 w-4 cursor-pointer rounded border-stone-300 accent-orange-500"
                        aria-label={`${p.user_name} als ${settled ? 'unbezahlt' : 'bezahlt'} markieren`}
                        title={settled ? 'Als unbezahlt markieren' : 'Alle Einträge als bezahlt markieren'}
                      />
                    ) : null}
                    <span className="truncate">{p.user_name}</span>
                    {p.has_unpriced_items && (
                      <span className="text-xs text-stone-500">(+ Einträge ohne Preis)</span>
                    )}
                    {isClosed && settled ? <span className="badge-success">bezahlt</span> : null}
                    {isClosed && !settled && reported ? (
                      <span className="badge-info" title="Überweisung gemeldet, wartet auf Bestätigung">
                        gemeldet
                      </span>
                    ) : null}
                  </span>
                  {hasDiscount && p.discount_cents > 0 ? (
                    <span className="shrink-0">
                      <span className="mr-1.5 text-stone-400 line-through">
                        {fmtPrice(p.total_cents)}
                      </span>
                      <span className="font-medium text-stone-900">{fmtPrice(p.net_cents)}</span>
                    </span>
                  ) : (
                    <span className="shrink-0 font-medium text-stone-900">
                      {fmtPrice(p.total_cents)}
                    </span>
                  )}
                </div>
                {isClosed && isMe && !isViewerPayer && pay !== undefined && pay.gross > 0 && !settled ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {reported ? (
                      <>
                        <span className="text-xs text-amber-700">
                          Überweisung gemeldet – wartet auf Bestätigung.
                        </span>
                        <button
                          type="button"
                          disabled={payBusy}
                          onClick={() => void handleReportOwn(false)}
                          className="btn-link text-xs"
                        >
                          Zurücknehmen
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={payBusy}
                        onClick={() => void handleReportOwn(true)}
                        className="btn-secondary btn-sm"
                      >
                        Ich habe überwiesen
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-stone-200 pt-3 tabular-nums">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-stone-700">
            {hasDiscount ? 'Zwischensumme' : 'Gesamt'}
          </span>
          <span
            className={
              hasDiscount
                ? 'text-sm text-stone-500'
                : 'text-lg font-semibold text-stone-900'
            }
          >
            {fmtPrice(aggregate.grand_total_cents)}
          </span>
        </div>
        {hasDiscount && (
          <>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="text-emerald-700">
                Rabatt
                {session.discount_label.trim() !== '' && (
                  <span className="text-stone-500"> · {session.discount_label}</span>
                )}
              </span>
              <span className="text-emerald-700">−{fmtPrice(aggregate.discount_cents)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-medium text-stone-700">Zu zahlen</span>
              <span className="text-lg font-semibold text-stone-900">
                {fmtPrice(aggregate.net_total_cents)}
              </span>
            </div>
          </>
        )}
      </div>

      {isClosed && isViewerPayer && aggregate.has_any_price ? (
        <DiscountEditor
          session={session}
          profile={profile}
          onSaved={(updated) => onSessionChanged({ ...updated, items: session.items })}
        />
      ) : null}

      {isCreator ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4">
          <label htmlFor="payer-select" className="text-sm text-stone-700">
            Wer hat bezahlt?
          </label>
          <select
            id="payer-select"
            value={effectivePayerId}
            onChange={(e) => void handlePayerChange(e.target.value)}
            className="block rounded-lg bg-white px-2.5 py-1 text-sm text-stone-900 shadow-sm ring-1 ring-stone-300 transition focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {knownUsers.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.user_id === session.creator_id
                  ? `${u.user_name} (Ersteller:in)`
                  : u.user_name}
              </option>
            ))}
          </select>
          <span className="help-xs">
            Standard: Ersteller:in. Andere Wahl überschreibt die IBAN unten.
          </span>
        </div>
      ) : null}

      {isMarkedPayer && session.paid_by_iban === '' ? (
        <PayerIbanForm
          sessionId={session.id}
          profile={profile}
          field="paid_by_iban"
          onSaved={(updated) => onSessionChanged({ ...updated, items: session.items })}
        />
      ) : null}

      {isCreator &&
      session.paid_by_user_id === null &&
      session.creator_iban === '' &&
      aggregate.has_any_price ? (
        <PayerIbanForm
          sessionId={session.id}
          profile={profile}
          field="creator_iban"
          onSaved={(updated) => onSessionChanged({ ...updated, items: session.items })}
        />
      ) : null}

      {isClosed && effectivePayerIban !== '' && aggregate.has_any_price ? (
        <div className="mt-5 alert-info">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">Bitte überweisen an:</p>
              <p>{effectivePayerName}</p>
              <p className="font-mono text-xs">IBAN: {formatIban(effectivePayerIban)}</p>
              {!isViewerPayer && myAmountCents > 0 && (
                <p className="mt-2 text-sm">
                  Dein Anteil:{' '}
                  <span className="font-semibold tabular-nums">{fmtPrice(myAmountCents)}</span>
                </p>
              )}
              {!isViewerPayer && myAmountCents > 0 && (
                <p className="help-xs mt-1">
                  Scanne den QR-Code mit deiner Banking-App, um die Überweisung vorauszufüllen.
                </p>
              )}
            </div>
            {!isViewerPayer && myAmountCents > 0 && (
              <div className="shrink-0">
                <PaymentQr
                  beneficiaryName={effectivePayerName}
                  iban={effectivePayerIban}
                  amountCents={myAmountCents}
                  remittance={buildRemittance(session.restaurant_name, profile.user_name)}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isClosed &&
      session.paid_by_user_id !== null &&
      session.paid_by_iban === '' &&
      !isMarkedPayer &&
      aggregate.has_any_price ? (
        <div className="mt-5 alert-info">
          <p className="font-semibold">Bezahlt von {effectivePayerName}.</p>
          <p className="text-xs">
            Noch keine IBAN hinterlegt — {effectivePayerName} kann sie selbst eintragen, sobald
            sie/er hier vorbeischaut.
          </p>
        </div>
      ) : null}
    </section>
  );
}

interface DiscountEditorProps {
  session: Session;
  profile: Profile;
  onSaved: (session: Session) => void;
}

// Lets the effective payer apply a discount to the closed order (e.g. a free
// item from a loyalty card). The amount is split proportionally across all
// orderers by aggregateItems().
function DiscountEditor({ session, profile, onSaved }: DiscountEditorProps) {
  const hasDiscount = session.discount_cents > 0;
  const [open, setOpen] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>(
    hasDiscount ? fmtPrice(session.discount_cents) : '',
  );
  const [label, setLabel] = useState<string>(session.discount_label);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const { showError, showInfo } = useToast();

  async function save(cents: number, discountLabel: string): Promise<void> {
    setBusy(true);
    try {
      const updated = await updateSession(session.id, {
        user_id: profile.user_id,
        discount_cents: cents,
        discount_label: discountLabel,
      });
      onSaved(updated);
      setOpen(false);
      showInfo(cents > 0 ? 'Rabatt gespeichert.' : 'Rabatt entfernt.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const cents = parsePrice(amount);
    if (cents === null || cents <= 0) {
      setError('Bitte einen gültigen Betrag eingeben.');
      return;
    }
    setError(null);
    await save(cents, label.trim());
  }

  if (!open && !hasDiscount) {
    return (
      <div className="mt-5 border-t border-stone-200 pt-4">
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
          Rabatt hinzufügen
        </button>
        <p className="help-xs mt-1">
          z.B. ein Gratis-Gericht von der Stempelkarte — wird anteilig auf alle aufgeteilt.
        </p>
      </div>
    );
  }

  if (!open && hasDiscount) {
    return (
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4">
        <span className="text-sm text-stone-700">
          Rabatt aktiv: <span className="font-medium">−{fmtPrice(session.discount_cents)}</span>
          {session.discount_label.trim() !== '' && (
            <span className="text-stone-500"> · {session.discount_label}</span>
          )}
        </span>
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
          Ändern
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(0, '')}
          className="btn-secondary btn-sm"
        >
          Entfernen
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 alert-info" noValidate>
      <p className="font-semibold">Rabatt aufteilen</p>
      <p className="mt-1 text-xs">
        Der Betrag wird anteilig zum Bestellwert von allen abgezogen.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="z.B. 6,00"
          className="input-mono w-28"
          aria-label="Rabattbetrag"
          aria-invalid={error ? 'true' : 'false'}
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Grund (optional), z.B. Gratis-Dürüm"
          maxLength={120}
          className="input flex-1 min-w-0"
          aria-label="Rabattgrund"
        />
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? 'Speichert…' : 'Speichern'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="btn-secondary btn-sm"
        >
          Abbrechen
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

interface PayerIbanFormProps {
  sessionId: string;
  profile: Profile;
  field: 'paid_by_iban' | 'creator_iban';
  onSaved: (session: Session) => void;
}

function PayerIbanForm({ sessionId, profile, field, onSaved }: PayerIbanFormProps) {
  const [iban, setIban] = useState<string>(profile.iban ? formatIban(profile.iban) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const { showError, showInfo } = useToast();

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const cleaned = cleanIban(iban);
    if (cleaned !== '' && !isValidIban(cleaned)) {
      setError('Diese IBAN ist ungültig.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const updated = await updateSession(sessionId, {
        user_id: profile.user_id,
        [field]: cleaned,
      });
      onSaved(updated);
      showInfo('IBAN gespeichert.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const headline =
    field === 'creator_iban'
      ? 'IBAN fehlt noch.'
      : 'Du wurdest als Bezahler:in markiert.';

  return (
    <form onSubmit={handleSubmit} className="mt-5 alert-info" noValidate>
      <p className="font-semibold">{headline}</p>
      <p className="mt-1 text-xs">
        Trag deine IBAN ein, damit die anderen wissen, wohin überwiesen werden soll.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          onBlur={(e) => setIban(formatIban(e.target.value))}
          placeholder="AT61 1904 3002 3457 3201"
          maxLength={42}
          autoComplete="off"
          spellCheck={false}
          className="input-mono flex-1 min-w-0"
          aria-invalid={error ? 'true' : 'false'}
        />
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
