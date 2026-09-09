import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent duplicate initialization
const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

let dbInstance: any;

if (typeof window !== "undefined") {
  // Disable persistence in development to avoid IndexedDB corruption during Next.js Hot Reloads
  if (isNewApp && process.env.NODE_ENV !== "development") {
    try {
      dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (error: any) {
      console.warn("Failed to initialize Firestore with persistence:", error);
      dbInstance = getFirestore(app);
    }
  } else {
    // In development or during HMR, just use memory cache to avoid lock errors
    dbInstance = getFirestore(app);
  }
} else {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const storage = getStorage(app);

if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(console.error);
}

export default app;
