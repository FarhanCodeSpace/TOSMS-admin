// Status display config — must match mobile app StatusBadge component
export const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    bgColor: string;
    textColor: string;
    dotColor: string;
  }
> = {
  // Ride statuses
  scheduled: {
    label: "Scheduled",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    dotColor: "bg-blue-500",
  },
  active: {
    label: "Active",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    dotColor: "bg-green-500",
  },
  completed: {
    label: "Completed",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
    dotColor: "bg-gray-400",
  },
  cancelled: {
    label: "Cancelled",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    dotColor: "bg-red-500",
  },
  // Payment statuses
  verified: {
    label: "Verified",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    dotColor: "bg-green-500",
  },
  submitted: {
    label: "Under Review",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
    dotColor: "bg-orange-500",
  },
  pending: {
    label: "Due",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    dotColor: "bg-red-500",
  },
  // Availability statuses
  available: {
    label: "Available",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    dotColor: "bg-green-500",
  },
  unavailable: {
    label: "Not Available",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    dotColor: "bg-red-500",
  },
  not_marked: {
    label: "Not Responded",
    bgColor: "bg-gray-100",
    textColor: "text-gray-500",
    dotColor: "bg-gray-300",
  },
  // User statuses
  active_user: {
    label: "Active",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    dotColor: "bg-green-500",
  },
  suspended: {
    label: "Suspended",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    dotColor: "bg-red-500",
  },
  approved: {
    label: "Approved",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    dotColor: "bg-green-500",
  },
  pending_approval: {
    label: "Pending",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
    dotColor: "bg-orange-500",
  },
  // Challan statuses
  generated: {
    label: "Generated",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    dotColor: "bg-blue-500",
  },
  deposited: {
    label: "Deposited",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    dotColor: "bg-purple-500",
  },
};
