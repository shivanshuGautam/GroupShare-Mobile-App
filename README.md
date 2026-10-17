# GroupShare — Android Mobile App & Shared Backend

A secure, mobile-first Group Document Sharing application built with **React Native (Expo SDK 57)** and a shared **Node.js / Express / MongoDB** backend.

---

##  Quick Start Guide

### 1. Start the Backend Server

Open a terminal and navigate to the `server` folder:

```bash
cd server
npm install
npm run dev
```

The server will start on port `5000`:
- **Health Check:** `http://localhost:5000/api/health`
- **Database:** Connects automatically to local MongoDB or MongoDB Atlas via `MONGO_URI`. If MongoDB is not running, it gracefully falls back to an in-memory/local JSON store for instant demo testing!

---

### 2. Start the Mobile Client (Expo)

Open a second terminal and navigate to the `client` folder:

```bash
cd client
npx expo start
```

#### How to Run on Android:
- **Physical Android Phone:**
  1. Install the free **Expo Go** app from Google Play Store.
  2. Ensure your phone and PC are on the **same Wi-Fi network**.
  3. Scan the QR code displayed in your terminal using Expo Go.
  4. In the mobile app's **Profile** tab, you can set the backend URL to your PC's local IP (e.g., `http://192.168.1.X:5000`).
- **Android Emulator:**
  1. Press `a` in the terminal to launch the Android emulator.
  2. The app automatically communicates with the server via `http://10.0.2.2:5000`.

---

##  Demo & Test Credentials

You can use the built-in demo credentials for instant testing:
- **Admin Email:** `admin@groupshare.local`
- **Password:** `password123`
- Or tap the **"One-Tap Demo Login (Admin)"** button on the sign-in screen.

When creating a new account:
- Enter your details (name, email, password, phone, role, department, bio).
- A 6-digit confirmation code is generated and displayed in the terminal console and on-screen for seamless verification during testing.

---

##  Features Implemented

1. **Clean, Modern Mobile UI:**
   - Designed with an Indigo/Slate theme, rounded cards, badge chips, and smooth tabs.
2. **Authentication & Email Verification:**
   - Secure registration, 6-digit email confirmation code, password hashing with `bcryptjs`, and JWT tokens.
3. **6 Basic Profile Fields:**
   - Full Name, Email, Phone Number, Job Title / Role, Department, and Bio (viewable and editable).
4. **Group Management & Roles:**
   - Users can create groups and automatically become **Admins**.
   - Admins can invite new or existing members by email.
   - Members can also create their own independent groups and be Admins of those groups.
5. **Document Uploads & Permissions:**
   - Supports **PDF**, **JPEG/JPG**, and **DOCX** documents.
   - Granular access controls:
     - `All Members`: all group members can view and download.
     - `Admins Only`: restricted exclusively to group administrators.
   - In-app file viewer and native Android sharing (`expo-sharing`).
6. **Upload & Activity Notifications:**
   - Automatically dispatches in-app notifications to all group members whenever a document is uploaded.
   - Unread badge counter on top header and bottom navigation bar.
7. **Local Storage Fallback (Demo Mode):**
   - Implements `@react-native-async-storage/async-storage` for caching and offline demo operation.
8. **Android APK/AAB Ready:**
   - Configured with `android.package` (`com.groupshare.mobile`), version codes, and storage/notification permissions.
   - `eas.json` configured for APK (`preview` profile) and Google Play Store AAB (`production` profile).

---

##  Building Standalone Android APK & AAB

To generate an installable Android APK without Google Play:

```bash
cd client
npx eas-cli build --platform android --profile preview
```

To generate a Google Play Store App Bundle (`.aab`):

```bash
cd client
npx eas-cli build --platform android --profile production
```
