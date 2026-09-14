// Run: node --test tests/auth.test.cjs (no packages required).
// Firebase is simulated; real Google OAuth requires the console setup.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness({ configured = true, user = null, sdkFails = false } = {}) {
  const listeners = {}, timers = new Map(), nodes = {}, removed = [];
  let notify, authError, timerId = 0, popupError;
  const node = id => nodes[id] ||= { hidden: true, inert: true, style: {}, value: '', textContent: '',
    children: [], classList: {add(){},remove(){}}, appendChild(child){this.children.push(child)},
    addEventListener(name, fn){ this[name] = fn; }, querySelector(){return node('edit')},
    scrollIntoView(){}, set innerHTML(v){ this.html=v; this.children=[]; }, get innerHTML(){return this.html||'';} };
  const sandbox = {
    URL, URLSearchParams, console, Date, Promise, encodeURIComponent,
    localStorage: { removeItem: key => removed.push(key) },
    location: { href: 'https://ophazbrian-lgtm.github.io/masihi-geet/login.html', search: '', replace(v){this.redirect=v}, reload(){} },
    document: { getElementById: node, querySelectorAll: () => [], createElement: () => node('generated-'+Math.random()),
      createTextNode: text => ({textContent:text}), body: {appendChild(script){sandbox.loadedScript=script}} },
    setTimeout(fn, delay){ timers.set(++timerId,{fn,delay}); return timerId; }, clearTimeout(id){timers.delete(id)},
    CustomEvent: class { constructor(type, opts){this.type=type;this.detail=opts.detail} },
    addEventListener(type, fn){(listeners[type] ||= []).push(fn)},
    dispatchEvent(e){(listeners[e.type]||[]).forEach(fn=>fn(e))},
    alert: message => { sandbox.lastAlert=message; },
    scrollTo(){}
  };
  sandbox.window = sandbox;
  if (configured) {
    sandbox.MG_FIREBASE_CONFIG = { apiKey:'test-key', authDomain:'test.firebaseapp.com', projectId:'test', appId:'test-app' };
    sandbox.MG_ADMIN_UID = 'owner';
  }
  const sdk = { initializeApp: c=>c, getAuth:()=>({}), setPersistence:async()=>{}, browserLocalPersistence:'local',
    GoogleAuthProvider: class {setCustomParameters(){}},
    onIdTokenChanged(a, cb, err){notify=cb;authError=err;cb(user)},
    signInWithPopup:async()=>{if(popupError)throw popupError;return {user}},
    signOut:async()=>{user=null;notify(null)} };
  sandbox.loadFirebase = async()=>{if(sdkFails)throw new Error('offline');return sdk};
  const context = vm.createContext(sandbox);
  vm.runInContext(read('auth.js').replace("import('./firebase-client.js')", 'loadFirebase()'),context);
  return { c:sandbox, context, timers, nodes, removed, node, sdk,
    run: file=>vm.runInContext(read(file),context),
    emit: async value=>{user=value;notify(value);await tick()},
    fail: error=>authError(error), popupFails: code=>{popupError={code}},
    setUser: value=>{user=value} };
}
const owner = overrides => ({uid:'owner',emailVerified:true,
  getIdTokenResult:async()=>({claims:{email_verified:true},signInProvider:'google.com',expirationTime:new Date(Date.now()+3600000).toISOString()}),...overrides});
