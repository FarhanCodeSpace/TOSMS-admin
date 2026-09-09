const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const EARLY_RIDE_COLLECTION = "earlyRideRequests";
const EXPIRY_MINUTES = 15;

exports.expireWaitingEarlyRideRequests = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Karachi",
  },
  async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(
      Date.now() - EXPIRY_MINUTES * 60 * 1000,
    );

    const snapshot = await admin
      .firestore()
      .collection(EARLY_RIDE_COLLECTION)
      .where("status", "==", "waiting")
      .where("createdAt", "<", cutoff)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const batch = admin.firestore().batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "expired",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    return null;
  },
);