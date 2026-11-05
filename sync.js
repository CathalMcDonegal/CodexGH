/* Codex GH — comptes d'usuari + sincronització entre dispositius (Firebase Auth + Firestore), versió 2.4.
   Sincronització per element (config, un doc per dia, un per judici, un per any antic) amb fusió pel segell «m»:
   si edites dies diferents en dos dispositius es fusionen; si edites el mateix dia guanya l'última modificació.
   Dades a codex/{uid}/{dades|anys|dies|judicis}/…  (veure SYNC.md per a les regles de Firestore). */
(function(){
'use strict';
const API=window.RHSync={};
const cfg=window.FIREBASE_CONFIG||{};
const configured=!!cfg.apiKey&&!/^PEGA/.test(cfg.apiKey);
const OWNER_KEY=KEY+'.owner',META_KEY=KEY+'.syncmeta',BK_PREFIX='codexGHSyncBackup-';
const COLS=['dades','anys','dies','judicis'];
const $=id=>document.getElementById(id);
const hasSDK=typeof firebase!=='undefined'&&firebase.auth&&firebase.firestore;

function lockErr(t){const e=$('lockError');if(e)e.textContent=t||''}
function hideLock(){$('lockScreen')?.classList.add('hidden')}
function showLock(){$('lockScreen')?.classList.remove('hidden')}
function setStatus(t){const e=$('syncStatus');if(e)e.textContent=t}
function authMsg(e){
  const m={'auth/invalid-credential':'Correu o contrasenya incorrectes','auth/wrong-password':'Contrasenya incorrecta','auth/user-not-found':'No existeix cap compte amb aquest correu','auth/invalid-email':'Correu no vàlid','auth/email-already-in-use':'Aquest correu ja té un compte. Prem «Entrar».','auth/weak-password':'La contrasenya ha de tenir almenys 8 caràcters','auth/network-request-failed':'Sense connexió','auth/too-many-requests':'Massa intents. Torna-ho a provar d\'aquí una estona'};
  return m[e&&e.code]||('Error: '+((e&&(e.code||e.message))||''));
}

if(!configured){
  // Mode local (sense Firebase): l'app funciona sense compte ni sincronització.
  API.configured=false;API.login=API.register=API.reset=API.logout=API.syncNow=API.resendVerify=API.deleteAccount=()=>{};
  return;
}
API.configured=true;

if(!hasSDK){
  // Sense carregar l'SDK (p. ex. primer ús sense connexió): si ja hi havia un compte en aquest dispositiu, deixa entrar en local.
  if(localStorage.getItem(OWNER_KEY)){hideLock()}else{lockErr('Cal connexió per iniciar sessió la primera vegada.')}
  API.login=API.register=API.reset=API.logout=API.syncNow=API.resendVerify=API.deleteAccount=()=>{};
  return;
}

// App Firebase amb nom propi: sessió i caché separades de l'app antiga (mateix origen). Dades a l'arrel «codex».
const fbApp=firebase.initializeApp(cfg,'codex-gh');
const auth=fbApp.auth(),db=fbApp.firestore();
try{db.enablePersistence({synchronizeTabs:true}).catch(()=>{})}catch(e){}

let uid=null,base=null,unsubs=[],meta={},ready=false,applying=false;
let pushTimer=null,pushing=false,pushAgain=false,failCount=0,lastResolve=0,initTimer=null;
let first={},remoteInit={},legacyDoc=null;

/* ---------- Comptes ---------- */
function creds(){
  const email=($('lockEmail')?.value||'').trim(),pass=$('lockInput')?.value||'';
  if(!email||!pass){lockErr('Escriu el correu i la contrasenya');return null}
  return {email,pass};
}
API.login=async function(){const c=creds();if(!c)return;lockErr('');try{await auth.signInWithEmailAndPassword(c.email,c.pass)}catch(e){lockErr(authMsg(e))}};
API.register=async function(){
  const c=creds();if(!c)return;lockErr('');
  if(c.pass.length<8){lockErr(authMsg({code:'auth/weak-password'}));return}
  try{const cr=await auth.createUserWithEmailAndPassword(c.email,c.pass);try{await cr.user.sendEmailVerification()}catch(e){}}catch(e){lockErr(authMsg(e))}
};
API.reset=async function(){
  const email=($('lockEmail')?.value||'').trim();if(!email){lockErr('Escriu primer el teu correu');return}
  try{await auth.sendPasswordResetEmail(email);lockErr('T\'hem enviat un correu per restablir la contrasenya')}catch(e){lockErr(authMsg(e))}
};
API.resendVerify=async function(){
  const u=auth.currentUser;if(!u)return;
  try{await u.sendEmailVerification();toast('Correu de verificació enviat')}catch(e){toast('No s\'ha pogut enviar (massa intents?)')}
};
function showVerify(user){
  const r=$('verifyRow');if(!r)return;
  r.style.display=user&&!user.emailVerified?'flex':'none';
}

/* ---------- Metadades i còpies locals ---------- */
function loadMeta(){try{const m=JSON.parse(localStorage.getItem(META_KEY));meta=(m&&m.v===2&&m.k)?m.k:{}}catch(e){meta={}}}
function saveMeta(){try{localStorage.setItem(META_KEY,JSON.stringify({v:2,k:meta}))}catch(e){}}
function backupLocal(){
  try{
    const raw=localStorage.getItem(KEY);if(!raw)return;
    localStorage.setItem(BK_PREFIX+Date.now(),raw);
    const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(BK_PREFIX))ks.push(k)}
    ks.sort().slice(0,-3).forEach(k=>localStorage.removeItem(k));
  }catch(e){}
}
function stamp(ms){return new Date(ms).toLocaleTimeString('ca',{hour:'2-digit',minute:'2-digit'})}
function okStatus(){setStatus('Sincronitzat ✓ '+stamp(Date.now()))}

