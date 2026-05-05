import { useState } from 'react';
import { useSessions } from '../hooks/useSessions';
import { CreateForm } from './CreateForm';
import { SessionList } from './SessionList';
import { ProfileMenu } from './ProfileMenu';
import { useErrorToast } from './Toast';
import { WorkspaceLink, useWorkspaceNavigate } from './WorkspaceLink';
import type { Profile } from '../hooks/useProfile';

export interface SessionsPageProps {
  profile: Profile;
}

export function SessionsPage({ profile }: SessionsPageProps) {
  const navigate = useWorkspaceNavigate();
  const { sessions, loading, error, refresh } = useSessions();
  useErrorToast(error);
  const [creating, setCreating] = useState<boolean>(false);

  return (
    <div className="page">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-dot" aria-hidden="true" />
            <span>Mahlzeit</span>
          </div>
          <div className="flex items-center gap-3">
            <WorkspaceLink to="/restaurants" className="btn-link">
              Restaurants
            </WorkspaceLink>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className="page-container space-y-6">
        <div>
          <h1 className="h-page">Sammelbestellungen</h1>
          <p className="mt-1 help">Aktive und vergangene Bestellungen in diesem Workspace.</p>
        </div>

        {creating ? (
          <CreateForm
            profile={profile}
            onCreated={(session) => {
              setCreating(false);
              refresh();
              navigate(`/s/${session.id}`);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-4 text-base font-semibold text-white shadow-card transition hover:bg-orange-600 hover:shadow-pop active:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-lg leading-none transition group-hover:bg-white/30"
            >
              +
            </span>
            Neue Sammelbestellung starten
          </button>
        )}

        <SessionList sessions={sessions} loading={loading} />
      </main>
    </div>
  );
}
