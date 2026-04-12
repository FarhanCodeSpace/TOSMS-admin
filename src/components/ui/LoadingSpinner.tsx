"use client";

type LoadingSpinnerProps = {
  message?: string;
};

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#1A3C5E]" />
      {message ? <p className="text-sm font-medium">{message}</p> : null}
    </div>
  );
}
