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
  status: "active" | "suspended";
  routeId?: string;
  pickupStop?: string;
  // Driver specific fields
  vehicleType?: "van" | "bus" | "coaster";
  vehiclePlate?: string;
  vehicleCapacity?: number;
  cnic?: string;
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
  studentIds: string[];
  departureTime: string;
  returnTime: string;
  feeAmount: number;
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
  status: "scheduled" | "active" | "completed" | "cancelled";
  boardedCount: number;
  createdAt: Timestamp;
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
}
