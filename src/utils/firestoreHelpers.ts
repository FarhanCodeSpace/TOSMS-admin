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
import { getRouteAssignedDriverIds, getRoutePrimaryDriverId } from "@/utils/routeAssignments";

// ─── NOTIFICATIONS MANAGEMENT ──────────────────────

export async function resolvePendingRegistrationNotification(userId: string) {
  try {
    // Query notifications related to this user ID
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', 'registration')
    );
    const snap = await getDocs(q);

    // Delete or mark resolved
    const deletePromises = snap.docs.map((d) => deleteDoc(doc(db, 'notifications', d.id)));
    await Promise.all(deletePromises);
  } catch (err) {
    console.error('Failed to cleanup registration notification:', err);
  }
}

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

// Assign student to multiple routes — updates BOTH documents
// Mobile app student home Route Card updates instantly via onSnapshot
export const updateStudentRoutes = async (
  studentId: string,
  routeIdsToAdd: string[],
  routeIdsToRemove: string[],
  primaryRouteId?: string,
  routeStops?: Record<string, { pickupStop: string; dropStop: string }>,
  assignedRouteIds?: string[]
): Promise<void> => {
  const batch = writeBatch(db);

  // Remove from old routes
  for (const routeId of routeIdsToRemove) {
    batch.update(doc(db, COLLECTIONS.ROUTES, routeId), {
      studentIds: arrayRemove(studentId),
    });
  }

  // Add to new routes
  for (const routeId of routeIdsToAdd) {
    batch.update(doc(db, COLLECTIONS.ROUTES, routeId), {
      studentIds: arrayUnion(studentId),
    });
  }

  // Determine user updates
  const userUpdates: Record<string, any> = {
    routeId: primaryRouteId || "",
    routeStops: routeStops || {},
    assignedRouteIds: assignedRouteIds || []
  };

  if (!primaryRouteId) {
    userUpdates.pickupStop = "";
    userUpdates.dropStop = "";
  } else if (routeStops && routeStops[primaryRouteId]) {
    userUpdates.pickupStop = routeStops[primaryRouteId].pickupStop || "";
    userUpdates.dropStop = routeStops[primaryRouteId].dropStop || "";
  }

  // Update student document
  batch.update(doc(db, COLLECTIONS.USERS, studentId), userUpdates);

  await batch.commit();
};

// Remove student from a single route
export const removeStudentFromRoute = async (
  studentId: string,
  routeId: string,
  isLastRoute: boolean = true,
): Promise<void> => {
  const batch = writeBatch(db);

  batch.update(doc(db, COLLECTIONS.ROUTES, routeId), {
    studentIds: arrayRemove(studentId),
  });

  const studentRef = doc(db, COLLECTIONS.USERS, studentId);

  if (isLastRoute) {
    batch.update(studentRef, {
      routeId: "",
      pickupStop: "",
      dropStop: "",
      routeStops: {},
      assignedRouteIds: [],
    });
  } else {
    // If it's not the last route, we just remove this route from routeStops
    // In Firestore, we can't easily delete a nested map key directly using FieldValue.delete() in an update if we don't know the full structure, 
    // Wait, we CAN delete a nested field using dot notation.
    const updates: Record<string, any> = {
      [`routeStops.${routeId}`]: require("firebase/firestore").deleteField(),
      assignedRouteIds: arrayRemove(routeId)
    };
    batch.update(studentRef, updates);
  }

  await batch.commit();
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

  const studentData = studentSnap.data() as { routeId?: string, assignedRouteIds?: string[] };
  const requiredBatch = writeBatch(db);

  // Get all routes the student is assigned to
  const routesSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.ROUTES),
      where("studentIds", "array-contains", studentId),
    ),
  );

  routesSnap.forEach((routeDoc) => {
    requiredBatch.update(routeDoc.ref, {
      studentIds: arrayRemove(studentId),
    });
  });

  // Also check legacy routeId just in case they are missing from studentIds array
  // but their routeId field says they belong to a route
  if (studentData.routeId && !routesSnap.docs.some(doc => doc.id === studentData.routeId)) {
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
  const driverRef = doc(db, COLLECTIONS.USERS, driverId);
  const currentDriverSnap = await getDoc(driverRef);

  if (!currentDriverSnap.exists()) {
    throw new Error("Driver not found");
  }

  const currentDriverData = currentDriverSnap.data() as { routeId?: string };
  const batch = writeBatch(db);

  if (currentDriverData.routeId && currentDriverData.routeId !== routeId) {
    const previousRouteRef = doc(
      db,
      COLLECTIONS.ROUTES,
      currentDriverData.routeId,
    );
    batch.update(previousRouteRef, {
      assignedDriverIds: arrayRemove(driverId),
      assignedDriverId: "",
      assignedDriverName: "",
    });
  }

  const currentRouteRef = doc(db, COLLECTIONS.ROUTES, routeId);
  batch.update(currentRouteRef, {
    assignedDriverIds: arrayUnion(driverId),
    assignedDriverId: driverId,
    assignedDriverName: driverName,
  });

  batch.update(driverRef, {
    routeId,
    assignedRouteIds: arrayUnion(routeId),
  });

  await batch.commit();
};

