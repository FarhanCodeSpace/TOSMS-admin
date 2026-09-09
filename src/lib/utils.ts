import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDisplayPhone(phone?: string | null): string {
  if (!phone) return '—';
  const clean = phone.replace(/\s+/g, '');

  if (clean.startsWith('+92')) {
    const netCode = clean.slice(3, 6);
    const rest = clean.slice(6);
    return `+92 ${netCode} ${rest}`.trim();
  }

  if (clean.startsWith('923')) {
    const netCode = clean.slice(2, 5);
    const rest = clean.slice(5);
    return `+92 ${netCode} ${rest}`.trim();
  }

  if (clean.startsWith('03')) {
    const netCode = clean.slice(0, 4);
    const rest = clean.slice(4);
    return `${netCode} ${rest}`.trim();
  }

  return clean;
}
