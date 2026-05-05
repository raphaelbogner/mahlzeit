import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getWorkspaceToken } from './api/client';
import { ProfileProvider, useProfile } from './hooks/useProfile';
import { NameSetup } from './components/NameSetup';
import { SessionsPage } from './components/SessionsPage';
import { SessionDetail } from './components/SessionDetail';
import { RestaurantList } from './components/RestaurantList';
import { RestaurantEditor } from './components/RestaurantEditor';
import { ToastProvider } from './components/Toast';

function MissingToken() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md card-pad text-center">
        <span className="brand-dot mx-auto mb-4 block" aria-hidden="true" />
        <h1 className="h-page">Kein Workspace-Link</h1>
        <p className="mt-3 text-sm text-stone-600">
          Diese Seite kann nur über einen geteilten Workspace-Link mit einem{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">?w=…</code>
          -Parameter geöffnet werden. Bitte bei der Person nachfragen, die euch den Link geschickt
          hat.
        </p>
      </div>
    </div>
  );
}

function AppRouter() {
  const { profile, saveProfile, ready } = useProfile();

  if (!ready) return null;

  if (!profile) {
    return <NameSetup onSubmit={(input) => saveProfile(input)} />;
  }

  return (
    <ToastProvider>
      <BrowserRouter basename="/w">
        <Routes>
          <Route path="/" element={<SessionsPage profile={profile} />} />
          <Route path="/s/:id" element={<SessionDetail profile={profile} />} />
          <Route path="/restaurants" element={<RestaurantList />} />
          <Route path="/restaurants/:id" element={<RestaurantEditor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default function App() {
  const token = getWorkspaceToken();
  if (!token) return <MissingToken />;

  return (
    <ProfileProvider>
      <AppRouter />
    </ProfileProvider>
  );
}
