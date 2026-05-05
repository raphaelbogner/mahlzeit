import { useSessions } from '../hooks/useSessions';
import { CreateForm } from './CreateForm';
import { SessionList } from './SessionList';
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

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Sammelbestellungen</h1>
        <div className="flex items-baseline gap-3">
          <WorkspaceLink to="/restaurants" className="text-xs text-blue-600 hover:underline">
            Restaurants verwalten
          </WorkspaceLink>
          <p className="text-xs text-gray-500">{profile.user_name}</p>
        </div>
      </header>

      <div className="mb-6">
        <SessionList sessions={sessions} loading={loading} />
      </div>

      <CreateForm
        profile={profile}
        onCreated={(session) => {
          refresh();
          navigate(`/s/${session.id}`);
        }}
      />
    </div>
  );
}