test('missing configuration fails closed and removes the legacy flag',async()=>{
 const h=harness({configured:false});await h.c.mgAuthReady;
 assert.equal(h.c.mgIsAdmin(),false);assert.match(h.c.mgAuthState().error,/not configured/);
 assert.deepEqual(h.removed,['masihiGeetAdmin']);
 h.run('admin-guard.js');assert.match(h.c.location.redirect,/login.html/);assert.equal(h.node('adminContent').hidden,true);
});
test('only verified configured UID signed in through Google receives controls',async()=>{
 const h=harness({user:owner()});await h.c.mgAuthReady;assert.equal(h.c.mgIsAdmin(),true);
 for(const bad of [owner({uid:'other'}),owner({emailVerified:false}),owner({getIdTokenResult:async()=>({claims:{email_verified:true},signInProvider:'password',expirationTime:new Date(Date.now()+3600000).toISOString()})}),null]) {
  await h.emit(bad);assert.equal(h.c.mgIsAdmin(),false);
 }
 h.c.MG_ADMIN_UID='REPLACE_WITH_YOUR_FIREBASE_USER_UID';await h.emit(owner());assert.equal(h.c.mgIsAdmin(),false);
});
test('token failures, expiry and observer errors close access',async()=>{
 const h=harness({user:owner()});await h.c.mgAuthReady;
 [...h.timers.values()].find(t=>t.delay>15000).fn();assert.equal(h.c.mgIsAdmin(),false);
 await h.emit(owner({getIdTokenResult:async()=>{throw Error('bad token')}}));assert.equal(h.c.mgIsAdmin(),false);
 await h.emit(owner());h.fail({code:'auth/network-request-failed'});assert.equal(h.c.mgIsAdmin(),false);
});
test('stale token result cannot restore a signed-out account',async()=>{
 const h=harness();await h.c.mgAuthReady;
 let resolve;const pending = new Promise(r=>resolve=r);
 h.emit(owner({getIdTokenResult:()=>pending}));await h.emit(null);
 resolve(await owner().getIdTokenResult());await tick();assert.equal(h.c.mgIsAdmin(),false);
});
test('redirect allowlist rejects external, script and sibling destinations',async()=>{
 const h=harness();await h.c.mgAuthReady;
 for(const value of ['https://evil.example','//evil.example','javascript:alert(1)','../admin.html','https://evil.example@ophazbrian-lgtm.github.io/masihi-geet/index.html','/other/index.html']) assert.equal(h.c.mgSafeNext(value),'admin.html');
 assert.equal(h.c.mgSafeNext('admin.html?song=a%26b'),'admin.html?song=a%26b');
 assert.equal(h.c.mgSafeNext('index.html'),'index.html');
});
test('dashboard waits for identity and loads editor only for owner; logout finishes before redirect',async()=>{
 const h=harness();h.c.location.search='?song=test';h.run('admin-guard.js');
 assert.equal(h.c.loadedScript,undefined);await h.c.mgAuthReady;assert.match(h.c.location.redirect,/song%3Dtest/);
 h.c.location.redirect=null;await h.emit(owner());assert.equal(h.c.loadedScript.src,'admin-editor.js');
 assert.equal(h.node('adminContent').hidden,true);h.c.loadedScript.onload();assert.equal(h.node('adminContent').hidden,false);
 let finish;h.sdk.signOut=()=>new Promise(r=>finish=r);
 const logout=h.c.mgSignOut();assert.equal(h.node('adminContent').hidden,true);assert.equal(h.c.location.redirect,null);
 finish();await logout;assert.match(h.c.location.redirect,/login.html/);
});
test('popup failures are readable and login allows retry',async()=>{
 const h=harness();await h.c.mgAuthReady;h.run('login.js');
 h.popupFails('auth/popup-blocked');await h.node('googleSignIn').click();
 assert.match(h.node('authStatus').textContent,/Allow pop-ups/);assert.equal(h.node('googleSignIn').disabled,false);
 h.popupFails('auth/popup-closed-by-user');await assert.rejects(h.c.mgSignIn(),/cancelled/);
});
test('Firebase SDK failure leaves public browsing/search/transposition operational',async()=>{
 const h=harness({sdkFails:true});await h.c.mgAuthReady;assert.equal(h.c.mgIsAdmin(),false);
 h.run('songs.js');const inline=read('index.html').match(/<script>\n([\s\S]*?)<\/script>/)[1];vm.runInContext(inline,h.context);
 assert.ok(h.node('songsGrid').children.length>0);
 h.node('searchInput').value='no-such-song-123';h.c.searchSongs();assert.match(h.node('songsGrid').innerHTML,/No songs/);
 h.node('searchInput').value='Yesu';h.c.searchSongs();assert.ok(h.node('songsGrid').children.length>0);
 vm.runInContext('openSong(songs[0]); transpose(1);',h.context);
 assert.equal(h.c.transposeChord('G'),'G#');h.c.resetTranspose();assert.equal(h.c.transposeChord('G'),'G');
 assert.equal(h.node('adminDashboard').style.display,'none');
});
test('dashboard initializes lexical songs data and respects requested song',async()=>{
 const h=harness({user:owner()});await h.c.mgAuthReady;h.run('songs.js');
 h.c.location.search='?song=yesu-mere-naal-naal-rehnda-hai';
 // Rendering is not under test here; exercise initialization and song selection.
 let source=read('admin-editor.js').replace('renderSongList();if(selected>=0)renderEditor();','');
 vm.runInContext(source,h.context);
 assert.ok(vm.runInContext('data.length',h.context)>0);
 assert.equal(vm.runInContext('data[selected].id',h.context),'yesu-mere-naal-naal-rehnda-hai');
 const exported = JSON.parse(vm.runInContext('JSON.stringify(cleanForExport(data[selected]).lyrics)',h.context));
 assert.equal(exported.length, vm.runInContext('songs[0].lyrics.length',h.context));
 assert.equal(exported[0].text, vm.runInContext('songs[0].lyrics[0].text',h.context));
 assert.deepEqual(exported[0].chords, [{chord:'G',position:0}]);
});
