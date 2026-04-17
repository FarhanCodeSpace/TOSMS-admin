# TOSMS Admin Dashboard

Transport Operations and Safety Management System (TOSMS) admin portal built with Next.js, TypeScript, Tailwind CSS, and Firebase.

## Project Overview

This dashboard is used by school transport administrators to:

- manage routes, rides, drivers, and students
- monitor availability and live tracking data
- verify fee payments and review receipts
- moderate reviews and ratings
- configure company settings and admin account details

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- react-hot-toast

## Setup Instructions

1. Install dependencies:

```bash
npm install
```

2. Add environment variables in `.env.local`.

3. Start development server:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Firebase Setup Steps

1. Create a Firebase project.
2. Enable Authentication with Email/Password provider.
3. Enable Cloud Firestore in production or test mode.
4. Enable Firebase Storage.
5. Add a web app and copy its config values into `.env.local`.
6. Configure Firestore security rules for admin access patterns.
7. Create required collections:

- `users`
- `routes`
- `rides`
- `availability`
- `feePayments`
- `reviews`
- `settings`
- `liveLocations`

## How To Create First Admin Account

1. In Firebase Authentication, create a user with email/password.
2. In Firestore, create a document in `users` using that auth `uid` as the document ID.
3. Add at least the following fields:

```json
{
  "uid": "<same as auth uid>",
  "role": "admin",
  "fullName": "Super Admin",
  "email": "admin@example.com",
  "phone": "",
  "status": "active"
}
```

4. Sign in on `/login` with the same account.

## Deployment Instructions (Vercel)

1. Push repository to GitHub.
2. Import project into Vercel.
3. Set all environment variables in Vercel project settings.
4. Configure Firebase auth domains to include deployed domain.
5. Deploy using Vercel default Next.js settings.

Optional local production test:

```bash
npm run build
npm run start
```

## Useful Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
