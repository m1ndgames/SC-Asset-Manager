# Firebase Sync — Setup & Administration Guide

SC Asset Manager is fully functional as a standalone, offline-first app. Firebase sync is **opt-in** — nothing breaks if you never set it up. This guide covers everything needed to get a group sharing a live Firestore database.

---

## How it works

- Each user brings the same Firebase project config into their app via the **Sync** settings page
- Users sign in with an email/password account created inside that Firebase project
- Data is stored per-user under `/users/{uid}/assets` and `/users/{uid}/trades`
- All authenticated members of the project can read each other's records in real time
- Each logged action is attributed to a nickname (never an email address)

---

## Step 1 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**
2. Give it a name (e.g. `my-sc-group`), disable Google Analytics if you don't need it
3. Click **Create project**

---

## Step 2 — Add a web app

1. From the project overview, click the **`</>`** (Web) icon
2. Register the app with any nickname (e.g. `sc-asset-manager`)
3. You will be shown a config snippet like this:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-sc-group.firebaseapp.com",
  projectId: "my-sc-group",
  storageBucket: "my-sc-group.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

Copy the entire block — you will paste it into the app. You can also retrieve it later from **Project Settings → Your apps**.

> **Note:** The `apiKey` in a Firebase web config is not a secret. It identifies your project publicly. Security is enforced entirely by Firestore Security Rules (see Step 4).

---

## Step 3 — Enable Email/Password authentication

1. In the Firebase Console, go to **Authentication → Sign-in method**
2. Click **Email/Password**, enable it, and save

---

## Step 4 — Deploy Firestore Security Rules

The repo includes a `firestore.rules` file. Deploy it once (requires [Firebase CLI](https://firebase.google.com/docs/cli)):

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project <your-project-id>
```

These rules enforce:

| Role | Can do |
|---|---|
| `admin` | Read/write any record, assign/change roles |
| `moderator` | Read/write any user's records |
| `user` | Read/write own records only |

Any authenticated user can read all records (needed for the group view).

---

## Step 5 — Create the first admin user

### 5a — Create the user account

1. Go to **Authentication → Users → Add user**
2. Enter an email and password for the admin account
3. Copy the **User UID** shown in the users list

### 5b — Seed the admin role in Firestore

Firestore security rules prevent non-admins from writing to `/roles` — so the very first admin must be created manually:

1. Go to **Firestore Database → Start collection**
2. Collection ID: `roles`
3. Document ID: *(paste the UID from 5a)*
4. Add a field: `role` → type **string** → value `admin`
5. Save

From this point on, the admin can promote other users via the **Sync → Role Management** panel in the app.

---

## Step 6 — Connect the app

1. Open the app and go to **Sync** in the nav
2. Paste the Firebase config snippet (the full `const firebaseConfig = { … }` block or plain JSON — both work)
3. Click **Save & Connect**
4. Enter your email and password, click **Sign In**
5. Set a **nickname** — this is what appears on records you log (your email is never shown)

Share the config snippet with your group members. They repeat steps 6 onwards with their own accounts.

---

## Adding group members

1. In Firebase Console → **Authentication → Users → Add user**, create an account for each member and give them their credentials out-of-band
2. Each member connects the app using the shared config and their own credentials
3. New members get the `user` role by default
4. The admin can change roles at any time via **Sync → Role Management**

---

## Role reference

| Role | Assign/change roles | Write any user's records | Write own records | Read all records |
|---|:---:|:---:|:---:|:---:|
| `admin` | ✓ | ✓ | ✓ | ✓ |
| `moderator` | — | ✓ | ✓ | ✓ |
| `user` | — | — | ✓ | ✓ |

---

## Local data migration

On first sign-in, if you have existing data in local storage but Firestore is empty, the app will show a banner asking whether to **push** local data to Firebase or **skip** (starting fresh from Firestore). This prompt only appears once.

---

## Disconnecting

Go to **Sync** and click **Disconnect**. Your local data is preserved. The app returns to standalone mode immediately.

---

## Firebase free tier limits (Spark plan)

The free tier is more than sufficient for a small group:

| Resource | Free limit |
|---|---|
| Firestore reads | 50,000 / day |
| Firestore writes | 20,000 / day |
| Firestore storage | 1 GB |
| Auth users | Unlimited |

---

## Firestore data structure

```
/roles
  /{uid}          → { role: "admin" | "moderator" | "user" }

/users
  /{uid}
    /assets
      /{assetId}  → { id, item, amount, buyPrice, location, createdAt, loggedBy? }
    /trades
      /{tradeId}  → { id, assetId, item, amountSold, buyPrice?, sellPrice, sellLocation, soldAt, loggedBy? }
```
