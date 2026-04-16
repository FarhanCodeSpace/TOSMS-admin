import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/collections";

// ─── DRIVER MANAGEMENT ───────────────────────────────

export const approveDriver = async (driverUid: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.USERS, driverUid), {
    approved: true,
    status: "active",
  });
};

export const rejectDriver = async (driverUid: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.USERS, driverUid), {
    approved: false,
    status: "suspended",
  });
};

export const suspendUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    status: "suspended",
  });
};

export const reactivateUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    status: "active",
  });
};

// ─── ROUTE ASSIGNMENT ────────────────────────────────

// Assign student to route — updates BOTH documents
// Mobile app student home Route Card updates instantly via onSnapshot
export const assignStudentToRoute = async (
  studentId: string,
  routeId: string,
  pickupStop: string,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.ROUTES, routeId), {
    studentIds: arrayUnion(studentId),
  });
  await updateDoc(doc(db, COLLECTIONS.USERS, studentId), {
    routeId,
    pickupStop,
  });
};

// Remove student from route — updates BOTH documents
export const removeStudentFromRoute = async (
  studentId: string,
  routeId: string,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.ROUTES, routeId), {
    studentIds: arrayRemove(studentId),
  });
  await updateDoc(doc(db, COLLECTIONS.USERS, studentId), {
    routeId: "",
    pickupStop: "",
  });
};

// Assign driver to route — updates BOTH documents
// Mobile app driver home MyRoute card updates instantly
export const assignDriverToRoute = async (
  driverId: string,
  driverName: string,
  routeId: string,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.ROUTES, routeId), {
    assignedDriverId: driverId,
    assignedDriverName: driverName,
  });
  await updateDoc(doc(db, COLLECTIONS.USERS, driverId), {
    routeId,
  });
};

// Remove driver from route — updates BOTH documents
export const removeDriverFromRoute = async (
  driverId: string,
  routeId: string,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.ROUTES, routeId), {
    assignedDriverId: "",
    assignedDriverName: "",
  });
  await updateDoc(doc(db, COLLECTIONS.USERS, driverId), {
    routeId: "",
  });
};

// Delete route — clears assignments from drivers/students and removes the route document
export const deleteRoute = async (routeId: string): Promise<void> => {
  const routeRef = doc(db, COLLECTIONS.ROUTES, routeId);
  const routeSnap = await getDoc(routeRef);

  if (!routeSnap.exists()) {
    return;
  }

  const usersSnap = await getDocs(
    query(collection(db, COLLECTIONS.USERS), where("routeId", "==", routeId)),
  );

  const batch = writeBatch(db);

  usersSnap.docs
    .filter(
      (userDoc) => (userDoc.data() as { role?: string }).role === "driver",
    )
    .forEach((driverDoc) => {
      batch.update(doc(db, COLLECTIONS.USERS, driverDoc.id), {
        routeId: "",
      });
    });

  usersSnap.docs
    .filter(
      (studentDoc) =>
        (studentDoc.data() as { role?: string }).role === "student",
    )
    .forEach((studentDoc) => {
      batch.update(doc(db, COLLECTIONS.USERS, studentDoc.id), {
        routeId: "",
        pickupStop: "",
      });
    });

  batch.delete(routeRef);

  await batch.commit();
};

// ─── FEE PAYMENTS ────────────────────────────────────

// Verify payment — Cloud Function automatically sends push to student
export const verifyFeePayment = async (paymentId: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.FEE_PAYMENTS, paymentId), {
    paymentStatus: "verified",
    verifiedAt: serverTimestamp(),
  });
};

// Reject payment — student must resubmit
export const rejectFeePayment = async (
  paymentId: string,
  reason: string,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.FEE_PAYMENTS, paymentId), {
    paymentStatus: "pending",
    rejectionReason: reason,
  });
};

// ─── RIDES ───────────────────────────────────────────

// Create ride — driver sees Start Ride button in mobile app automatically
export const createRide = async (
  routeId: string,
  routeName: string,
  assignedDriverId: string,
  driverName: string,
  date: string, // YYYY-MM-DD
  departureTime: string,
): Promise<string> => {
  const rideRef = doc(collection(db, COLLECTIONS.RIDES));
  await setDoc(rideRef, {
    rideId: rideRef.id,
    routeId,
    routeName,
    assignedDriverId,
    driverName,
    date,
    departureTime,
    status: "scheduled",
    boardedCount: 0,
    createdAt: serverTimestamp(),
  });
  return rideRef.id;
};

// Check if ride already exists for route on date
export const rideExists = async (
  routeId: string,
  date: string,
): Promise<boolean> => {
  const q = query(
    collection(db, COLLECTIONS.RIDES),
    where("routeId", "==", routeId),
    where("date", "==", date),
  );
  const snap = await getDocs(q);
  return !snap.empty;
};

// Cancel a scheduled ride
export const cancelRide = async (rideId: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.RIDES, rideId), {
    status: "cancelled",
  });
};

// ─── REVIEWS ─────────────────────────────────────────

// Delete review and recalculate driver rating
export const deleteReview = async (
  reviewId: string,
  driverId: string,
): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.REVIEWS, reviewId));
  // Recalculate driver average rating
  const q = query(
    collection(db, COLLECTIONS.REVIEWS),
    where("driverId", "==", driverId),
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    await updateDoc(doc(db, COLLECTIONS.USERS, driverId), {
      rating: 0,
      totalRides: 0,
    });
    return;
  }
  const ratings = snap.docs.map((d) => d.data().rating as number);
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  await updateDoc(doc(db, COLLECTIONS.USERS, driverId), {
    rating: Math.round(avg * 10) / 10,
  });
};

// Flag or unflag a review
export const toggleReviewFlag = async (
  reviewId: string,
  flagged: boolean,
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.REVIEWS, reviewId), { flagged });
};
