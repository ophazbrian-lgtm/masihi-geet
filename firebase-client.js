// Pinned Firebase browser modules; no build step or GitHub token required.
export { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
export {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  onIdTokenChanged, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
