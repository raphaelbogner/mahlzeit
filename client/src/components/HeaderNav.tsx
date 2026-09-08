import { useEffect, useRef, useState } from 'react';
import { getWorkspaceToken } from '../api/client';
import { buildWorkspaceInviteText, buildWorkspaceUrl } from '../lib/share';
import { ShareButton } from './ShareButton';
import { WorkspaceLink } from './WorkspaceLink';

// Start-page navigation. Desktop: plain text links. Mobile: one "⋯" menu so
// the header stays a single tidy row next to the due pill and profile.
export function HeaderNav() {
  const [open, setOpen] = useState<boolean>(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shareText = (): string =>
    buildWorkspaceInviteText(buildWorkspaceUrl(getWorkspaceToken() ?? '', window.location.origin));

  return (
    <>
      <nav className="hidden items-center gap-4 sm:flex" aria-label="Bereiche">
        <WorkspaceLink to="/restaurants" className="btn-link">
          Restaurants
        </WorkspaceLink>
        <WorkspaceLink to="/statistik" className="btn-link">
          Statistik
        </WorkspaceLink>
        <ShareButton
          label="Workspace teilen"
          title="Mahlzeit-Workspace"
          getText={shareText}
          className="btn-link text-sm"
        />
      </nav>

      <div ref={wrapRef} className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Menü"
          className="grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-stone-700 transition hover:bg-stone-100"
        >
          ⋯
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-56 rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-stone-200"
          >
            <WorkspaceLink
              to="/restaurants"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-stone-800 hover:bg-stone-50"
            >
              Restaurants
            </WorkspaceLink>
            <WorkspaceLink
              to="/statistik"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-stone-800 hover:bg-stone-50"
            >
              Statistik
            </WorkspaceLink>
            <ShareButton
              label="Workspace teilen"
              title="Mahlzeit-Workspace"
              getText={shareText}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-50"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
