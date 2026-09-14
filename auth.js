// Google identity is verified by Firebase. This static UI gate is not a backend
// authorization boundary. See AUTH_SETUP.md before adding any remote writes.
(() => {
  let sdk, auth, provider, db, version = 0, expiryTimer;
  let state = { ready: false, canSignIn: false, signingOut: false, owner: false, admin: false, user: null, error: '' };
  let finishReady;
  const ready = new Promise(resolve => { finishReady = resolve; });
  const setupError = 'Google sign-in is not configured yet. Follow AUTH_SETUP.md in the repository.';
  const configured = value => typeof value === 'string' && value.trim() && !value.includes('REPLACE_WITH_');
  try { localStorage.removeItem('masihiGeetAdmin'); } catch (_) { /* Storage may be blocked. */ }

  function publish(next) {
    state = { ...state, ...next };
    window.dispatchEvent(new CustomEvent('mg-auth-change', { detail: { ...state } }));
    if (state.ready) finishReady({ ...state });
  }
  function errorMessage(error) {
    const messages = {
      'auth/popup-closed-by-user': 'Sign-in was cancelled. Try again when you are ready.',
      'auth/cancelled-popup-request': 'A sign-in window is already open.',
      'auth/popup-blocked': 'Allow pop-ups for this site, then try Google sign-in again.',
      'auth/unauthorized-domain': 'This website domain must be added in Firebase Authentication > Settings > Authorized domains.',
      'auth/operation-not-allowed': 'Enable the Google provider in Firebase Authentication.',
      'auth/network-request-failed': 'Could not reach Google sign-in. Check your connection and retry.',
      'auth/web-storage-unsupported': 'Allow browser storage for this website to sign in.',
      'auth/invalid-api-key': setupError,
      'auth/user-disabled': 'This account has been disabled in Firebase.'
    };
    return messages[error?.code] || `Google sign-in is unavailable (${error?.code || error?.message || 'unknown Firebase error'}). Reload and try again.`;
  }
  async function acceptUser(user) {
    const request = ++version;
    clearTimeout(expiryTimer);
    try {
      const token = user ? await user.getIdTokenResult() : null;
      if (request !== version) return;
      const expiresIn = token ? Date.parse(token.expirationTime) - Date.now() : 0;
      const signedInWithGoogle = Boolean(!state.signingOut && user && user.emailVerified &&
        token.claims.email_verified === true && token.signInProvider === 'google.com' && expiresIn > 0);
      const owner = Boolean(signedInWithGoogle && configured(window.MG_OWNER_UID) && user.uid === window.MG_OWNER_UID);
      let assigned = false;
      if (signedInWithGoogle && !owner && db && user.email) {
        try {
          const role = await sdk.getDoc(sdk.doc(db, window.MG_ADMIN_COLLECTION || 'masihiGeetAdmins', user.email.toLowerCase()));
          assigned = role.exists() && role.data().active === true;
        } catch (_) { assigned = false; }
      }
      if (request !== version) return;
      const admin = owner || assigned;
      publish({ ready: true, owner, admin, user, error: user && !admin ?
        'This Google account is not authorized for the dashboard. Ask the site owner to add your Gmail address as an admin.' : '' });
      if (admin) expiryTimer = setTimeout(() => {
        publish({ admin: false, error: 'Your session expired. Please sign in again.' });
      }, Math.min(expiresIn, 2147483647));
    } catch (error) {
      if (request === version) publish({ ready: true, admin: false, user: null, error: errorMessage(error) });
    }
  }

  // Only the two local pages may be used as post-login destinations. Preserve
  // the song selection without permitting open redirects or script URLs.
  window.mgSafeNext = value => {
    try {
      const base = new URL('.', location.href);
      const url = new URL(value || 'admin.html', base);
      if (url.origin !== base.origin || url.username || url.password) return 'admin.html';
      if (url.pathname === base.pathname + 'index.html') return 'index.html';
      if (url.pathname !== base.pathname + 'admin.html') return 'admin.html';
      const song = url.searchParams.get('song');
      return 'admin.html' + (song ? '?song=' + encodeURIComponent(song) : '');
    } catch (_) { return 'admin.html'; }
  };
  window.mgIsAdmin = () => state.admin;
  window.mgIsOwner = () => state.owner;
  window.mgAuthState = () => ({ ...state });
  window.mgAuthReady = ready;
  window.mgSignIn = async () => {
    if (!state.ready || !auth || !provider) throw new Error(state.error || 'Please wait for Google sign-in to load.');
    try {
      // Keep this call directly in the click handler: no pre-popup async work.
      const result = await sdk.signInWithPopup(auth, provider);
      await acceptUser(result.user);
      return state.admin;
    } catch (error) { throw new Error(errorMessage(error)); }
  };
  function normalEmail(value) { return String(value || '').trim().toLowerCase(); }
  window.mgListAdmins = async () => {
    if (!state.owner || !db) throw new Error('Only the site owner can manage admins.');
    const result = await sdk.getDocs(sdk.collection(db, window.MG_ADMIN_COLLECTION || 'masihiGeetAdmins'));
    return result.docs.map(item => ({ email: item.id, ...item.data() })).sort((a,b) => a.email.localeCompare(b.email));
  };
  window.mgGrantAdmin = async email => {
    email = normalEmail(email);
    if (!state.owner || !db) throw new Error('Only the site owner can manage admins.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid Gmail address.');
    await sdk.setDoc(sdk.doc(db, window.MG_ADMIN_COLLECTION || 'masihiGeetAdmins', email),
      { active: true, email, addedAt: sdk.serverTimestamp(), addedBy: state.user.uid });
  };
  window.mgRevokeAdmin = async email => {
    if (!state.owner || !db) throw new Error('Only the site owner can manage admins.');
    await sdk.deleteDoc(sdk.doc(db, window.MG_ADMIN_COLLECTION || 'masihiGeetAdmins', normalEmail(email)));
  };
  window.mgSignOut = async () => {
    ++version;
    clearTimeout(expiryTimer);
    publish({ admin: false, signingOut: true });
    try {
      if (auth) await sdk.signOut(auth);
      publish({ user: null, error: '', signingOut: false });
    } catch (_) {
      // No reload: keep controls closed even if persistence cannot be cleared.
      alert('Sign-out could not finish. Check your connection and click Sign out again.');
    }
  };
  // Prevent a back/forward cache snapshot from retaining a formerly open editor.
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

  async function initialize() {
    const config = window.MG_FIREBASE_CONFIG;
    if (!config || !['apiKey', 'authDomain', 'projectId', 'appId'].every(key => configured(config[key]))) {
      publish({ ready: true, error: setupError });
      return;
    }
    const timeout = setTimeout(() => publish({ ready: true, admin: false,
      error: 'Google sign-in is taking too long. Check your connection and reload.' }), 15000);
    try {
      sdk = await import('./firebase-client.js');
      const app = sdk.initializeApp(config);
      auth = sdk.getAuth(app);
      db = sdk.getFirestore(app);
      await sdk.setPersistence(auth, sdk.browserLocalPersistence);
      provider = new sdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      state.canSignIn = true;
      sdk.onIdTokenChanged(auth, user => {
        clearTimeout(timeout);
        acceptUser(user);
      }, error => {
        ++version;
        clearTimeout(expiryTimer);
        clearTimeout(timeout);
        publish({ ready: true, admin: false, user: null, error: errorMessage(error) });
      });
    } catch (error) {
      clearTimeout(timeout);
      auth = null;
      publish({ ready: true, admin: false, error: errorMessage(error) });
    }
  }
  initialize();
})();
