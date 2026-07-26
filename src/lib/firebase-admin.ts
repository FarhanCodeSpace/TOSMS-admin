import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function parseServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set (paste the service account JSON as a single-line string)",
    );
  }

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("project_id" in parsed) ||
    !("client_email" in parsed) ||
    !("private_key" in parsed)
  ) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields");
  }

  const account = parsed as {
    project_id: string;
    client_email: string;
    private_key: string;
  };

  return {
    projectId: account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key.replace(/\\n/g, "\n"),
  };
}

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  return initializeApp({
    credential: cert(parseServiceAccount()),
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
