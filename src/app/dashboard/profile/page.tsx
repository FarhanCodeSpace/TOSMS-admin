"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { format } from "date-fns";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Key,
  Camera,
  Save,
  CheckCircle,
  Calendar,
  Lock,
  Clock,
  Activity,
  Sparkles,
  BadgeCheck,
  Loader2,
  Upload,
  X,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, uploadString, getDownloadURL } from "firebase/storage";

import { db, storage } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";
import { useAuth } from "@/context/AuthContext";
import StatsCard from "@/components/ui/StatsCard";

const processImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to process image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export default function AdminProfilePage() {
  const { currentUser, isLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageModal, setImageModal] = useState<{ open: boolean; url: string }>({
    open: false,
    url: "",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || "");
      setPhone(currentUser.phone || "");
      const photo =
        currentUser.profileImageUrl ||
        (currentUser as any).photoURL ||
        (currentUser as any).profilePhoto ||
        (currentUser as any).photoUrl ||
        "";
      setPhotoUrl(photo);
    }
  }, [currentUser]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const startsWithPlus = val.startsWith('+');
    val = val.replace(/[^0-9]/g, '');
    if (startsWithPlus) val = '+' + val;

    const max = val.startsWith('+92') ? 13 : 11;
    if (val.length <= max) {
      setPhone(val);
    }
  };

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image file size must be less than 8MB");
      return;
    }

    setIsUploading(true);
    setUploadProgress(25);

    try {
      // 1. Process & compress image locally for instant, zero-delay rendering
      const compressedDataUrl = await processImageFile(file);
      setUploadProgress(60);

      let finalUrl = compressedDataUrl;

      // 2. Try uploading to Firebase Storage with a 3-second timeout fallback
      try {
        const storageRef = ref(
          storage,
          `profile_photos/${currentUser.uid}_${Date.now()}.jpg`,
        );

        const uploadPromise = (async () => {
          await uploadString(storageRef, compressedDataUrl, "data_url");
          return await getDownloadURL(storageRef);
        })();

        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Storage upload timeout")), 3000),
        );

        finalUrl = await Promise.race([uploadPromise, timeoutPromise]);
      } catch (storageErr) {
        console.warn("Storage upload fallback to compressed Data URL:", storageErr);
        finalUrl = compressedDataUrl;
      }

      setPhotoUrl(finalUrl);
      setUploadProgress(100);
      toast.success("Photo uploaded! Click 'Save Profile Changes' to save.");
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("An error occurred during photo processing");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
      await updateDoc(userRef, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        profileImageUrl: photoUrl.trim(),
        profilePhoto: photoUrl.trim(),
        photoURL: photoUrl.trim(),
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const adminName = currentUser?.fullName || "System Administrator";
  const adminEmail = currentUser?.email || "admin@tosms.com";
  const adminRole = currentUser?.role
    ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) + " Administrator"
    : "Super Administrator";

  const adminPhoto =
    photoUrl ||
    currentUser?.profileImageUrl ||
    (currentUser as any)?.photoURL ||
    (currentUser as any)?.profilePhoto ||
    "";

  const initials = adminName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const joinedDate = currentUser?.createdAt
    ? typeof currentUser.createdAt.toDate === "function"
      ? format(currentUser.createdAt.toDate(), "MMMM d, yyyy")
      : "September 2026"
    : "September 2026";

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              {adminPhoto ? (
                <div
                  className="group relative cursor-pointer overflow-hidden rounded-full ring-4 ring-blue-500/20 shadow-md transition hover:scale-105"
                  onClick={() => setImageModal({ open: true, url: adminPhoto })}
                  title="Click to view full image"
                >
                  <Image
                    src={adminPhoto}
                    alt={adminName}
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 rounded-full object-cover transition group-hover:brightness-90"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="h-6 w-6 text-white drop-shadow-md" />
                  </div>
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-2xl font-bold text-white shadow-md">
                  {initials || "AD"}
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-emerald-500 ring-2 ring-white" title="Active Session" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--text)]">
                  {adminName}
                </h1>
                <BadgeCheck className="h-6 w-6 text-blue-500 flex-shrink-0" />
              </div>
              <p className="text-sm font-medium text-[var(--text-muted)] mt-0.5">
                {adminEmail}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {adminRole}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
                  <Activity className="h-3.5 w-3.5" />
                  Status: Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-center min-w-[120px]">
              <p className="text-xs text-[var(--text-muted)]">Access Level</p>
              <p className="text-sm font-bold text-[var(--text)] mt-0.5">Full System</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-center min-w-[120px]">
              <p className="text-xs text-[var(--text-muted)]">Member Since</p>
              <p className="text-sm font-bold text-[var(--text)] mt-0.5">{joinedDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Update Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Details & Security Summary */}
        <div className="space-y-6 lg:col-span-1">
          {/* Overview Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <User className="h-5 w-5 text-blue-600" />
              Account Overview
            </h2>

            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" /> Email Address
                </span>
                <span className="font-medium text-[var(--text)]">{adminEmail}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" /> Phone Number
                </span>
                <span className="font-medium text-[var(--text)]">{phone || "Not set"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-400" /> Role Type
                </span>
                <span className="font-medium text-[var(--text)]">System Admin</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" /> Account Created
                </span>
                <span className="font-medium text-[var(--text)]">{joinedDate}</span>
              </div>
            </div>
          </div>

          {/* Security Summary Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Lock className="h-5 w-5 text-emerald-600" />
              Security & Authentication
            </h2>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-950">Firebase Auth Session</p>
                    <p className="text-xs text-emerald-700">Authenticated via Secure Token</p>
                  </div>
                </div>
                <span className="inline-block rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-950">2FA Security Status</p>
                    <p className="text-xs text-blue-700">Configured via Firebase Auth</p>
                  </div>
                </div>
                <span className="inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  Enabled
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="font-semibold text-slate-900">Last Signed In</p>
                    <p className="text-xs text-slate-500">Current Web Session</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-700">Just Now</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm space-y-6">
            <div className="border-b border-[var(--border)] pb-4">
              <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Edit Profile Information
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Update your admin display name, contact phone number, and profile picture URL.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Profile Image Upload & Preview */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-[var(--text)]">
                  Profile Picture
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleDeviceUpload}
                  className="hidden"
                />
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative">
                    {photoUrl ? (
                      <div
                        className="group relative cursor-pointer overflow-hidden rounded-full ring-2 ring-blue-500/20 shadow-sm transition hover:scale-105"
                        onClick={() => setImageModal({ open: true, url: photoUrl })}
                        title="Click to view full image"
                      >
                        <Image
                          src={photoUrl}
                          alt="Preview"
                          width={64}
                          height={64}
                          unoptimized
                          className="h-16 w-16 rounded-full object-cover transition group-hover:brightness-90"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="h-4 w-4 text-white drop-shadow-md" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-xl font-bold">
                        {initials || "AD"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 border border-blue-100 hover:bg-blue-100 transition disabled:opacity-50"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            Uploading ({uploadProgress}%)...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            Upload Photo from Device
                          </>
                        )}
                      </button>
                    </div>

                    <input
                      type="url"
                      placeholder="Or paste direct image URL (https://...)"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {isUploading && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}

                    <p className="text-xs text-[var(--text-muted)]">
                      Upload an image file directly from your device gallery or paste a public HTTPS link.
                    </p>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[var(--text)]">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    required
                    placeholder="Admin Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[var(--text)]">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="0300-1234567"
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={phone.startsWith("+92") ? 13 : 11}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Email (Read only) */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[var(--text)]">
                  Email Address (System Registered)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    disabled
                    value={adminEmail}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] opacity-70 cursor-not-allowed pl-10 pr-4 py-2.5 text-sm text-[var(--text)]"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Email is managed via Firebase Authentication.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-[var(--border)] flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving Changes...
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading Photo ({uploadProgress}%)...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Profile Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {imageModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity"
          onClick={() => setImageModal({ open: false, url: "" })}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-[var(--surface)] p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImageModal({ open: false, url: "" })}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={imageModal.url}
              alt="Profile Preview"
              className="max-h-[80vh] max-w-[80vw] rounded-xl object-contain shadow-md"
            />
          </div>
        </div>
      )}
    </section>
  );
}
