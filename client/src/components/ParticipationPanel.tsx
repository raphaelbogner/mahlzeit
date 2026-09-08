import { useParticipation } from '../hooks/useParticipation';
import { buildReminderText } from '../lib/share';
import type { Session } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { ShareButton } from './ShareButton';

export interface ParticipationPanelProps {
  session: Session;
  profile: Profile;
  // Session URL for the reminder text.
  sessionUrl: string;
}

// "Fehlt noch (3): Anna, Bob, Cem · Abgesagt (1): Dora" — for the creator and
// the payer of an open session, with a one-tap reminder share.
export function ParticipationPanel({ session, profile, sessionUrl }: ParticipationPanelProps) {
  const data = useParticipation(session.id, profile.user_id, session.status === 'open');
  if (!data) return null;

  const orderedSet = new Set(data.ordered);
  const declinedSet = new Set(data.declined.map((d) => d.user_id));
  const missing = data.known.filter(
    (u) => !orderedSet.has(u.user_id) && !declinedSet.has(u.user_id),
  );
  const missingNames = missing.map((u) => u.user_name);
  const declinedNames = data.declined.map((u) => u.user_name);

  if (missing.length === 0 && declinedNames.length === 0) {
    return <p className="mt-2 text-xs text-emerald-700">Alle Bekannten haben bestellt.</p>;
  }

  return (
    <div className="mt-2 space-y-1 text-xs">
      {missing.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-stone-700">
            <span className="font-medium">Fehlt noch ({missing.length}):</span>{' '}
            {missingNames.join(', ')}
          </span>
          <ShareButton
            label="Erinnern"
            title={`Erinnerung: ${session.title}`}
            getText={() =>
              buildReminderText({
                names: missingNames,
                title: session.title,
                deadline_at: session.deadline_at,
                url: sessionUrl,
              })
            }
            className="btn-link text-xs"
          />
        </div>
      ) : null}
      {declinedNames.length > 0 ? (
        <p className="text-stone-500">
          <span className="font-medium">Abgesagt ({declinedNames.length}):</span>{' '}
          {declinedNames.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
