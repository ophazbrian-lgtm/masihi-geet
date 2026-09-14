(() => {
  const button = document.getElementById('googleSignIn');
  const status = document.getElementById('authStatus');
  let busy = false;
  function refresh() {
    const state = mgAuthState();
    button.disabled = !state.ready || !state.canSignIn || busy;
    document.getElementById('signOut').hidden = !state.user;
    status.textContent = state.error || (state.ready ? 'Sign in with Google to continue.' : 'Loading Google sign-in…');
    if (state.admin) location.replace(mgSafeNext(new URLSearchParams(location.search).get('next')));
  }
  button.addEventListener('click', async () => {
    busy = true;
    button.disabled = true;
    let error = '';
    try { await mgSignIn(); } catch (e) { error = e.message; }
    busy = false;
    refresh();
    if (error) status.textContent = error;
  });
  window.addEventListener('mg-auth-change', refresh);
  refresh();
})();