/* ---------- Estat ⇄ elements ---------- */
function trackLocal(){
  const items=RHMerge.flatten(state);
  RHMerge.detectLocal(items,meta,Date.now());saveMeta();
  return items;
}
function rebuild(items,changed){
  const st=RHMerge.inflate(items);if(!st)return;
  st._savedAt=Date.now();
  applying=true;try{applyRemoteState(st)}finally{applying=false}
  // Els canvis que fa migrate() en aplicar-los no compten com a edició local
  const now=RHMerge.flatten(state);
  changed.forEach(k=>{if(meta[k]&&!meta[k].del&&now[k])meta[k].h=RHMerge.hash(now[k].json)});
  saveMeta();
}
function docToRemote(col,d){
  const k=RHMerge.keyFor(col,d.id),x=d.data();
  if(!k||!x||typeof x.m!=='number')return null;
  return {key:k,m:x.m,del:!!x.d,json:x.j||''};
}
async function pullAll(){
  const docs=[];
  for(const col of COLS){
    const snap=await base.collection(col).get({source:'server'});
    snap.forEach(d=>{const r=docToRemote(col,d);if(r)docs.push(r)});
  }
  return docs;
}

/* ---------- Pujada ---------- */
function schedulePush(){
  if(!uid||applying)return;
  trackLocal();
  if(!ready)return;
  clearTimeout(pushTimer);pushTimer=setTimeout(push,1200);setStatus('Pendent de sincronitzar…');
}
async function push(){
  if(!ready||!base)return;
  if(pushing){pushAgain=true;return}
  pushing=true;
  try{
    const items=trackLocal(),keys=RHMerge.pending(meta);
    if(!keys.length){okStatus();failCount=0;return}
    const sent={};
    for(let i=0;i<keys.length;i+=400){
      const chunk=keys.slice(i,i+400),batch=db.batch();
      chunk.forEach(k=>{const r=RHMerge.refFor(k);if(!r)return;batch.set(base.collection(r.col).doc(r.id),RHMerge.payload(k,items,meta));sent[k]=meta[k].m});
      await batch.commit();
      chunk.forEach(k=>{if(meta[k]&&meta[k].m===sent[k])meta[k].p=0});saveMeta();
    }
    failCount=0;okStatus();
  }catch(e){
    if(e&&e.code==='permission-denied')await resolveConflicts();
    else setStatus('Sense connexió — els canvis es guarden en local');
  }finally{
    pushing=false;
    if(pushAgain){pushAgain=false;schedulePush()}
  }
}
/* Una escriptura rebutjada per les regles (element més antic que el del núvol): es baixa l'estat del servidor i es fusiona. */
async function resolveConflicts(){
  failCount++;
  if(failCount>3){setStatus('Error de sincronització — revisa les regles de Firestore (SYNC.md)');return}
  if(Date.now()-lastResolve<5000)return;
  lastResolve=Date.now();
  try{
    const docs=await pullAll();
    const items=trackLocal(),res=RHMerge.applyRemote(items,meta,docs);
    if(res.overwrotePending)backupLocal();
    if(res.changed.length){rebuild(items,res.changed);toast('Dades sincronitzades')}
    saveMeta();schedulePush();
  }catch(e){setStatus('Sense connexió — els canvis es guarden en local')}
}