// Assign driver to multiple routes — updates BOTH documents
export const updateDriverRoutes = async (
  driverId: string,
  driverName: string,
  routeIdsToAdd: string[],
  routeIdsToRemove: string[],
  primaryRouteId: string,
  finalRouteIds: string[],
): Promise<void> => {
  const batch = writeBatch(db);

  // Remove from old routes
  for (const routeId of routeIdsToRemove) {
    batch.update(doc(db, COLLECTIONS.ROUTES, routeId), {
      assignedDriverIds: arrayRemove(driverId),
      assignedDriverId: "",
      assignedDriverName: "",
    });
  }

  // Add to new routes
  for (const routeId of routeIdsToAdd) {
    batch.update(doc(db, COLLECTIONS.ROUTES, routeId), {
      assignedDriverIds: arrayUnion(driverId),
      assignedDriverId: driverId,
      assignedDriverName: driverName,
    });
  }

  // Update driver document
  batch.update(doc(db, COLLECTIONS.USERS, driverId), {
    routeId: primaryRouteId,
    assignedRouteIds: finalRouteIds,
  });

  await batch.commit();
};

export const updateRouteDrivers = async (
  routeId: string,
  newDriverIds: string[],
): Promise<void> => {
  console.log("🔵 START updateRouteDrivers", { routeId, newDriverIds });

  const currentRouteRef = doc(db, COLLECTIONS.ROUTES, routeId);
  const currentRouteSnap = await getDoc(currentRouteRef);

  if (!currentRouteSnap.exists()) {
    throw new Error("Route not found");
  }

  const currentRouteData = currentRouteSnap.data() as {
    assignedDriverId?: string;
    assignedDriverIds?: string[];
  };

  const oldDriverIds = getRouteAssignedDriverIds(currentRouteData as never);
  const oldPrimaryDriverId = getRoutePrimaryDriverId(currentRouteData as never);

  const addedDrivers = newDriverIds.filter((id) => !oldDriverIds.includes(id));
  const removedDrivers = oldDriverIds.filter((id) => !newDriverIds.includes(id));

  console.log("📊 Driver changes:", { oldDriverIds, newDriverIds, addedDrivers, removedDrivers });

  const batch = writeBatch(db);

  // ✅ CRITICAL FIX: Update ALL drivers in newDriverIds array
  console.log(`📝 Updating ${newDriverIds.length} drivers with routeId: ${routeId}`);
  for (const driverId of newDriverIds) {
    const driverRef = doc(db, COLLECTIONS.USERS, driverId);
    console.log(`  ✏️ Setting routeId for driver: ${driverId}`);
    batch.update(driverRef, {
      routeId,
      assignedRouteIds: arrayUnion(routeId)
    });
  }

  // Unassign removed drivers
  console.log(`🗑️ Removing ${removedDrivers.length} drivers from route`);
  for (const driverId of removedDrivers) {
    const driverRef = doc(db, COLLECTIONS.USERS, driverId);
    console.log(`  ✏️ Clearing routeId for driver: ${driverId}`);
    batch.update(driverRef, {
      routeId: "",
      assignedRouteIds: arrayRemove(routeId)
    });
  }

  const nextPrimaryDriverId = newDriverIds.includes(oldPrimaryDriverId)
    ? oldPrimaryDriverId
    : newDriverIds[0] || "";

  let combinedDriverNames = "";
  if (newDriverIds.length > 0) {
    const allDriverSnaps = await Promise.all(
      newDriverIds.map((id) => getDoc(doc(db, COLLECTIONS.USERS, id)))
    );
    const names = allDriverSnaps
      .filter((snap) => snap.exists())
      .map((snap) => snap.data().fullName || "Unknown Driver");
    combinedDriverNames = names.join(" & ");
  }

  console.log("🔀 Updating route:", {
    assignedDriverIds: newDriverIds,
    assignedDriverId: nextPrimaryDriverId,
    assignedDriverName: combinedDriverNames
  });

  batch.update(currentRouteRef, {
    assignedDriverIds: newDriverIds,
    assignedDriverId: nextPrimaryDriverId,
    assignedDriverName: combinedDriverNames,
  });

  try {
    console.log("⏳ Committing batch with total operations...");
    await batch.commit();
    console.log("✅ Batch committed successfully!");
  } catch (error) {
    console.error("❌ BATCH COMMIT FAILED:", error);
    throw error;
  }
};


