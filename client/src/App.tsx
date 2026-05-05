import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getWorkspaceToken } from './api/client';
import { useProfile } from './hooks/useProfile';
import { NameSetup } from './components/NameSetup';
import { SessionsPage } from './components/SessionsPage';
import { SessionDetail } from './components/SessionDetail';
import { RestaurantList } from './components/RestaurantList';
import { RestaurantEditor } from './components/RestaurantEditor';
import { ToastProvider } from './components/Toast';

function MissingToken() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Kein Workspace-Link</h1>
      <p className="text-sm text-gray-700">
        Diese Seite kann nur über einen geteilten Workspace-Link mit einem{' '}
        <code>?w=…</code>-Parameter geöffnet werden. Bitte bei der Person nachfragen,
        die euch den Link geschickt hat.
      </p>
    </div>
  );
}

export default function App() {
  const token = getWorkspaceToken();
  const { profile, saveProfile, ready } = useProfile();

  if (!token) return <MissingToken />;
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
