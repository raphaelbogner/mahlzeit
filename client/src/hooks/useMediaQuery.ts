import { useEffect, useState } from 'react';

// Tracks a CSS media query so layout decisions that must not render twice
// (e.g. a form that is inline on mobile and in a sidebar on desktop) can pick
// exactly one place. Falls back to `false` where matchMedia is unavailable.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent): void => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Tailwind `lg` breakpoint.
export const DESKTOP_QUERY = '(min-width: 1024px)';
