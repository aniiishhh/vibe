import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCurrentUser, signOut as amplifySignOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { useQueryClient } from '@tanstack/react-query';

export interface SignedInUser {
  id: string;
  username: string;
}

export interface AuthContextValue {
  user: SignedInUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Present only in the local mock preview, where Cognito is not used. */
  mockSignIn?: (email: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();
  const lastUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      const next = { id: current.userId, username: current.username };
      if (lastUserId.current && lastUserId.current !== next.id) queryClient.clear();
      lastUserId.current = next.id;
      setUser(next);
    } catch {
      if (lastUserId.current) queryClient.clear();
      lastUserId.current = null;
      setUser(null);
    } finally {
      setReady(true);
    }
  }, [queryClient]);

  useEffect(() => {
    void refresh();
    const cancel = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut') {
        queryClient.clear();
        lastUserId.current = null;
        setUser(null);
        setReady(true);
      } else if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        void refresh();
      }
    });
    return cancel;
  }, [queryClient, refresh]);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    queryClient.clear();
    lastUserId.current = null;
    setUser(null);
    setReady(true);
  }, [queryClient]);

  const value = useMemo(() => ({ user, ready, refresh, signOut }), [user, ready, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
