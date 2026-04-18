"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { Mail, Lock, ArrowRight, Check } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="flex min-h-screen bg-[var(--background)]">
      {/* Left Side: Branding & Info */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#1A3C5E] to-[#0F172A] items-center justify-center p-8 lg:p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--primary)]/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl -ml-32 -mb-32" />

        {/* Content */}
        <div className="relative z-10 text-center text-white space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-[var(--accent)]">
              <span className="text-2xl font-bold">TS</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              TOSMS Admin Portal
            </h1>
            <p className="text-lg text-white/70">
              Transport Operations and Safety Management System
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 pt-8">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-semibold">Real-time Operations</p>
                <p className="text-sm text-white/60">
                  Monitor routes and drivers live
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-semibold">Student Management</p>
                <p className="text-sm text-white/60">
                  Track enrollments and assignments
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-semibold">Secure Payments</p>
                <p className="text-sm text-white/60">
                  Manage fees and revenue safely
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile Header */}
          <div className="md:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] mb-4">
              <span className="text-xl font-bold text-white">TS</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text)]">TOSMS</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Admin Portal
            </p>
          </div>

          {/* Form Card */}
          <div className="space-y-6">
            <div className="hidden md:block">
              <h2 className="text-3xl font-bold text-[var(--text)]">
                Welcome back
              </h2>
              <p className="text-[var(--text-muted)] mt-2">
                Sign in to your admin account
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className={cn(
                  "p-4 rounded-lg border",
                  "border-[var(--error)] bg-[var(--error-light)]",
                  "text-[var(--error)] text-sm font-medium",
                )}
              >
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[var(--text)]"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="admin@tosms.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      "w-full pl-12 pr-4 py-3 rounded-lg",
                      "border border-[var(--border)]",
                      "bg-[var(--surface)]",
                      "text-[var(--text)]",
                      "placeholder:text-[var(--text-muted)]",
                      "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent",
                      "transition-all duration-200",
                    )}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--text)]"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "w-full pl-12 pr-12 py-3 rounded-lg",
                      "border border-[var(--border)]",
                      "bg-[var(--surface)]",
                      "text-[var(--text)]",
                      "placeholder:text-[var(--text-muted)]",
                      "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent",
                      "transition-all duration-200",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                disabled={loading}
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
                rightIcon={!loading && <ArrowRight className="w-4 h-4" />}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center pt-6 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)]">
                Powered by <span className="font-semibold">TOSMS</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
