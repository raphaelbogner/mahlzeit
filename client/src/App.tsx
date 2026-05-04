import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getWorkspaceToken } from './api/client';
import { useProfile } from './hooks/useProfile';
import { NameSetup } from './components/NameSetup';

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

function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">
        Diese Ansicht wird in der nächsten Phase implementiert.
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
    <BrowserRouter basename="/w">
      <Routes>
        <Route path="/" element={<Placeholder title="Sammelbestellungen" />} />
        <Route path="/s/:id" element={<Placeholder title="Bestellung" />} />
        <Route path="/restaurants" element={<Placeholder title="Restaurants" />} />
        <Route
          path="/restaurants/:id"
          element={<Placeholder title="Restaurant bearbeiten" />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
