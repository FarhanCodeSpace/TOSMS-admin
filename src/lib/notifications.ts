import { Timestamp } from "firebase/firestore";

export interface AdminNotification {
  id: string;
  type: 'payment_submitted' | 'driver_pending' | 'new_booking' | 'availability_alert';
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  metadata?: Record<string, any>;
}
