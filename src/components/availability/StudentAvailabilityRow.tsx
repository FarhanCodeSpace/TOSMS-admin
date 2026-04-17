"use client";

import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";

import { getInitials } from "@/utils/formatters";

export type StudentAvailabilityStatus =
  | "available"
  | "not_available"
  | "no_response";

export type StudentAvailabilityRowData = {
  userId: string;
  name: string;
  pickupStop?: string;
  profileImageUrl?: string;
  status: StudentAvailabilityStatus;
  note?: string;
  markedAt?: Timestamp | Date | null;
  reminderSent?: boolean;
};

type StudentAvailabilityRowProps = {
  student: StudentAvailabilityRowData;
};

function getStatusMeta(status: StudentAvailabilityStatus) {
  if (status === "available") {
    return {
      label: "Available ✅",
      classes: "bg-emerald-100 text-emerald-800",
    };
  }

  if (status === "not_available") {
    return {
      label: "Not Available ❌",
      classes: "bg-rose-100 text-rose-800",
    };
  }

  return {
    label: "Not Responded ⏰",
    classes: "bg-amber-100 text-amber-800",
  };
}

function formatMarkedAt(markedAt?: Timestamp | Date | null) {
  if (!markedAt) return "-";
  const value = markedAt instanceof Timestamp ? markedAt.toDate() : markedAt;
  return format(value, "h:mm a");
}

export default function StudentAvailabilityRow({
  student,
}: StudentAvailabilityRowProps) {
  const statusMeta = getStatusMeta(student.status);

  return (
    <tr className="border-b border-slate-100 align-top text-sm">
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {student.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={student.profileImageUrl}
              alt={student.name}
              className="h-8 w-8 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
              {getInitials(student.name)}
            </div>
          )}
          <span className="font-medium text-slate-900">{student.name}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-slate-600">{student.pickupStop || "-"}</td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.classes}`}
        >
          {statusMeta.label}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-600">
        {student.note || (student.reminderSent ? "Reminder sent" : "-")}
      </td>
      <td className="px-3 py-3 text-slate-600">
        {formatMarkedAt(student.markedAt)}
      </td>
    </tr>
  );
}
