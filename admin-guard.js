(() => {
  const content = document.getElementById('adminContent');
  const status = document.getElementById('authStatus');
  let loading = false, loaded = false;
  function guard() {
    const state = mgAuthState();
    content.hidden = !state.admin || !loaded;
    content.inert = !state.admin || !loaded;
    document.getElementById('signOut').hidden = !state.user;
    if (state.signingOut) return;
    if (!state.ready) return;
    if (!state.admin) {
      const next = mgSafeNext('admin.html' + location.search);
      location.replace('login.html?next=' + encodeURIComponent(next));
      return;
    }
    if (loading) return;
    loading = true;
    const editor = document.createElement('script');
    editor.src = 'admin-editor.js';
    editor.onload = () => { loaded = true; status.hidden = true; guard(); };
    editor.onerror = () => {
      content.hidden = true;
      content.inert = true;
      status.textContent = 'The dashboard could not load. Reload this page to retry.';
    };
    document.body.appendChild(editor);
  }
  window.addEventListener('mg-auth-change', guard);
  guard();
})();
