import { normalizeFeeStatus } from "@/utils/feeHelpers";

interface FeeStatusBadgeProps {
  status?: string;
  method?: string;
  isExempt?: boolean;
}

export default function FeeStatusBadge({
  status = "no_data",
  method,
  isExempt,
}: FeeStatusBadgeProps) {
  const getStatusDisplayText = () => {
    if (status === "no_data") return "No Fee";
    
    if (isExempt || status.toLowerCase() === "exempt") return "Exempt";

    const isOnline =
      method?.toLowerCase().includes("card") ||
      method?.toLowerCase().includes("paddle");

    if (status.toLowerCase() === "verified" || status.toLowerCase() === "paid") {
      return isOnline ? "Paid" : "Verified";
    }

    if (
      status.toLowerCase() === "pending" ||
      status.toLowerCase() === "due" ||
      status.toLowerCase() === "unpaid"
    ) {
      return "Unpaid";
    }

    if (status.toLowerCase() === "submitted") {
      return isOnline ? "Unpaid" : "Pending";
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusBadgeClass = () => {
    if (status === "no_data") return "bg-slate-100 text-slate-800";
    if (isExempt) {
      return "bg-violet-100 text-violet-800";
    }

    switch (normalizeFeeStatus(status)) {
      case "verified":
        return "bg-green-100 text-green-800";
      case "submitted":
        return "bg-orange-100 text-orange-800";
      case "pending":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass()}`}
    >
      {getStatusDisplayText()}
    </span>
  );
}
