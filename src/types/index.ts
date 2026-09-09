import { Timestamp } from "firebase/firestore";

export interface User {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: "student" | "driver" | "admin";
  profileImageUrl?: string;
  fcmToken?: string;
  expoPushToken?: string;
  createdAt: Timestamp;
  status: "active" | "suspended" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  rejectedAt?: Timestamp;
  routeId?: string;
  assignedRouteIds?: string[];
  pickupStop?: string;
  dropStop?: string;
  routeStops?: {
    [routeId: string]: {
      pickupStop: string;
      dropStop: string;
    };
  };
  // Driver specific fields
  vehicleType?: "van" | "bus" | "coaster";
  vehiclePlate?: string;
  vehicleCapacity?: number;
  cnicNumber?: string;
  cnic?: string;
  cnicFrontUrl?: string;
  cnicBackUrl?: string;
  university?: string;
  universityName?: string;
  instituteName?: string;
  institute?: string;
  college?: string;
  approved?: boolean;
  rating?: number;
  totalRides?: number;
  profileComplete?: boolean;
}

export interface RouteStop {
  stopName: string;
  order: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface Route {
  routeId: string;
  routeName: string;
  description?: string;
  stops: RouteStop[];
  assignedDriverId: string;
  assignedDriverName: string;
  assignedDriverIds: string[];
  studentIds: string[];
  departureTime?: string | null;
  returnTime?: string | null;
  feeAmount?: number;
  isActive: boolean;
  createdAt: Timestamp;
}

export interface Ride {
  rideId: string;
  routeId: string;
  routeName: string;
  assignedDriverId: string;
  driverName: string;
  date: string; // YYYY-MM-DD format — critical, must match mobile app
  departureTime: string;
  returnTime?: string;
  status: "scheduled" | "active" | "completed" | "cancelled" | "auto_cancelled" | "delayed" | "no_show";
  boardedCount: number;
  studentIds: string[];
  completedStops?: (string | number)[];
  createdAt: Timestamp;
}

export interface EarlyRideStudentJoined {
  studentId: string;
  name: string;
  gender: "male" | "female";
  joinedAt: Timestamp;
}

export interface EarlyRideRequest {
  requestId: string;
  route: string;
  university: string;
  studentsJoined: EarlyRideStudentJoined[];
  boysCount: number;
  girlsCount: number;
  status: "waiting" | "accepted" | "completed" | "cancelled" | "expired";
  assignedDriverIds: string[];
  acceptedDriverId: string | null;
  vehicle: { name: string; plateNumber: string } | null;
  rideId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Availability {
  availabilityId: string;
  userId: string;
  userName: string;
  routeId: string;
  date: string; // YYYY-MM-DD format
  isAvailable: boolean;
  note?: string;
  role: "student" | "driver";
  vehicleAvailable?: boolean; // driver only
  markedAt: Timestamp;
}

export interface FeePayment {
  paymentId: string;
  studentId: string;
  studentName: string;
  routeId: string;
  month: string; // YYYY-MM format
  amount: number;
  amountUsdCents?: number;
  pkrPerUsd?: number;
  paymentMethod: "bank_challan" | "easypaisa" | "jazzcash" | "paddle";
  paymentStatus: "pending" | "submitted" | "verified";
  challanNumber?: string;
  transactionId?: string;
  paddleTransactionId?: string;
  submittedAt: Timestamp;
  verifiedAt?: Timestamp;
  receiptImageUrl?: string;
  rejectionReason?: string;
  feeExempt?: boolean;
  exemptedAt?: Timestamp;
}

export interface Challan {
  challanId: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  routeId: string;
  routeName: string;
  month: string;
  amount: number;
  challanNumber: string;
  status: "generated" | "deposited" | "verified";
  generatedAt: Timestamp;
  receiptImageUrl?: string;
}

export interface Review {
  reviewId: string;
  studentId: string;
  studentName: string;
  driverId: string;
  rideId: string;
  rating: number;
  comment?: string;
  createdAt: Timestamp;
  flagged?: boolean;
}

export interface LiveLocation {
  driverId: string;
  rideId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  updatedAt: Timestamp;
}

export interface CompanySettings {
  companyName: string;
  bankName: string;
  bankAccountTitle: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankIBAN: string;
  easypaisaAccount: string;
  jazzcashAccount: string;
  feeDueDate: string;
  monthlyFee?: number;
}
