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

// Delete student account and clean route/availability relationships.
export const deleteStudentAccount = async (
  studentId: string,
): Promise<void> => {
  const studentRef = doc(db, COLLECTIONS.USERS, studentId);
  const studentSnap = await getDoc(studentRef);

  if (!studentSnap.exists()) {
    return;
  }

  const studentData = studentSnap.data() as { routeId?: string };
  // Required path: always remove user and route link first.
  // This must succeed even if optional collections (challans, fee history) are locked by rules.
  const requiredBatch = writeBatch(db);
  if (studentData.routeId) {
    requiredBatch.update(doc(db, COLLECTIONS.ROUTES, studentData.routeId), {
      studentIds: arrayRemove(studentId),
    });
  }

  requiredBatch.delete(studentRef);
  await requiredBatch.commit();

  // Optional cleanup path: best-effort only.
  const safeGetDocs = async (collectionName: string, field: string) => {
    try {
      return await getDocs(
        query(collection(db, collectionName), where(field, "==", studentId)),
      );
    } catch (error) {
      console.warn(`Skipping optional cleanup for ${collectionName}:`, error);
      return null;
    }
  };

  const [availabilitySnap, feePaymentsSnap, challansSnap] = await Promise.all([
    safeGetDocs(COLLECTIONS.AVAILABILITY, "userId"),
    safeGetDocs(COLLECTIONS.FEE_PAYMENTS, "studentId"),
    safeGetDocs(COLLECTIONS.CHALLANS, "studentId"),
  ]);

  const deleteRefs = [
    ...(availabilitySnap?.docs.map((docSnap) => docSnap.ref) || []),
    ...(feePaymentsSnap?.docs.map((docSnap) => docSnap.ref) || []),
    ...(challansSnap?.docs.map((docSnap) => docSnap.ref) || []),
  ];

  if (deleteRefs.length === 0) {
    return;
  }

  const maxWritesPerBatch = 450;

  for (let i = 0; i < deleteRefs.length; i += maxWritesPerBatch) {
    const cleanupBatch = writeBatch(db);
    const chunk = deleteRefs.slice(i, i + maxWritesPerBatch);

    chunk.forEach((docRef) => {
      cleanupBatch.delete(docRef);
    });

    try {
      await cleanupBatch.commit();
    } catch (error) {
      console.warn("Optional student cleanup batch failed:", error);
    }
  }
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

// Delete driver account and clear route/ride/live-location relationships.
export const deleteDriverAccount = async (driverId: string): Promise<void> => {
  const driverRef = doc(db, COLLECTIONS.USERS, driverId);
  const driverSnap = await getDoc(driverRef);

  if (!driverSnap.exists()) {
    return;
  }

  const [routesSnap, ridesSnap, liveLocationsSnap, availabilitySnap] =
    await Promise.all([
      getDocs(
        query(
          collection(db, COLLECTIONS.ROUTES),
          where("assignedDriverId", "==", driverId),
        ),
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.RIDES),
          where("assignedDriverId", "==", driverId),
        ),
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.LIVE_LOCATIONS),
          where("driverId", "==", driverId),
        ),
      ),
      getDocs(
        query(
          collection(db, COLLECTIONS.AVAILABILITY),
          where("userId", "==", driverId),
        ),
      ),
    ]);

  const batch = writeBatch(db);

  routesSnap.docs.forEach((routeDoc) => {
    batch.update(routeDoc.ref, {
      assignedDriverId: "",
      assignedDriverName: "",
    });
  });

  ridesSnap.docs.forEach((rideDoc) => {
    batch.update(rideDoc.ref, {
      assignedDriverId: "",
      driverName: "Unassigned Driver",
    });
  });

  liveLocationsSnap.docs.forEach((liveLocationDoc) => {
    batch.delete(liveLocationDoc.ref);
  });

  availabilitySnap.docs.forEach((availabilityDoc) => {
    batch.delete(availabilityDoc.ref);
  });

  batch.delete(driverRef);

  await batch.commit();
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
