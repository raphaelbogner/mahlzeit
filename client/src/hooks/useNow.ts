import { useEffect, useState } from 'react';

// Re-renders on a fixed interval so countdowns stay current. Pass 0 to
// disable ticking (e.g. when there is no deadline to show).
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
