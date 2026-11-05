// node tests/sync.test.js — prova d'integració: app.js + sync.js contra un Firebase fals en memòria, amb dos dispositius
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=__dirname+'/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---- Firestore fals compartit (amb la regla m >= m) ---- */
const cloud={docs:{},subs:[]};
function snapFor(col,changed){
  const prefix='usuaris/u1/'+col+'/';
  const docs=Object.keys(cloud.docs).filter(p=>p.startsWith(prefix)).map(p=>mkDoc(p));
  const ch=(changed||Object.keys(cloud.docs).filter(p=>p.startsWith(prefix))).filter(p=>p.startsWith(prefix)).map(p=>({type:'modified',doc:mkDoc(p)}));
  return {metadata:{fromCache:false},docs,docChanges:()=>ch,forEach:f=>docs.forEach(f)};
}
function mkDoc(p){return {id:p.split('/').pop(),ref:{path:p},data:()=>JSON.parse(JSON.stringify(cloud.docs[p])),metadata:{hasPendingWrites:false}}}
function notify(paths){const cols=new Set(paths.map(p=>p.split('/')[2]));cols.forEach(c=>cloud.subs.filter(s=>s.col===c).forEach(s=>setTimeout(()=>s.cb(snapFor(c,paths)),5)))}
function setDoc(p,data){const old=cloud.docs[p];if(old&&typeof old.m==='number'&&typeof data.m==='number'&&data.m<old.m){const e=new Error('denied');e.code='permission-denied';throw e}cloud.docs[p]=JSON.parse(JSON.stringify(data))}
const fakeDb={
  enablePersistence:()=>Promise.resolve(),
  collection:()=>({doc:uid=>({collection:col=>({
    get:async()=>snapFor(col),
    onSnapshot:(opts,cb)=>{const s={col,cb};cloud.subs.push(s);setTimeout(()=>cb(Object.assign(snapFor(col),{docChanges:()=>snapFor(col).docs.map(d=>({type:'added',doc:d}))})),5);return()=>{cloud.subs=cloud.subs.filter(x=>x!==s)}},
    doc:id=>({path:`usuaris/${uid}/${col}/${id}`,set:async d=>{setDoc(`usuaris/${uid}/${col}/${id}`,d);notify([`usuaris/${uid}/${col}/${id}`])}})
  })})}),
  batch:()=>{const ops=[];return {set:(ref,d)=>ops.push(['s',ref.path,d]),delete:ref=>ops.push(['d',ref.path]),commit:async()=>{ops.forEach(o=>{if(o[0]==='s')setDoc(o[1],o[2])});ops.forEach(o=>{if(o[0]==='d')delete cloud.docs[o[1]]});notify(ops.map(o=>o[1]))}}}
};
const user={uid:'u1',email:'a@b.cat',emailVerified:true,reload:async()=>{},sendEmailVerification:async()=>{}};
const fakeFirebase={initializeApp(){},auth:Object.assign(()=>({onAuthStateChanged:cb=>setTimeout(()=>cb(user),5),currentUser:user}),{EmailAuthProvider:{}}),firestore:()=>fakeDb};

/* ---- Dispositiu: DOM de joguina + scripts reals ---- */
function device(){
  const mk=()=>{const f=function(){};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='length')return 0;if(k==='classList')return{add(){},remove(){},toggle(){},contains:()=>false};if(k==='style'||k==='dataset')return t[k]=t[k]||{};if(k==='querySelectorAll')return()=>[];if(k==='then')return undefined;return t[k]!==undefined?t[k]:(['value','textContent','innerHTML'].includes(k)?'':mk())},set:(t,k,v)=>{t[k]=v;return true},apply:()=>mk()})};
  const store={},els={},listeners={};
  const ctx={document:{getElementById:id=>els[id]=els[id]||mk(),querySelector:()=>mk(),querySelectorAll:()=>[],addEventListener(){},createElement:()=>mk(),body:mk(),documentElement:mk(),readyState:'complete',visibilityState:'visible'},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},key:i=>Object.keys(store)[i],get length(){return Object.keys(store).length}},
    sessionStorage:{getItem(){return null},setItem(){}},navigator:{onLine:true},matchMedia:()=>({matches:false,addEventListener(){}}),history:{replaceState(){},pushState(){}},location:{hash:'#home',reload(){}},
    setTimeout,clearTimeout,setInterval:()=>0,CustomEvent:function(t){this.type=t},console,Blob:function(){},URL,Date,JSON,Math,
    firebase:fakeFirebase,FIREBASE_CONFIG:{apiKey:'x'},toast(){}};
  ctx.addEventListener=(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)};
  ctx.dispatchEvent=e=>{(listeners[e.type]||[]).forEach(f=>f(e))};
  ctx.window=ctx;ctx.self=ctx;vm.createContext(ctx);
  for(const f of['ui.js','merge.js','home.js','app.js'])vm.runInContext(fs.readFileSync(root+f,'utf8'),ctx,{filename:f});
  ctx.toast=()=>{};
  vm.runInContext(fs.readFileSync(root+'sync.js','utf8'),ctx,{filename:'js/sync.js'});
  return {ctx,store,get:e=>vm.runInContext(e,ctx),run:e=>vm.runInContext(e,ctx)};
}
const days=d=>Object.keys(d.get('state.registres')).sort();

(async()=>{
  // A: crea dos dies i puja
  const A=device();await sleep(80);
  A.run(`state.registres['2026-03-02']={tipus:'treball',torn:'mati',entrada:'07:00',sortida:'15:00',hores:8};state.registres['2026-03-03']={tipus:'vacances',horesConcepte:7.5};save()`);
  await sleep(1800);
  assert.ok(cloud.docs['usuaris/u1/dies/2026_2026-03-02'],'el dia s\'ha pujat com a document propi');
  assert.ok(cloud.docs['usuaris/u1/dades/config'],'config pujada');
  // B: dispositiu nou → rep els dies d'A
  const B=device();await sleep(150);
  assert.deepStrictEqual(days(B),['2026-03-02','2026-03-03'],'B rep les dades d\'A');
  assert.strictEqual(B.get('calc().worked'),8,'B calcula 8 h (matí) al general');
  assert.strictEqual(B.get('calc().accExtra'),0.5,'0,5 h acumulades');
  // A i B editen dies diferents
  A.run(`state.registres['2026-03-04']={tipus:'treball',torn:'tarda',entrada:'14:30',sortida:'22:00',hores:7.5};save()`);
  B.run(`state.registres['2026-03-05']={tipus:'treball',torn:'nit',entrada:'22:00',sortida:'07:00',hores:9};save()`);
  await sleep(2200);
  assert.deepStrictEqual(days(A),['2026-03-02','2026-03-03','2026-03-04','2026-03-05'],'A té els 4 dies');
  assert.deepStrictEqual(days(B),['2026-03-02','2026-03-03','2026-03-04','2026-03-05'],'B té els 4 dies');
  // esborrat a B es propaga a A
  B.run(`delete state.registres['2026-03-03'];save()`);await sleep(2000);
  assert.ok(!A.get(`state.registres['2026-03-03']`),'l\'esborrat arriba a A');
  // dispositiu C amb dades locals prèvies i el núvol ja ple: conserva el que és seu i rep la resta
  const Cc=device();Cc.run(`state=migrate(Object.assign(defaultState(),{_savedAt:5,registres:{'2025-12-01':{tipus:'vacances',horesConcepte:7.5}}}));`);
  await sleep(150);
  console.log('sync: tots els tests OK');process.exit(0);
})().catch(e=>{console.error('FALLA',e);process.exit(1)});
