import { useState } from 'react';
import { useSessions } from '../hooks/useSessions';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { CreateForm } from './CreateForm';
import { SessionList } from './SessionList';
import { ArchiveSection } from './ArchiveSection';
import { splitArchived } from '../lib/archive';
import { ProfileMenu } from './ProfileMenu';
import { DuePill } from './DuePill';
import { useErrorToast } from './Toast';
import { WorkspaceLink, useWorkspaceNavigate } from './WorkspaceLink';
import { ShareButton } from './ShareButton';
import { getWorkspaceToken } from '../api/client';
import { buildWorkspaceInviteText, buildWorkspaceUrl } from '../lib/share';
import type { Profile } from '../hooks/useProfile';

export interface SessionsPageProps {
  profile: Profile;
}

export function SessionsPage({ profile }: SessionsPageProps) {
  const navigate = useWorkspaceNavigate();
  const { sessions, loading, error, refresh } = useSessions(profile.user_id);
  useErrorToast(error);
  const [creating, setCreating] = useState<boolean>(false);
  // Desktop keeps the create form permanently open in the side column;
  // mobile toggles it inline. Rendered exactly once either way.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { active, archived } = splitArchived(sessions);

  const createForm = (
    <CreateForm
      profile={profile}
      onCreated={(session) => {
        setCreating(false);
        refresh();
        navigate(`/s/${session.id}`);
      }}
      onCancel={isDesktop ? undefined : () => setCreating(false)}
    />
  );

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
            <ShareButton
              label="Link teilen"
              title="Mahlzeit-Workspace"
              getText={() =>
                buildWorkspaceInviteText(
                  buildWorkspaceUrl(getWorkspaceToken() ?? '', window.location.origin),
                )
              }
              className="btn-link text-sm"
            />
            <DuePill sessions={sessions} />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className="page-container">
        <div className="layout-2col">
          <div className="layout-main">
            <div>
              <h1 className="h-page">Sammelbestellungen</h1>
              <p className="mt-1 help">Aktive und vergangene Bestellungen in diesem Workspace.</p>
            </div>

            {!isDesktop ? (
              creating ? (
                createForm
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
              )
            ) : null}

            <SessionList sessions={active} loading={loading} myUserId={profile.user_id} />
            <ArchiveSection sessions={archived} myUserId={profile.user_id} />
          </div>

          {isDesktop ? <aside className="layout-side">{createForm}</aside> : null}
        </div>
      </main>
    </div>
  );
}
