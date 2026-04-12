import { formatDistanceToNow, format } from "date-fns";
import { Timestamp } from "firebase/firestore";

// Format PKR amount — 'PKR 1,500'
export const formatPKR = (amount: number): string =>
  `PKR ${amount.toLocaleString("en-PK")}`;

// Convert Firestore Timestamp or Date to display string
export const formatTimestamp = (
  timestamp: Timestamp | Date | null | undefined,
): string => {
  if (!timestamp) return "N/A";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, "MMM d, yyyy h:mm a");
};

// Relative time — '2 hours ago'
export const formatRelative = (
  timestamp: Timestamp | Date | null | undefined,
): string => {
  if (!timestamp) return "N/A";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return formatDistanceToNow(date, { addSuffix: true });
};

// Get initials from full name — 'Ahmed Khan' → 'AK'
export const getInitials = (name: string): string => {
  if (!name) return "?";
  const words = name.trim().split(" ").filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Payment method display name
export const formatPaymentMethod = (method: string): string => {
  const map: Record<string, string> = {
    bank_challan: "Bank Deposit",
    easypaisa: "EasyPaisa",
    jazzcash: "JazzCash",
  };
  return map[method] || method;
};

// Vehicle type display name
export const formatVehicleType = (type: string): string => {
  const map: Record<string, string> = {
    van: "Van",
    bus: "Bus",
    coaster: "Coaster",
  };
  return map[type] || type;
};

// Role display name
export const formatRole = (role: string): string => {
  const map: Record<string, string> = {
    student: "Student",
    driver: "Driver",
    admin: "Administrator",
  };
  return map[role] || role;
};

// Truncate long text
export const truncate = (text: string, maxLength: number): string => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};
