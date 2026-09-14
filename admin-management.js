(() => {
  if (!mgIsOwner()) return;
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = '<h3 style="margin:0 0 6px">Admins</h3><p class="hint">Add a Gmail address to let that person sign in and use the Song Dashboard.</p><div class="actions"><input id="newAdminEmail" type="email" placeholder="admin@gmail.com" style="max-width:330px"><button id="addAdmin">Add admin</button></div><div id="adminRoleStatus" class="status"></div><div id="adminList" class="song-list" style="margin-top:12px"></div>';
  document.querySelector('#adminContent main')?.prepend(card);
  const list = card.querySelector('#adminList'), status = card.querySelector('#adminRoleStatus');
  const show = message => { status.textContent = message; status.classList.add('show'); };
  async function render() {
    list.innerHTML = '<div class="hint">Loading admins…</div>';
    try {
      const admins = await mgListAdmins();
      list.innerHTML = admins.length ? '' : '<div class="hint">No additional admins yet.</div>';
      admins.forEach(admin => { const row = document.createElement('div'); row.className='toolbar'; row.innerHTML = '<strong style="flex:1">'+admin.email.replace(/[&<>"]/g,'')+'</strong><button class="danger">Remove</button>'; row.querySelector('button').onclick=async()=>{try{await mgRevokeAdmin(admin.email);show('Admin removed.');render()}catch(e){show(e.message)}}; list.appendChild(row); });
    } catch (_) { list.innerHTML = '<div class="hint">Admin directory is not set up yet. Follow ADMIN_SETUP.md.</div>'; }
  }
  card.querySelector('#addAdmin').onclick = async () => { try { await mgGrantAdmin(card.querySelector('#newAdminEmail').value); card.querySelector('#newAdminEmail').value=''; show('Admin added. They can now sign in with that Gmail.'); render(); } catch (e) { show(e.message); } };
  render();
})();
