import { useState } from 'react';
import type React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ensureTokenInUrl, getWorkspaceToken } from './api/client';
import { ProfileProvider, useProfile } from './hooks/useProfile';
import type { Profile } from './hooks/useProfile';
import { decodeProfileHash, sameProfile } from './lib/profileTransfer';
import { NameSetup } from './components/NameSetup';
import { SessionsPage } from './components/SessionsPage';
import { SessionDetail } from './components/SessionDetail';
import { RestaurantList } from './components/RestaurantList';
import { RestaurantEditor } from './components/RestaurantEditor';
import { StatsPage } from './components/StatsPage';
import { ImportProfileDialog } from './components/ImportProfileDialog';
import { ToastProvider } from './components/Toast';

// Extract ?w= from a pasted workspace/session link (or accept a bare token).
function tokenFromInput(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return null;
  try {
    const url = new URL(text);
    const w = url.searchParams.get('w');
    return w && w.length > 0 ? w : null;
  } catch {
    return /^[A-Za-z0-9_-]{20,}$/.test(text) ? text : null;
  }
}

function MissingToken() {
  const [link, setLink] = useState<string>('');
  const [invalid, setInvalid] = useState<boolean>(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const token = tokenFromInput(link);
    if (!token) {
      setInvalid(true);
      return;
    }
    window.location.assign(`/w/?w=${encodeURIComponent(token)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md card-pad text-center">
        <img
          src={`${import.meta.env.BASE_URL}icons/icon.svg`}
          alt=""
          className="mx-auto mb-4 h-12 w-12 rounded-xl"
        />
        <h1 className="h-page">Kein Workspace-Link</h1>
        <p className="mt-3 text-sm text-stone-600">
          Diese Seite kann nur über einen geteilten Workspace-Link mit einem{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">?w=…</code>
          -Parameter geöffnet werden. Bitte bei der Person nachfragen, die euch den Link geschickt
          hat.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-2 text-left" noValidate>
          <label htmlFor="ws-link" className="label">
            Workspace-Link einfügen
          </label>
          <input
            id="ws-link"
            type="url"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setInvalid(false);
            }}
            placeholder="https://…/w/?w=…"
            className="input"
            autoComplete="off"
            aria-invalid={invalid ? 'true' : 'false'}
          />
          {invalid ? (
            <p className="field-error" role="alert">
              Darin steckt kein Workspace-Token.
            </p>
          ) : null}
          <button type="submit" className="btn-primary w-full">
            Öffnen
          </button>
        </form>
      </div>
    </div>
  );
}

// A restore link (#profile=…) is consumed exactly once on boot and removed
// from the URL so reloads do not re-trigger the import.
function takeIncomingProfile(): Profile | null {
  const incoming = decodeProfileHash(window.location.hash);
  if (incoming) {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }
  return incoming;
}

function AppRouter() {
  const { profile, saveProfile, importProfile, ready } = useProfile();
  const [incoming, setIncoming] = useState<Profile | null>(takeIncomingProfile);

  if (!ready) return null;

  // No profile yet: adopt the incoming one silently.
  if (!profile && incoming) {
    importProfile(incoming);
    setIncoming(null);
    return null;
  }

  if (!profile) {
    return <NameSetup onSubmit={(input) => saveProfile(input)} />;
  }

  return (
    <ToastProvider>
      {incoming && !sameProfile(incoming, profile) ? (
        <ImportProfileDialog
          current={profile}
          incoming={incoming}
          onReplace={() => {
            importProfile(incoming);
            setIncoming(null);
          }}
          onKeep={() => setIncoming(null)}
        />
      ) : null}
      <BrowserRouter basename="/w">
        <Routes>
          <Route path="/" element={<SessionsPage profile={profile} />} />
          <Route path="/s/:id" element={<SessionDetail profile={profile} />} />
          <Route path="/restaurants" element={<RestaurantList />} />
          <Route path="/restaurants/:id" element={<RestaurantEditor />} />
          <Route path="/statistik" element={<StatsPage profile={profile} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default function App() {
  // Installed PWA starts at /w/ without ?w=; restore the remembered token
  // into the URL before anything reads it.
  ensureTokenInUrl();
  const token = getWorkspaceToken();
  if (!token) return <MissingToken />;

  return (
    <ProfileProvider>
      <AppRouter />
    </ProfileProvider>
  );
}
