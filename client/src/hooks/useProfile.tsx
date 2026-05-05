import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { generateId } from '../lib/ids';

const STORAGE_KEY = 'mahlzeit.profile.v1';

export interface Profile {
  user_id: string;
  user_name: string;
  iban: string;
}

interface StoredProfile {
  user_id?: unknown;
  user_name?: unknown;
  iban?: unknown;
}

function readStorage(): Profile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProfile;
    if (
      typeof parsed.user_id !== 'string' ||
      typeof parsed.user_name !== 'string' ||
      typeof parsed.iban !== 'string'
    ) {
      return null;
    }
    if (parsed.user_id.length === 0 || parsed.user_name.length === 0) return null;
    return {
      user_id: parsed.user_id,
      user_name: parsed.user_name,
      iban: parsed.iban,
    };
  } catch {
    return null;
  }
}

function writeStorage(profile: Profile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota / private-mode failures
  }
}

function clearStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface UseProfileResult {
  profile: Profile | null;
  saveProfile: (input: { user_name: string; iban: string }) => Profile;
  updateProfile: (patch: Partial<Pick<Profile, 'user_name' | 'iban'>>) => void;
  clearProfile: () => void;
  ready: boolean;
}

const ProfileContext = createContext<UseProfileResult | null>(null);

function useProfileImpl(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    setProfile(readStorage());
    setReady(true);
  }, []);

  const saveProfile = useCallback(
    (input: { user_name: string; iban: string }): Profile => {
      const next: Profile = {
        user_id: profile?.user_id ?? generateId(),
        user_name: input.user_name.trim(),
        iban: input.iban.trim(),
      };
      writeStorage(next);
      setProfile(next);
      return next;
    },
    [profile?.user_id],
  );

  const updateProfile = useCallback(
    (patch: Partial<Pick<Profile, 'user_name' | 'iban'>>): void => {
      setProfile((current) => {
        if (!current) return current;
        const next: Profile = {
          ...current,
          ...(patch.user_name !== undefined ? { user_name: patch.user_name.trim() } : {}),
          ...(patch.iban !== undefined ? { iban: patch.iban.trim() } : {}),
        };
        writeStorage(next);
        return next;
      });
    },
    [],
  );

  const clearProfile = useCallback((): void => {
    clearStorage();
    setProfile(null);
  }, []);

  return useMemo(
    () => ({ profile, saveProfile, updateProfile, clearProfile, ready }),
    [profile, saveProfile, updateProfile, clearProfile, ready],
  );
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const value = useProfileImpl();
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): UseProfileResult {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