export const removeDriverFromRoute = async (
  driverId: string,
  routeId: string,
): Promise<void> => {
  const batch = writeBatch(db);

  const routeRef = doc(db, COLLECTIONS.ROUTES, routeId);
  batch.update(routeRef, {
    assignedDriverIds: arrayRemove(driverId),
    assignedDriverId: "",
    assignedDriverName: "",
  });

  const driverRef = doc(db, COLLECTIONS.USERS, driverId);
  batch.update(driverRef, {
    routeId: "",
    assignedRouteIds: arrayRemove(routeId),
  });

  await batch.commit();
};

// Delete driver account and clear route/ride/live-location relationships.
export const deleteDriverAccount = async (driverId: string): Promise<void> => {
  const driverRef = doc(db, COLLECTIONS.USERS, driverId);
  const driverSnap = await getDoc(driverRef);

  if (!driverSnap.exists()) {
    return;
  }

  const [routesByArraySnap, legacyRoutesSnap, ridesSnap, liveLocationsSnap, availabilitySnap] =
    await Promise.all([
      getDocs(
        query(
          collection(db, COLLECTIONS.ROUTES),
          where("assignedDriverIds", "array-contains", driverId),
        ),
      ),
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

  const routeDocsById = new Map(
    [...routesByArraySnap.docs, ...legacyRoutesSnap.docs].map((routeDoc) => [
      routeDoc.id,
      routeDoc,
    ]),
  );
  for (const routeDoc of routeDocsById.values()) {
    const routeData = routeDoc.data() as {
      assignedDriverId?: string;
      assignedDriverIds?: string[];
      assignedDriverName?: string;
    };
    const remainingDriverIds = getRouteAssignedDriverIds(routeData as never).filter(
      (assignedDriverId) => assignedDriverId !== driverId,
    );
    const nextPrimaryDriverId = remainingDriverIds[0] || "";
    let nextPrimaryDriverName = "";

    if (nextPrimaryDriverId) {
      const nextPrimarySnap = await getDoc(
        doc(db, COLLECTIONS.USERS, nextPrimaryDriverId),
      );
      if (nextPrimarySnap.exists()) {
        nextPrimaryDriverName =
          (nextPrimarySnap.data() as { fullName?: string }).fullName || "";
      }
    }

    batch.update(routeDoc.ref, {
      assignedDriverIds: arrayRemove(driverId),
      assignedDriverId: nextPrimaryDriverId,
      assignedDriverName: nextPrimaryDriverName,
    });
  }

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
      // NOTE: Here we completely clear because deleteRoute isn't heavily used for multi-route yet. 
      // It's safer to clear it or let the admin reassign if a route is deleted.
      // But ideally we just remove that specific route from routeStops.
      const updates: Record<string, any> = {
        routeId: "",
        pickupStop: "",
        dropStop: "",
        [`routeStops.${routeId}`]: require("firebase/firestore").deleteField(),
        assignedRouteIds: arrayRemove(routeId)
      };
      batch.update(doc(db, COLLECTIONS.USERS, studentDoc.id), updates);
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
