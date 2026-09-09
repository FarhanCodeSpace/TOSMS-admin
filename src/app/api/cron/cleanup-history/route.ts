import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/collections";

export const dynamic = "force-dynamic"; // Ensure it's not cached

export async function GET(request: Request) {
  // 1. Authenticate request using Vercel Cron Secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("Unauthorized access attempt to cron cleanup.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    
    // 2. Determine the exact timestamp/date-string for the 1st day of the current month
    const now = new Date();
    // Use UTC to ensure consistency in server environments
    const firstDayOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    
    // Date string for rides (YYYY-MM-DD format)
    const firstDayString = firstDayOfCurrentMonth.toISOString().split("T")[0];
    
    // Timestamp for early ride requests
    const firstDayTimestamp = Timestamp.fromDate(firstDayOfCurrentMonth);

    // 3. Query documents
    console.log(`Starting cleanup for records before ${firstDayString}`);
    
    const ridesSnapshot = await db
      .collection(COLLECTIONS.RIDES)
      .where("date", "<", firstDayString)
      .get();
      
    const earlyRidesSnapshot = await db
      .collection(COLLECTIONS.EARLY_RIDE_REQUESTS)
      .where("createdAt", "<", firstDayTimestamp)
      .get();

    let deletedRidesCount = 0;
    let deletedEarlyRidesCount = 0;

    // 4. Delete documents efficiently using BulkWriter
    if (!ridesSnapshot.empty || !earlyRidesSnapshot.empty) {
      const bulkWriter = db.bulkWriter();
      
      bulkWriter.onWriteError((error) => {
        if (error.failedAttempts < 3) {
          return true; // Retry up to 3 times
        } else {
          console.error("Failed to delete document at: ", error.documentRef.path);
          return false;
        }
      });

      ridesSnapshot.forEach((doc) => {
        bulkWriter.delete(doc.ref);
        deletedRidesCount++;
      });

      earlyRidesSnapshot.forEach((doc) => {
        bulkWriter.delete(doc.ref);
        deletedEarlyRidesCount++;
      });

      await bulkWriter.close();
    }

    console.log(`Cleanup complete. Deleted ${deletedRidesCount} rides and ${deletedEarlyRidesCount} early ride requests.`);

    return NextResponse.json({
      success: true,
      deletedRidesCount,
      deletedEarlyRidesCount,
      cutoffDate: firstDayString,
    });
  } catch (error: any) {
    console.error("Error during history cleanup cron job:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error.message },
      { status: 500 }
    );
  }
}
