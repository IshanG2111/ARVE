import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { signInWithPopup, GithubAuthProvider, signOut as fbSignOut } from "firebase/auth";
import { auth, githubProvider, isFirebaseConfigured } from "../config/firebase";
import { getMe, loginWithFirebase, logout as apiLogout } from "../services/api";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const data = await getMe();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async () => {
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        throw new Error("Firebase Authentication is not configured in frontend environment.");
      }
      const result = await signInWithPopup(auth, githubProvider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      const githubToken = credential?.accessToken;
      const firebaseIdToken = await result.user.getIdToken();

      await loginWithFirebase(firebaseIdToken, githubToken);
      await fetchUser();
    } catch (err: any) {
      console.error("Firebase authentication error:", err);
      if (err?.code === "auth/popup-closed-by-user") {
        console.info("Authentication popup was closed before completion.");
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // Ignore firebase signout error
    }
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoading: loading,
        isAuthenticated: !!user,
        login,
        logout,
        refetch: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
