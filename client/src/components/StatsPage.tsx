import { useState } from 'react';
import { useStats } from '../hooks/useStats';
import { fmtPrice } from '../lib/price';
import { STATS_RANGES, barWidth, maxOf } from '../lib/stats';
import type { StatsRange } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { DuePill } from './DuePill';
import { ProfileMenu } from './ProfileMenu';
import { useErrorToast } from './Toast';
import { WorkspaceLink } from './WorkspaceLink';

export interface StatsPageProps {
  profile: Profile;
}

interface BarRow {
  label: string;
  value: number;
  display: string;
  sub?: string;
}

function BarList({ title, rows, empty }: { title: string; rows: BarRow[]; empty: string }) {
  const max = maxOf(rows, (r) => r.value);
  return (
    <section className="card-pad">
      <h3 className="h-card mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="help-xs">{empty}</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-1.5 text-xs text-stone-400 tabular-nums">{i + 1}.</span>
                  <span className="font-medium text-stone-900">{r.label}</span>
                  {r.sub ? <span className="ml-1.5 text-xs text-stone-500">{r.sub}</span> : null}
                </span>
                <span className="shrink-0 font-semibold text-stone-800 tabular-nums">{r.display}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-orange-400"
                  style={{ width: `${barWidth(r.value, max)}%` }}
                  aria-hidden="true"
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-stone-900 tabular-nums">{value}</p>
    </div>
  );
}

export function StatsPage({ profile }: StatsPageProps) {
  const [range, setRange] = useState<StatsRange>('30d');
  const { stats, loading, error } = useStats(range, profile.user_id);
  useErrorToast(error);

  return (
    <div className="page">
      <header className="app-header">
        <div className="app-header-inner">
          <WorkspaceLink to="/" className="btn-link">
            ← Sammelbestellungen
          </WorkspaceLink>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <DuePill />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className="page-container space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="h-page">Statistik</h1>
            <p className="mt-1 help">Geschlossene Bestellungen in diesem Workspace, Archiv inklusive.</p>
          </div>
          <div className="inline-flex rounded-lg ring-1 ring-stone-300" role="group" aria-label="Zeitraum">
            {STATS_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                aria-pressed={range === r.value}
                className={
                  'px-3 py-1.5 text-sm transition first:rounded-l-lg last:rounded-r-lg ' +
                  (range === r.value ? 'bg-stone-800 text-white' : 'bg-white text-stone-700 hover:bg-stone-50')
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !stats ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200/70" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Bestellungen" value={String(stats.totals.sessions)} />
              <Kpi label="Gerichte" value={String(stats.totals.items)} />
              <Kpi label="Ausgaben" value={fmtPrice(stats.totals.spend_cents)} />
              <Kpi label="Rabatte gespart" value={fmtPrice(stats.totals.discount_cents)} />
            </div>

            {stats.my_top_dishes.length > 0 ? (
              <section className="card-pad ring-orange-200">
                <h3 className="h-card mb-2">Deine Top 5</h3>
                <ol className="flex flex-wrap gap-2">
                  {stats.my_top_dishes.map((d) => (
                    <li key={d.dish} className="badge-info">
                      {d.count}× {d.dish}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <BarList
                title="Top-Gerichte"
                empty="Noch keine Gerichte im Zeitraum."
                rows={stats.top_dishes.map((d) => ({
                  label: d.dish,
                  value: d.count,
                  display: `${d.count}×`,
                  sub: fmtPrice(d.spend_cents),
                }))}
              />
              <BarList
                title="Restaurants · Ausgaben"
                empty="Noch keine Bestellungen im Zeitraum."
                rows={stats.restaurants.map((r) => ({
                  label: r.restaurant_name,
                  value: r.spend_cents,
                  display: fmtPrice(r.spend_cents),
                  sub: `${r.sessions} ${r.sessions === 1 ? 'Bestellung' : 'Bestellungen'}`,
                }))}
              />
              <BarList
                title="Wer zahlt am öftesten"
                empty="Noch niemand."
                rows={stats.payers.map((p) => ({
                  label: p.user_name,
                  value: p.sessions_paid,
                  display: `${p.sessions_paid}×`,
                  sub: `${fmtPrice(p.received_cents)} vorgestreckt`,
                }))}
              />
              <BarList
                title="Ausgaben pro Person"
                empty="Noch niemand."
                rows={stats.persons.map((p) => ({
                  label: p.user_name,
                  value: p.spend_cents,
                  display: fmtPrice(p.spend_cents),
                  sub: `${p.items} ${p.items === 1 ? 'Gericht' : 'Gerichte'}`,
                }))}
              />
            </div>
          </>
        ) : (
          <p className="empty">Statistik konnte nicht geladen werden.</p>
        )}
      </main>
    </div>
  );
}
