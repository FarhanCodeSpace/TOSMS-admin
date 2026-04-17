"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { Building2, Info, Lock, Save } from "lucide-react";
import toast from "react-hot-toast";

import ErrorState from "@/components/ui/ErrorState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { COLLECTIONS } from "@/lib/collections";
import { auth, db } from "@/lib/firebase";
import type { CompanySettings, FeePayment } from "@/types";
import { formatPKR } from "@/utils/formatters";

type Stats = {
  totalCompletedRides: number;
  totalStudents: number;
  totalFeesCollected: number;
};

const defaultCompanyForm: CompanySettings = {
  companyName: "",
  bankName: "",
  bankAccountTitle: "",
  bankAccountNumber: "",
  bankBranchCode: "",
  bankIBAN: "",
  easypaisaAccount: "",
  jazzcashAccount: "",
  feeDueDate: "",
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const defaultPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [companyForm, setCompanyForm] =
    useState<CompanySettings>(defaultCompanyForm);
  const [companyErrors, setCompanyErrors] = useState<Record<string, string>>(
    {},
  );

  const [passwordForm, setPasswordForm] =
    useState<PasswordForm>(defaultPasswordForm);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );

  const [stats, setStats] = useState<Stats>({
    totalCompletedRides: 0,
    totalStudents: 0,
    totalFeesCollected: 0,
  });

  const adminEmail = auth.currentUser?.email || "Not signed in";

  const loadSettingsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [settingsSnap, ridesSnap, studentsSnap, feesSnap] =
        await Promise.all([
          getDoc(doc(db, COLLECTIONS.SETTINGS, "companyInfo")),
          getDocs(
            query(
              collection(db, COLLECTIONS.RIDES),
              where("status", "==", "completed"),
            ),
          ),
          getDocs(
            query(
              collection(db, COLLECTIONS.USERS),
              where("role", "==", "student"),
            ),
          ),
          getDocs(collection(db, COLLECTIONS.FEE_PAYMENTS)),
        ]);

      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as Partial<CompanySettings>;
        setCompanyForm({
          companyName: data.companyName || "",
          bankName: data.bankName || "",
          bankAccountTitle: data.bankAccountTitle || "",
          bankAccountNumber: data.bankAccountNumber || "",
          bankBranchCode: data.bankBranchCode || "",
          bankIBAN: data.bankIBAN || "",
          easypaisaAccount: data.easypaisaAccount || "",
          jazzcashAccount: data.jazzcashAccount || "",
          feeDueDate: data.feeDueDate || "",
        });
      }

      const fees = feesSnap.docs.map((feeDoc) => feeDoc.data() as FeePayment);
      const totalFeesCollected = fees
        .filter((fee) => fee.paymentStatus === "verified")
        .reduce((sum, fee) => {
          const fallbackAmount = (fee as FeePayment & { fareAmount?: number })
            .fareAmount;
          return sum + Number(fee.amount ?? fallbackAmount ?? 0);
        }, 0);

      setStats({
        totalCompletedRides: ridesSnap.size,
        totalStudents: studentsSnap.size,
        totalFeesCollected,
      });
    } catch (loadError) {
      console.error("Failed to load settings:", loadError);
      setError("Unable to load settings right now.");
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettingsData();
  }, []);

  const validateCompanyForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!companyForm.companyName.trim())
      nextErrors.companyName = "Company name is required";
    if (!companyForm.bankName.trim())
      nextErrors.bankName = "Bank name is required";
    if (!companyForm.bankAccountTitle.trim()) {
      nextErrors.bankAccountTitle = "Account title is required";
    }
    if (!companyForm.bankAccountNumber.trim()) {
      nextErrors.bankAccountNumber = "Account number is required";
    }
    if (!companyForm.feeDueDate.trim())
      nextErrors.feeDueDate = "Fee due date is required";

    setCompanyErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      nextErrors.currentPassword = "Current password is required";
    }

    if (!passwordForm.newPassword) {
      nextErrors.newPassword = "New password is required";
    } else if (passwordForm.newPassword.length < 8) {
      nextErrors.newPassword = "New password must be at least 8 characters";
    }

    if (!passwordForm.confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your new password";
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setPasswordErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveCompanyInfo = async () => {
    if (!validateCompanyForm()) return;

    setSavingCompany(true);
    try {
      await setDoc(doc(db, COLLECTIONS.SETTINGS, "companyInfo"), companyForm, {
        merge: true,
      });
      toast.success("Company information updated");
    } catch (saveError) {
      console.error("Failed saving company info:", saveError);
      toast.error("Failed to save company information");
    } finally {
      setSavingCompany(false);
    }
  };

  const changePassword = async () => {
    if (!validatePasswordForm()) return;
    if (!auth.currentUser || !auth.currentUser.email) {
      toast.error("No authenticated admin session found");
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        passwordForm.currentPassword,
      );

      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordForm.newPassword);

      setPasswordForm(defaultPasswordForm);
      setPasswordErrors({});
      toast.success("Password updated successfully");
    } catch (passwordError) {
      console.error("Password update failed:", passwordError);
      toast.error(
        "Failed to update password. Verify current password and try again.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (error) {
    return (
      <ErrorState
        title="Settings failed to load"
        message={error}
        onRetry={() => {
          void loadSettingsData();
        }}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage company account details, admin credentials, and dashboard-wide
          statistics.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-5 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">
            Company Information
          </h2>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            Note: The mobile app currently uses hardcoded values. Update
            companyInfo.ts in the mobile app code to match these values.
          </p>
        </div>

        {loading ? (
          <SkeletonLoader variant="line" rows={8} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { key: "companyName", label: "Company Name" },
              { key: "bankName", label: "Bank Name" },
              { key: "bankAccountTitle", label: "Bank Account Title" },
              { key: "bankAccountNumber", label: "Bank Account Number" },
              { key: "bankBranchCode", label: "Branch Code" },
              { key: "bankIBAN", label: "IBAN" },
              { key: "easypaisaAccount", label: "EasyPaisa Account Number" },
              { key: "jazzcashAccount", label: "JazzCash Account Number" },
              { key: "feeDueDate", label: "Fee Due Date" },
            ].map((field) => (
              <label
                key={field.key}
                className="text-sm font-medium text-slate-700"
              >
                {field.label}
                <input
                  type="text"
                  value={companyForm[field.key as keyof CompanySettings]}
                  onChange={(event) => {
                    setCompanyForm((prev) => ({
                      ...prev,
                      [field.key]: event.target.value,
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                />
                {companyErrors[field.key] ? (
                  <p className="mt-1 text-xs text-rose-600">
                    {companyErrors[field.key]}
                  </p>
                ) : null}
              </label>
            ))}
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              void saveCompanyInfo();
            }}
            disabled={savingCompany || loading}
            className="inline-flex items-center gap-2 rounded-full bg-[#1A3C5E] px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {savingCompany ? "Saving..." : "Save Company Info"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-5 flex items-center gap-2">
          <Lock className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">
            Admin Account
          </h2>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Signed in as:{" "}
          <span className="font-semibold text-slate-900">{adminEmail}</span>
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Current Password
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  currentPassword: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            {passwordErrors.currentPassword ? (
              <p className="mt-1 text-xs text-rose-600">
                {passwordErrors.currentPassword}
              </p>
            ) : null}
          </label>

          <label className="text-sm font-medium text-slate-700">
            New Password
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  newPassword: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            {passwordErrors.newPassword ? (
              <p className="mt-1 text-xs text-rose-600">
                {passwordErrors.newPassword}
              </p>
            ) : null}
          </label>

          <label className="text-sm font-medium text-slate-700">
            Confirm New Password
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  confirmPassword: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            {passwordErrors.confirmPassword ? (
              <p className="mt-1 text-xs text-rose-600">
                {passwordErrors.confirmPassword}
              </p>
            ) : null}
          </label>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              void changePassword();
            }}
            disabled={changingPassword}
            className="rounded-full bg-[#1A3C5E] px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changingPassword ? "Updating Password..." : "Change Password"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Dashboard Statistics
        </h2>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">
                Total rides completed (all time)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.totalCompletedRides}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">
                Total students registered (all time)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.totalStudents}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">
                Total fees collected (all time)
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatPKR(stats.totalFeesCollected)}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
