"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import type { User } from "@/types";

interface AuthContextValue {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  currentUser: null,
  isLoading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setError(null);
        setIsLoading(false);
        document.cookie = "tosms_admin_auth=; path=/; max-age=0";
        return;
      }

      setIsLoading(true);

      try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, fbUser.uid));
        const userData = userDoc.exists() ? (userDoc.data() as User) : null;

        if (!userData || userData.role !== "admin") {
          await signOut(auth);
          setCurrentUser(null);
          setError("Access denied. Admin accounts only.");
          document.cookie = "tosms_admin_auth=; path=/; max-age=0";
          return;
        }

        setCurrentUser({ ...(userData as User) });
        setError(null);
      } catch (fetchError) {
        console.error("Auth user load failed:", fetchError);
        setCurrentUser(null);
        setError("Unable to verify admin session.");
        document.cookie = "tosms_admin_auth=; path=/; max-age=0";
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