/* ---------- Escolta del núvol ---------- */
function onRemoteDocs(docs){
  if(!ready||!docs.length)return;
  const items=trackLocal(),res=RHMerge.applyRemote(items,meta,docs);
  if(res.overwrotePending)backupLocal();
  if(res.changed.length){rebuild(items,res.changed);toast('Dades sincronitzades')}
  saveMeta();
  if(RHMerge.pending(meta).length)schedulePush();else okStatus();
}
function initialMerge(){
  clearTimeout(initTimer);
  const remote={},real={};
  COLS.forEach(c=>remoteInit[c].forEach(d=>{remote[d.key]={m:d.m,del:d.del,json:d.json};real[d.key]=1}));
  let legacy={};
  if(!remote['c|main']&&legacyDoc){legacy=RHMerge.legacyToRemote(legacyDoc,migrate);Object.assign(remote,legacy)}
  if(!Object.keys(meta).length&&Object.keys(state.registres||{}).length)backupLocal(); // primera sincronització amb dades locals prèvies
  const items=RHMerge.flatten(state),res=RHMerge.initialMerge(items,meta,remote,Date.now(),Number(state._savedAt)||0);
  // Dades que només existien al document únic antic: s'han de copiar a l'estructura nova
  Object.keys(legacy).forEach(k=>{if(!real[k]&&meta[k])meta[k].p=1});
  if(res.overwrotePending)backupLocal();
  if(res.changed.length)rebuild(items,res.changed);else saveMeta();
  ready=true;
  if(RHMerge.pending(meta).length){schedulePush()}else okStatus();
}
function startListeners(){
  stopListeners();first={};remoteInit={};legacyDoc=null;ready=false;
  initTimer=setTimeout(()=>{if(!ready)setStatus('Sense connexió — els canvis es guarden en local')},8000);
  COLS.forEach(col=>{
    const unsub=base.collection(col).onSnapshot({includeMetadataChanges:true},snap=>{
      const docs=[];
      const take=d=>{if(d.metadata.hasPendingWrites)return;const r=docToRemote(col,d);if(r)docs.push(r)};
      if(!first[col]){
        if(snap.metadata.fromCache)return; // la fusió inicial només es fa amb dades del servidor
        snap.docs.forEach(take);
        if(col==='dades'){const l=snap.docs.find(d=>d.id==='estat');if(l){const x=l.data();if(x&&x.json)legacyDoc={json:x.json,savedAt:x.savedAt}}}
        first[col]=true;remoteInit[col]=docs;
        if(COLS.every(c=>first[c]))initialMerge();
      }else{
        snap.docChanges().forEach(c=>{if(c.type!=='removed')take(c.doc)});
        onRemoteDocs(docs);
      }
    },()=>{setStatus('Sense connexió — els canvis es guarden en local')});
    unsubs.push(unsub);
  });
}
function stopListeners(){unsubs.forEach(u=>{try{u()}catch(e){}});unsubs=[];clearTimeout(initTimer)}

API.syncNow=async function(){
  if(!uid||!base)return;
  failCount=0;setStatus('Sincronitzant…');
  try{
    const docs=await pullAll();
    if(!ready){
      COLS.forEach(c=>{remoteInit[c]=docs.filter(d=>RHMerge.refFor(d.key).col===c);first[c]=true});
      initialMerge();
    }else onRemoteDocs(docs);
    await push();
  }catch(e){setStatus('Sense connexió — els canvis es guarden en local')}
};

