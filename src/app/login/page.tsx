"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const userId = credential.user.uid;
      // Force token refresh to ensure fresh auth token
      await credential.user.getIdToken(true);
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
      const userData = userDoc.data();

      if (!userDoc.exists() || userData?.role !== "admin") {
        await signOut(auth);
        setError("Access denied. Admin accounts only.");
        toast.error("Access denied. Admin accounts only.");
        setLoading(false);
        return;
      }

      document.cookie =
        "tosms_admin_auth=true; path=/; max-age=86400; SameSite=Strict";
      toast.success("Welcome to TOSMS Admin");
      router.push("/dashboard");
    } catch (signInError) {
      setError("Unable to sign in. Check your credentials.");
      toast.error("Unable to sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl shadow-slate-200">
        <div className="mb-8 text-center">
          <p className="text-4xl font-black text-[#1A3C5E]">TOSMS</p>
          <p className="mt-2 text-sm uppercase tracking-[0.24em] text-slate-500">
            Admin Dashboard
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#1A3C5E] focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#1A3C5E] focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[#1A3C5E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
