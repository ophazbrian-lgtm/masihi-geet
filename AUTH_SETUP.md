# Set up Google admin sign-in

Public songs, search and transposition work without an account, including while Firebase is unconfigured or unavailable. The old password and `masihiGeetAdmin` browser flag are no longer accepted.

## What this protects

Firebase Authentication verifies the Google identity and manages the session. The interface only opens for the single configured Firebase User UID, with a verified email and a Google sign-in token. Other Google accounts can authenticate with Firebase but do not receive dashboard access.

**GitHub Pages cannot protect static files.** The dashboard HTML/JavaScript, song data and this config remain downloadable. The UID check, hidden buttons and redirects are client-side interface restrictions, which a technical visitor can bypass in their own browser. They do not grant permission to change the live site.

This change adds no remote publishing API or private database. Save still changes only the current dashboard session; Download exports a file that you upload through your authenticated GitHub account. Closing/reloading/signing out loses unexported edits. GitHub permissions remain the actual protection for published songs. This is real hosted authentication, but not a complete server-enforced admin/publishing system.

## 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) with the Google account you want to administer the site.
2. Create a project (or choose your existing project). Analytics is unnecessary for this feature.
3. In Project settings > General, register a **Web app** (`</>`). Firebase Hosting is not needed; the website stays on GitHub Pages.
4. Find the web app's Firebase configuration under SDK setup and configuration.

## 2. Enable Google

1. Open Authentication > Get started (if shown) > Sign-in method.
2. Enable **Google**, select the project support email, and save. No Gmail password goes into this website.
3. In Authentication > Settings > Authorized domains, add **`ophazbrian-lgtm.github.io`** — no `https://` and no `/masihi-geet` path.
4. Keep the default Firebase authentication domain. Add your custom website domain if you later use one. For local testing, explicitly add `localhost`; do not assume it is already authorized.
5. If Google asks you to configure the OAuth consent screen, supply the app/support details. If the OAuth app is in Testing, add your Google account as a test user. Follow any publishing/verification requirements displayed in that console.

The implementation uses a Google popup with an account chooser, avoiding cross-domain redirect storage issues on GitHub Pages. Allow popups and browser storage for this site. Open the site in a regular browser if an embedded browser blocks Google sign-in.

## 3. Fill in the public configuration

Edit `firebase-config.js`. Replace these exact values from **the same Firebase Web app**:

| Setting | Value to copy |
| --- | --- |
| `apiKey` | `apiKey` from the Firebase web configuration |
| `authDomain` | `authDomain`, normally `YOUR_PROJECT_ID.firebaseapp.com` |
| `projectId` | `projectId` |
| `appId` | `appId`, normally `1:...:web:...` |

Keep `authDomain` as the Firebase-provided domain, not the GitHub Pages hostname. Other generated fields such as `storageBucket`, `messagingSenderId` and `measurementId` are not needed by this authentication-only integration.

These web configuration values and the admin UID are public identifiers, not private credentials. **Never commit a service-account JSON, private key, Gmail password or GitHub write token.** Do not create Firestore or Storage in test mode for this feature; neither is required.

Commit the configuration to `main` and wait for GitHub Pages to update. Leave `MG_ADMIN_UID` as its placeholder for the next step. Missing Firebase values disable sign-in with a setup message; a missing UID denies every account dashboard access.

## 4. Authorize only your account

1. Visit [Admin Sign In](https://ophazbrian-lgtm.github.io/masihi-geet/login.html) and click **Continue with Google**. Select your own Google account.
2. You will see an unauthorized message at this stage. This first sign-in creates your user record in Firebase; it does not authorize you automatically.
3. In Firebase Console > Authentication > Users, locate **your exact Google email** and copy its **User UID**. Do not copy the Google numeric profile ID, project ID or another user's UID.
4. Set `window.MG_ADMIN_UID` in `firebase-config.js` to that UID and commit the file to `main`.
5. Once Pages finishes deploying, reload the sign-in page. Your existing Firebase session should open the dashboard. If necessary, sign out and sign in again.

Only this one UID is accepted. No first-user-wins or browser-stored admin flag exists. To change the owner, replace the configured UID with the new owner's verified Google Firebase UID. For a compromised account, disable it in Firebase and replace/remove the UID; existing clients may retain a token until refresh/expiry (typically up to one hour). Browser checks alone cannot guarantee immediate revocation.

## 5. Verify after setup

- In a private window, browse/search songs and transpose chords without signing in.
- Open `admin.html?song=yesu-mere-naal-naal-rehnda-hai` while signed out: it must redirect to sign-in, keeping that song as the destination.
- Sign in as the owner: Dashboard/Edit appear; the requested song opens in the editor.
- Sign in with another Google account: access is denied and the editor remains closed.
- Sign out: Dashboard/Edit disappear, and an open dashboard returns to sign-in. Use a second tab to check session changes there too.
- Cancel/block the popup: a helpful message appears and you can retry. With Firebase blocked or config missing, public browsing still works and the editor stays closed.
- Download an edited song file and inspect it before uploading it to GitHub. Save is not Publish.

The automated regression tests use a simulated Firebase adapter. Actual Google consent, the configured authorized domain and your account cannot be verified until you complete the console steps.

## Before adding one-click publishing

A future hosted backend must verify each Firebase ID token with the Admin SDK, check revocation and the single allowed UID from **server-owned configuration**, and require verified Google sign-in before accepting any write. Keep GitHub credentials only on that backend, validate song payloads and enforce permission on every request. If using Firestore/Storage instead, deploy restrictive Security Rules that enforce the allowed UID server-side. Hidden controls and a browser-supplied UID are never sufficient authorization.

## Reference

- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase CDN module setup](https://firebase.google.com/docs/web/alt-setup)
- [Popup versus redirect considerations](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Verify ID tokens on a backend](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