window.addEventListener('rh:saved',schedulePush);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&pushTimer){clearTimeout(pushTimer);pushTimer=null;push()}});
window.addEventListener('online',()=>{if(uid)API.syncNow()});

API.logout=async function(){
  if(!await uiConfirm('Tancar sessió? Les dades es queden al teu compte i es tornaran a carregar en entrar.',{ok:'Tancar sessió'}))return;
  clearTimeout(pushTimer);
  if(navigator.onLine&&ready)await Promise.race([push(),new Promise(r=>setTimeout(r,4000))]);
  if(RHMerge.pending(meta).length&&!await uiConfirm('Hi ha canvis sense sincronitzar que es perdran. Tancar sessió igualment?',{ok:'Tancar igualment',danger:true}))return;
  stopListeners();
  const rm=[KEY,KEY+'.latest',OWNER_KEY,META_KEY,KEY+'.lastSynced'];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&(k.startsWith('codexGHDailyBackup-')||k.startsWith(BK_PREFIX)))rm.push(k)}
  rm.forEach(k=>localStorage.removeItem(k));
  await auth.signOut();location.reload();
};

/* Eliminar compte: reautentica, esborra tots els documents del núvol i després el compte. Les dades locals també s'esborren. */
API.deleteAccount=async function(){
  const user=auth.currentUser;if(!user||!base)return;
  if(!await uiConfirm('S\'eliminarà el teu compte i TOTES les dades del núvol (registres, judicis, configuració). Aquest dispositiu també es buidarà. No es pot desfer. Si vols conservar-les, exporta abans una còpia JSON.',{title:'Eliminar compte i dades',ok:'Continuar',danger:true}))return;
  const v=await uiForm('Confirma la contrasenya',[{id:'pass',label:'Contrasenya',type:'password',value:''}],{ok:'Eliminar tot'});
  if(!v||!v.pass)return;
  try{
    await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,v.pass));
  }catch(e){await uiAlert(authMsg(e));return}
  setStatus('Eliminant…');
  try{
    stopListeners();clearTimeout(pushTimer);ready=false;
    for(const col of COLS){
      const snap=await base.collection(col).get({source:'server'});
      for(let i=0;i<snap.docs.length;i+=400){const b=db.batch();snap.docs.slice(i,i+400).forEach(d=>b.delete(d.ref));await b.commit()}
    }
    await user.delete();
  }catch(e){setStatus('No s\'ha pogut eliminar: '+((e&&e.code)||'error'));await uiAlert('No s\'ha pogut eliminar tot ('+((e&&e.code)||'error')+'). Torna-ho a provar amb connexió.');startListeners();return}
  const rm=[KEY,KEY+'.latest',OWNER_KEY,META_KEY,KEY+'.lastSynced'];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&(k.startsWith('codexGHDailyBackup-')||k.startsWith(BK_PREFIX)))rm.push(k)}
  rm.forEach(k=>localStorage.removeItem(k));
  location.reload();
};

auth.onAuthStateChanged(user=>{
  if(!user){
    stopListeners();ready=false;uid=null;base=null;meta={};
    $('accountCard')&&($('accountCard').style.display='none');showLock();return;
  }
  uid=user.uid;
  base=db.collection('codex').doc(uid);
  // Aïllament: si aquest navegador tenia dades d'un altre compte, es guarden a part i no es barregen.
  const owner=localStorage.getItem(OWNER_KEY);
  if(owner&&owner!==uid){
    backupLocal();
    [KEY,KEY+'.latest',META_KEY,KEY+'.lastSynced'].forEach(k=>localStorage.removeItem(k));
    state=defaultState();renderAll();
  }
  localStorage.setItem(OWNER_KEY,uid);
  loadMeta();
  const em=$('syncEmail');if(em)em.textContent=user.email||'—';
  const card=$('accountCard');if(card)card.style.display='';
  showVerify(user);user.reload().then(()=>showVerify(auth.currentUser)).catch(()=>{});
  lockErr('');const li=$('lockInput');if(li)li.value='';
  hideLock();
  setStatus('Sincronitzant…');
  startListeners();
});
})();
