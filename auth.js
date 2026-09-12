// Masihi Geet — lightweight admin sign-in helper.
// NOTE: This is a client-side convenience gate, not server-side security.
const MASIHI_ADMIN_HASH = "94df5b69590b4aed3adff8f0dcd69aacfcace7a869ed5883f371d15fb3856070";

async function mgHash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function mgIsAdmin() {
  return localStorage.getItem("masihiGeetAdmin") === "1";
}

function mgSignOut() {
  localStorage.removeItem("masihiGeetAdmin");
  window.location.reload();
}

async function mgSignIn(password) {
  const ok = (await mgHash(password)) === MASIHI_ADMIN_HASH;
  if (ok) localStorage.setItem("masihiGeetAdmin", "1");
  return ok;
}

function mgAdminControls() {
  const signedIn = mgIsAdmin();
  document.querySelectorAll("[data-admin-only]").forEach(el => {
    el.style.display = signedIn ? "" : "none";
  });
  document.querySelectorAll("[data-admin-signin]").forEach(el => {
    el.style.display = signedIn ? "none" : "";
  });
  document.querySelectorAll("[data-admin-signed-in]").forEach(el => {
    el.style.display = signedIn ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", mgAdminControls);
