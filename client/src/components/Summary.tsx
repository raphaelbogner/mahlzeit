import { useMemo, useState } from 'react';
import { aggregateItems, renderSummaryText } from '../lib/aggregate';
import type { AggregateOption } from '../lib/aggregate';
import { fmtPrice } from '../lib/price';
import { formatIban } from '../lib/iban';
import type { Session } from '../types/api';
import { useToast } from './Toast';

export interface SummaryProps {
  session: Session;
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

export function Summary({ session }: SummaryProps) {
  const { showError, showInfo } = useToast();
  const [copied, setCopied] = useState<boolean>(false);

  const aggregate = useMemo(() => aggregateItems(session.items), [session.items]);

  const text = useMemo(
    () =>
      renderSummaryText({
        session_title: session.title,
        restaurant_name: session.restaurant_name,
        creator_name: session.creator_name,
        creator_iban: session.creator_iban,
        aggregate,
      }),
    [session.title, session.restaurant_name, session.creator_name, session.creator_iban, aggregate],
  );

  const showIban =
    aggregate.has_any_price && session.creator_iban.length > 0;

  async function handleCopy(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand failed');
      }
      setCopied(true);
      showInfo('Zusammenfassung kopiert.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showError('Kopieren fehlgeschlagen.');
    }
  }

  if (session.items.length === 0) {
    return null;
  }

  return (
    <section className="card-pad">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="h-section">Zusammenfassung</h2>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary btn-sm"
          aria-label="Zusammenfassung als Text kopieren"
        >
          {copied ? 'Kopiert ✓' : 'Text kopieren'}
        </button>
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
        <ul className="space-y-1">
          {aggregate.per_person.map((p) => (
            <li
              key={p.user_name}
              className="flex items-baseline justify-between gap-3 text-sm tabular-nums"
            >
              <span>
                {p.user_name}
                {p.has_unpriced_items && (
                  <span className="ml-1 text-xs text-stone-500">(+ Einträge ohne Preis)</span>
                )}
              </span>
              <span className="font-medium text-stone-900">{fmtPrice(p.total_cents)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-baseline justify-between border-t border-stone-200 pt-3 tabular-nums">
        <span className="text-sm font-medium text-stone-700">Gesamt</span>
        <span className="text-lg font-semibold text-stone-900">
          {fmtPrice(aggregate.grand_total_cents)}
        </span>
      </div>

      {showIban && (
        <div className="mt-5 alert-info">
          <p className="font-semibold">Bitte überweisen an:</p>
          <p>{session.creator_name}</p>
          <p className="font-mono text-xs">IBAN: {formatIban(session.creator_iban)}</p>
        </div>
      )}
    </section>
  );
}
