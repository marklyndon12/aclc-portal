import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearStoredAuth,
  getStoredToken,
  getStoredUserRaw,
  TOKEN_KEY,
  USER_KEY,
} from "../lib/api";
import type { LoginResponse, SessionUser, SignupPayload } from "../types";

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  sessionExpired: boolean;
  login: (
    username: string,
    password: string,
    remember?: boolean
  ) => Promise<SessionUser>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  expireSession: () => void;
  updateUser: (user: SessionUser) => void;
  dismissSessionExpired: () => void;
}

interface AuthState {
  token: string | null;
  user: SessionUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): SessionUser | null {
  try {
    const raw = getStoredUserRaw();
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function readInitialState(): AuthState {
  const user = readStoredUser();
  const token = getStoredToken();
  if (user && token) {
    return { token, user };
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readInitialState);
  const [sessionExpired, setSessionExpired] = useState(false);

  const persist = useCallback(
    (token: string | null, user: SessionUser | null, remember = true) => {
      clearStoredAuth();

      if (token && user) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(TOKEN_KEY, token);
        storage.setItem(USER_KEY, JSON.stringify(user));
      }

      setState({ token, user });
    },
    []
  );

  const login = useCallback(
    async (username: string, password: string, remember = true) => {
      const result = await api.post<LoginResponse>("/api/auth/login", {
        username,
        password,
      });
      persist(result.token, result.user, remember);
      setSessionExpired(false);
      return result.user;
    },
    [persist]
  );

  // Registration only submits a request; the account can sign in once an admin approves it.
  const signup = useCallback(async (payload: SignupPayload) => {
    await api.post("/api/auth/signup", payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore network/expired-token errors on logout
    }
    persist(null, null);
  }, [persist]);

  const expireSession = useCallback(() => {
    persist(null, null);
    setSessionExpired(true);
  }, [persist]);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Apply a fresher copy of the profile (e.g. after an admin moves a student to another section).
  const updateUser = useCallback(
    (next: SessionUser) => {
      if (!state.token) return;
      if (JSON.stringify(next) === JSON.stringify(state.user)) return;
      persist(state.token, next, localStorage.getItem(TOKEN_KEY) !== null);
    },
    [persist, state.token, state.user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      token: state.token,
      sessionExpired,
      login,
      signup,
      logout,
      expireSession,
      updateUser,
      dismissSessionExpired,
    }),
    [state, sessionExpired, login, signup, logout, expireSession, updateUser, dismissSessionExpired]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
