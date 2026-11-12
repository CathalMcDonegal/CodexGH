// Codex GH 2.3 – + pestanya Permisos (cerca llicències PDF nov 2025)
const KEY="codexGH";
const APP_VERSION="2.12.8";
const MONTHS=["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
const DOW=["Dg","Dl","Dt","Dc","Dj","Dv","Ds"];
const TYPE_NAMES={treball:"Treball",vacances:"Vacances",assumptes:"Assumptes personals",dies_blaus:"Dies Blaus",baixa:"Baixa",guardia_np:"Guàrdia No Presencial",hores_acum:"Hores acumulades",hores_extres:"Hores extres",altres:"Permís per hores",altres_general:"Altres"};
const TYPE_COLORS={vacances:"#bbf7d0",assumptes:"#22c55e",dies_blaus:"#16a34a",baixa:"#fffafa",guardia_np:"#86efac",hores_acum:"#4ade80",hores_extres:"#fde047",altres:"#86efac",altres_general:"#fdba74"};
const DEFAULT_SHIFTS=[
{id:"mati",nom:"Matí",abbr:"M",hores:7.5,inici:"07:00",fi:"15:00",color:"#f4d35e"},
{id:"tarda",nom:"Tarda",abbr:"T",hores:7.5,inici:"14:30",fi:"22:00",color:"#f59e0b"},
{id:"nit",nom:"Nit",abbr:"N",hores:9,inici:"22:00",fi:"07:00",color:"#60a5fa"},
{id:"cs_dia",nom:"Cap de setmana Dia",abbr:"Dia 12h",hores:12,inici:"07:00",fi:"19:00",color:"#fffdf0"},
{id:"cs_nit",nom:"Cap de setmana Nit",abbr:"Nit 12h",hores:12,inici:"19:00",fi:"07:00",color:"#6366f1"},
{id:"fd",nom:"Festiu Dia",abbr:"FD 12h",hores:12,inici:"07:00",fi:"19:00",color:"#fffaf0"},
{id:"fn",nom:"Festiu Nit",abbr:"FN 12h",hores:12,inici:"19:00",fi:"07:00",color:"#312e81"},
{id:"festa",nom:"Festa",abbr:"Festa",hores:7.5,inici:"07:00",fi:"15:00",color:"#4ade80"}
];
/* Torns fixos: horari marc. El matí té marc de 7,5 h (07:00–14:30) però per defecte es fan 8 h (07:00–15:00). */
const FIXED_SHIFTS={
 mati:{nom:"Matí",abbr:"M",hores:7.5,inici:"07:00",fi:"15:00"},
 tarda:{nom:"Tarda",abbr:"T",hores:7.5,inici:"14:30",fi:"22:00"},
 nit:{nom:"Nit",abbr:"N",hores:9,inici:"22:00",fi:"07:00"},
 cs_dia:{nom:"Cap de setmana Dia",abbr:"Dia 12h",hores:12,inici:"07:00",fi:"19:00"},
 cs_nit:{nom:"Cap de setmana Nit",abbr:"Nit 12h",hores:12,inici:"19:00",fi:"07:00"}
};
const DEFAULT_HOLIDAYS={"2026-01-01":"Cap d'Any","2026-01-06":"Reis","2026-04-03":"Divendres Sant","2026-04-06":"Dilluns de Pasqua","2026-05-01":"Festa del Treball","2026-06-24":"Sant Joan","2026-08-15":"Assumpció","2026-09-11":"Diada Nacional CAT","2026-09-24":"La Mercè","2026-10-12":"Dia Nacional Espanya","2026-12-08":"Immaculada","2026-12-25":"Nadal","2026-12-26":"Sant Esteve","2027-01-01":"Cap d'Any","2027-01-06":"Reis"};

let state=defaultState(), currentMonth=new Date(), weekAnchor=startOfWeek(new Date()), selected=new Set(), multi=false, editingDay=null, editingTrial=null, trialDateFilter="", deferredPrompt=null;
let shiftSimulations=[]; // Memòria temporal: mai no es desa ni entra al còmput real.

function defaultState(){return {titol:"Codex GH",subtitol:"Personal",tip:"",darkMode:"auto",notifyDaily:false,anyInici:2026,horesAnuals:1580,vacancesTotals:200,assumptesTotals:68,blausTotals:0,gnpTotals:0,gnitTotals:0,acumTotals:0,torns:clone(DEFAULT_SHIFTS),festius:clone(DEFAULT_HOLIDAYS),registres:{},judicis:[],historic:{}}}
function clone(x){return JSON.parse(JSON.stringify(x))}
function pad(n){return String(n).padStart(2,"0")}
function key(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseKey(k){return new Date(k+"T12:00:00")}
function todayKey(){return key(new Date())}
function startOfWeek(d){const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()-(day===0?6:day-1));x.setHours(12,0,0,0);return x}
function fmtHours(h){h=Number(h)||0;const sign=h<0?"-":"+";h=Math.abs(h);const hr=Math.floor(h+1e-9), min=Math.round((h-hr)*60);return `${sign}${hr}:${pad(min)}`}
function plainHours(h){h=Number(h)||0;const hr=Math.floor(h+1e-9),min=Math.round((h-hr)*60);return `${hr}:${pad(min)}`}
function num(h){return Number((Number(h)||0).toFixed(2))}
function isWeekend(d){return d.getDay()===0||d.getDay()===6}
function getShift(id){return state.torns.find(t=>t.id===id)||state.torns[0]}
function isNightShift(s){const n=(s?.nom||"").toLowerCase();return ["nit","cs_nit","fn"].includes(s?.id)||n.includes("nit")}
function isMorning(s){return s?.id==="mati"||(s?.nom||"").toLowerCase().includes("matí")||(s?.nom||"").toLowerCase().includes("mati")}
function defaultShiftHours(s){return isMorning(s)?8:Number(s?.hores)||7.5}
/* Hores transcorregudes entre entrada i sortida (passa de mitjanit si sortida<entrada); null si no són vàlides */
function elapsedHours(a,b){const x=timeToMin(a),y=timeToMin(b);if(x===null||y===null)return null;let d=y-x;if(d<0)d+=1440;return d/60}
/* Hores que compta un registre de treball (única font de veritat). Matí: mai menys de 8 h (marc 7,5 + 0,5 que va a acumulades). */
function recordHours(r,s){
  let hr=elapsedHours(r?.entrada,r?.sortida);
  if(hr===null)hr=Number(r?.hores);
  if(!Number.isFinite(hr)||hr<=0)hr=defaultShiftHours(s);
  if(isMorning(s)&&r?.torn!=="festa"&&hr<=7.5)hr=8;
  return hr;
}
function shiftBase(s){return isMorning(s)?7.5:Number(s?.hores)||0}
/* Minuts des de 00:00; torns que passen de mitjanit: fi < inici */
function timeToMin(t){if(!t||!/^\d{1,2}:\d{2}$/.test(t))return null;const[h,m]=t.split(":").map(Number);return h*60+m}
/** Hores de nit estrictes: solapament amb [22:00, 06:00] (8 h de finestra, creua mitjanit). */
function nightHoursInRange(startStr,endStr){
  let a=timeToMin(startStr),b=timeToMin(endStr);
  if(a===null||b===null)return 0;
  if(b<=a)b+=24*60; // creua mitjanit
  // Finestra nit: 22:00 dia0 → 06:00 dia1 (= 30*60)
  const winA=22*60, winB=30*60;
  const lo=Math.max(a,winA), hi=Math.min(b,winB);
  const mins=Math.max(0,hi-lo);
  // També si el torn comença després de mitjanit dins 00:00-06:00 (a ja normalitzat 0-24h sense +24)
  // Cobrim cas entrada 00:xx-06:xx sense haver posat 22h
  let mins2=0;
  if(a<6*60 && b>a && a<22*60){
    const lo2=Math.max(a,0), hi2=Math.min(b,6*60);
    mins2=Math.max(0,hi2-lo2);
  }
  // Evitar doble comptatge: si ja hem capturat via +24, mins2 sol ser 0
  const total=mins>0?mins:mins2;
  return num(total/60);
}
function nightHoursForRecord(r,s){
  const start=r.entrada||s?.inici||"";
  const end=r.sortida||s?.fi||"";
  let nh=nightHoursInRange(start,end);
  // Si no hi ha hores calculables però és torn de nit conegut, usar taula estàndard
  if(nh<=0 && isNightShift(s)){
    if(s.id==="nit") nh=8;          // 22-07 → 22-06 = 8h nit
    else if(s.id==="cs_nit"||s.id==="fn") nh=8; // 19-07 → 22-06 = 8h nit
    else nh=8;
  }
  // No superar les hores totals del registre
  const hr=recordHours(r,s);
  return num(Math.min(nh,hr));
}
function holiday(d){return !!state.festius[key(d)]}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function migrate(raw){
  const base=defaultState();
  if(!raw||typeof raw!=="object") return base;
  const out={...base,...raw};
  out.torns=Array.isArray(raw.torns)&&raw.torns.length?raw.torns:clone(DEFAULT_SHIFTS);
  out.registres=raw.registres||{};out.judicis=raw.judicis||[];out.historic=raw.historic||{};
  out.festius=raw.festius||clone(DEFAULT_HOLIDAYS); const defaultColors={mati:"#38bdf8",tarda:"#fb923c",nit:"#7c3aed",cs_dia:"#eab308",cs_nit:"#14b8a6",fd:"#f472b6",fn:"#1e3a8a",festa:"#4ade80"},legacyColors={mati:"#f4d35e",tarda:"#f59e0b",nit:"#60a5fa",cs_dia:"#fff4a8",cs_nit:"#6366f1",fd:"#ffe8b8",fn:"#312e81"}; out.torns.forEach(t=>{if(!t.color||["#facc15","#22c55e","#16a34a","#94a3b8"].includes(t.color)||(legacyColors[t.id]&&String(t.color).toLowerCase()===legacyColors[t.id]))t.color=defaultColors[t.id]||t.color||"#93c5fd"});
  if(out.titol==="Registre Horari")out.titol="Codex GH"; // canvi de nom de l'app
  out.blausTotals=raw.blausTotals??base.blausTotals;out.gnpTotals=raw.gnpTotals??0;out.gnitTotals=raw.gnitTotals||0;out.acumTotals=raw.acumTotals||0;
  // Torns fixos: horaris marc sempre vigents (conserva el color triat).
  out.torns.forEach(t=>{const f=FIXED_SHIFTS[t.id];if(f)Object.assign(t,f)});
  // Registres de treball: hores = entrada→sortida; el matí mai per sota de 8 h (07:00–15:00).
  Object.values(out.registres).forEach(r=>{
    if(r?.tipus!=="treball")return;
    const s=out.torns.find(t=>t.id===r.torn);if(!s)return;
    if(isMorning(s)&&r.torn!=="festa"){
      const h=elapsedHours(r.entrada,r.sortida);
      if(h!==null&&h<=7.5&&r.entrada==="07:00"&&r.sortida==="14:30")r.sortida="15:00";
    }
    const h=recordHours(r,s);
    if(Number(r.hores)!==h)r.hores=h;
  });
  return out;
}
function recordColor(r){if(!r?.tipus)return "";if(r.tipus==="treball"){const s=getShift(r.torn);return s?.color||""}return TYPE_COLORS[r.tipus]||""}
function recordStyle(r){const color=recordColor(r);return color?"style=\"--record-color:"+escapeHtml(color)+"\"":""}
function recoverLocalData(forceEmpty){
  // Només recupera si no hi ha estat principal vàlid (pèrdua real de dades).
  // No torna a injectar registres quan l'usuari ha esborrat tot expressament.
  if(!forceEmpty) return false;
  const skipSuffixes=[".backup-","Backup-","installDismissed","lastNotify","unlock",".latest"];
  const candidates=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(!k||k===KEY)continue;
    if(!k.startsWith(KEY) && !k.startsWith("codexGH"))continue;
    if(skipSuffixes.some(s=>k.includes(s)))continue;
    try{
      const raw=JSON.parse(localStorage.getItem(k));
      if(!raw||typeof raw!=="object")continue;
      if(!raw.registres && !raw.judicis)continue;
      const score=(raw.registres&&typeof raw.registres==="object"?Object.keys(raw.registres).length:0)+(Array.isArray(raw.judicis)?raw.judicis.length:0);
      if(score>0)candidates.push({data:raw,score,key:k});
    }catch(e){}
  }
  if(!candidates.length)return false;
  candidates.sort((a,b)=>b.score-a.score);
  const before=JSON.stringify(state);
  let changed=false;
  const candidate=candidates[0];
  const legacy=migrate(candidate.data);
  for(const [k,r] of Object.entries(legacy.registres||{})){
    if(!state.registres[k]){state.registres[k]=clone(r);changed=true}
  }
  const existingJud=new Set((state.judicis||[]).map(j=>JSON.stringify([j.data,j.hora,j.jutjat,j.sala,j.procediment])));
  for(const j of legacy.judicis||[]){
    const sig=JSON.stringify([j.data,j.hora,j.jutjat,j.sala,j.procediment]);
    if(!existingJud.has(sig)){state.judicis.push(clone(j));existingJud.add(sig);changed=true}
  }
  if(changed)localStorage.setItem(KEY,JSON.stringify(state));
  return changed && JSON.stringify(state)!==before;
}
function load(){
  let recovered=false;
  try{
    const main=localStorage.getItem(KEY), latest=localStorage.getItem(KEY+".latest");
    let mainData=null, latestData=null;
    try{ mainData=main?JSON.parse(main):null; }catch(e){ mainData=null; }
    try{ latestData=latest?JSON.parse(latest):null; }catch(e){ latestData=null; }
    // Prefereix sempre l'estat principal si existeix (respecta esborrats de l'usuari).
    // .latest només com a fallback si main no existeix o està corrupte.
    let rawData=mainData;
    if(!rawData && latestData) rawData=latestData;
    if(rawData){
      state=migrate(rawData);
      // Recuperació agressiva NOMÉS si no hi havia cap estat desat
      recovered=false;
    }else{
      state=defaultState();
      recovered=recoverLocalData(true);
    }
  }catch(e){state=defaultState()}
  const now=new Date(); currentMonth=new Date(now.getFullYear(),now.getMonth(),1); weekAnchor=startOfWeek(now);
  ensureHistory(); renderAll();
  if(recovered)setTimeout(()=>toast("Dades locals recuperades"),300);
}
function snapshot(){return {horesAnuals:state.horesAnuals,vacancesTotals:state.vacancesTotals,assumptesTotals:state.assumptesTotals,blausTotals:state.blausTotals,gnpTotals:state.gnpTotals,gnitTotals:state.gnitTotals,acumTotals:state.acumTotals,festius:clone(state.festius),registres:clone(state.registres),judicis:clone(state.judicis)}}
function ensureHistory(){state.historic=state.historic||{};state.historic[String(state.anyInici)]=state.historic[String(state.anyInici)]||snapshot()}
function save(){
 ensureHistory();
 {const {_savedAt,...rest}=state;const content=JSON.stringify(rest);
  if(content===window.__lastContent&&localStorage.getItem(KEY))return;
  window.__lastContent=content;}
 state._savedAt=Date.now();
 const payload=JSON.stringify(state);
 localStorage.setItem(KEY,payload);
 localStorage.setItem(KEY+".latest",payload);
 dailyBackup();
 try{window.dispatchEvent(new CustomEvent("rh:saved"))}catch(e){}
}
/* Còpia local diària (es conserven les 7 últimes). El prefix conté "Backup-" perquè la recuperació automàtica l'ignori. */
function dailyBackup(){
 try{
  const day=todayKey(),k="codexGHDailyBackup-"+day;
  if(localStorage.getItem(k)||!Object.keys(state.registres||{}).length)return;
  localStorage.setItem(k,JSON.stringify(state));
  const ks=[];for(let i=0;i<localStorage.length;i++){const x=localStorage.key(i);if(x&&x.startsWith("codexGHDailyBackup-"))ks.push(x)}
  ks.sort().slice(0,-7).forEach(x=>localStorage.removeItem(x));
 }catch(e){}
}
/* Avís si fa temps que no s'exporta una còpia JSON */
function backupReminder(){
 try{
  if(Object.keys(state.registres||{}).length<10)return;
  const now=Date.now();let first=Number(localStorage.getItem(KEY+".firstUse"));if(!first){first=now;localStorage.setItem(KEY+".firstUse",String(now))}
  const last=Number(localStorage.getItem(KEY+".lastExport"))||0,ref=last||first,days=Math.floor((now-ref)/86400000);
  const snooze=Number(localStorage.getItem(KEY+".backupSnooze"))||0;
  if(days<30||now<snooze)return;
  const b=document.getElementById("backupBanner");if(!b)return;
  document.getElementById("backupBannerText").textContent=last?`Fa ${days} dies de l'última còpia JSON.`:"Encara no has exportat cap còpia JSON.";
  b.classList.add("show");
 }catch(e){}
}
function dismissBackupReminder(){localStorage.setItem(KEY+".backupSnooze",String(Date.now()+7*86400000));document.getElementById("backupBanner")?.classList.remove("show")}
function backupNow(){exportJSON();document.getElementById("backupBanner")?.classList.remove("show")}
function saveOnHide(){try{save()}catch(e){}}
window.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveOnHide()});
window.addEventListener("pagehide",saveOnHide);
function setActiveYear(y){
  y=Number(y);if(!y||y===state.anyInici)return;
  ensureHistory();state.historic[String(state.anyInici)]=snapshot();const d=state.historic[String(y)];
  state.anyInici=y;
  if(d){state.horesAnuals=d.horesAnuals??1580;state.vacancesTotals=d.vacancesTotals??200;state.assumptesTotals=d.assumptesTotals??68;state.blausTotals=d.blausTotals??0;state.gnpTotals=d.gnpTotals??0;state.gnitTotals=d.gnitTotals??0;state.acumTotals=d.acumTotals??0;state.festius=d.festius||clone(DEFAULT_HOLIDAYS);state.registres=d.registres||{};state.judicis=d.judicis||[]}
  else {state.horesAnuals=1580;state.vacancesTotals=200;state.assumptesTotals=68;state.blausTotals=0;state.gnpTotals=0;state.gnitTotals=0;state.acumTotals=0;state.festius=clone(DEFAULT_HOLIDAYS);state.registres={};state.judicis=[]}
  currentMonth=new Date(y,1,1);weekAnchor=startOfWeek(new Date(y,1,1));selected.clear();save();renderAll();toast(`Any ${y} actiu`)
}
function years(){return [...new Set([...Object.keys(state.historic).map(Number),state.anyInici,state.anyInici+1])].sort((a,b)=>a-b)}
function selectYear(v){setActiveYear(v)}
function changeYear(delta){setActiveYear(state.anyInici+delta)}

function calc(){
 /* Regles Mossos (1580 h efectives) — ÚNICA implementació:
    - Treball: còmput general amb les hores d'entrada→sortida. Matí: marc 7,5 h, però es fan 8 h (07–15):
      8 h al general i 0,5 h a acumulades. Altres torns: acumulades = hores per sobre de la base del torn.
    - Nits: al bo de nits NOMÉS hores 22:00–06:00; la resta del torn va només al general
    - Vacances: només bo vacances · GNP: només bo GNP · Extres: només comptador extres
    - Hores acumulades (ús): només bo acumulades
    - Assumptes i Dies Blaus: el seu bo + còmput general · Baixa: còmput general
    - Torn festa: resta del còmput general */
 let worked=0,accExtra=0,vac=0,pers=0,blue=0,gnp=0,gnit=0,extra=0,accUsed=0;
 for(const r of Object.values(state.registres)){
  if(!r?.tipus)continue;
  if(r.tipus==="treball"){
    const s=getShift(r.torn),hr=recordHours(r,s);
    if(r.torn==="festa")worked-=hr;
    else{
      worked+=hr;
      accExtra+=Math.max(0,hr-shiftBase(s));
      if(isNightShift(s))gnit+=nightHoursForRecord(r,s);
    }
  }
  else if(r.tipus==="vacances"){vac+=Number(r.horesConcepte)||0}
  else if(r.tipus==="dies_blaus"){const h=Number(r.horesConcepte)||0;blue+=h;worked+=h}
  else if(r.tipus==="assumptes"){const h=Number(r.horesConcepte)||0;pers+=h;worked+=h}
  else if(r.tipus==="baixa"){worked+=Number(r.horesConcepte)||0}
  else if(r.tipus==="guardia_np"){gnp+=Number(r.horesConcepte)||0}
  else if(r.tipus==="hores_acum"){accUsed+=Number(r.horesConcepte)||7.5}
  else if(r.tipus==="hores_extres"){extra+=Number(r.horesConcepte)||0}
 }
 return {worked:num(worked),remaining:num(state.horesAnuals-worked),saldo:num(worked-expectedToDate()),expected:num(expectedToDate()),progress:state.horesAnuals?Math.max(0,Math.min(100,worked/state.horesAnuals*100)):0,accum:num((state.acumTotals||0)+accExtra-accUsed),vac:num(vac),pers:num(pers),blue:num(blue),gnp:num(gnp),gnit:num(gnit),extra:num(extra),accExtra:num(accExtra),accUsed:num(accUsed)}
}
function expectedToDate(){
  const start=new Date(state.anyInici,1,1),end=new Date(state.anyInici+1,0,31),now=new Date();let asOf=now;
  if(asOf<start) return 0;if(asOf>end) return state.horesAnuals;
  const total=Math.max(1,(end-start)/86400000+1),elapsed=Math.max(0,Math.min(total,(asOf-start)/86400000+1));
  return state.horesAnuals*(elapsed/total)
}
function saldoText(v){
  const c=calc();
  if(c.worked < 1 && c.progress < 2) return "Encara no hi ha hores registrades en aquest període";
  if(Math.abs(v)<0.01) return "Vas exactament al ritme previst";
  return v>0?`Vas ${plainHours(v)} h per sobre del ritme previst`:`Et falten ${plainHours(Math.abs(v))} h per recuperar el ritme previst`;
}
function renderAll(){renderHeader();renderHome();renderCalendar();renderWeek();renderTrials();renderStats();renderMore();window.HomeActions&&HomeActions.render()}
function renderHeader(){
 document.getElementById("app-title").textContent=state.titol||"Codex GH";document.getElementById("app-subtitle").textContent=state.subtitol||"";
 const sel=document.getElementById("yearSelect");sel.innerHTML=years().map(y=>`<option value="${y}" ${y===state.anyInici?"selected":""}>${y}/${String(y+1).slice(-2)}</option>`).join("");
 document.title=state.titol||"Codex GH";
 const wm=document.getElementById("watermark");
 if(wm){wm.textContent="";wm.style.display="none";}
}
function renderHome(){
 const c=calc();document.getElementById("saldo").textContent=fmtHours(c.saldo);document.getElementById("saldoText").textContent=saldoText(c.saldo);const balanceDetail=document.getElementById("balanceDetail");if(balanceDetail)balanceDetail.textContent=`Previstes fins avui: ${plainHours(c.expected)} h · Pendents de l’objectiu: ${plainHours(Math.max(0,c.remaining))} h`;document.getElementById("progressPct").textContent=Math.round(c.progress)+"%";document.getElementById("progressPct").style.setProperty("--p",Math.max(0,Math.min(100,c.progress)));document.getElementById("progressBar").style.width=c.progress+"%";document.getElementById("workedLabel").textContent=plainHours(c.worked)+" h fetes";document.getElementById("targetLabel").textContent="de "+plainHours(state.horesAnuals)+" h";
 const d=parseKey(todayKey()),rAll=state.registres[todayKey()],r=(rAll&&rAll.tipus!=="planificat")?rAll:null,box=document.getElementById("todayCard"); // «planificat» = només icona/notes, sense jornada
 if(r){const s=r.tipus==="treball"?getShift(r.torn):null;box.innerHTML=`<div class="card-title">Avui · ${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</div><div class="today"><div class="today-date"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0,3)}</span></div><div class="today-main"><b>${escapeHtml(r.tipus==="treball"?(s?.nom||"Treball"):TYPE_NAMES[r.tipus]||r.tipus)}</b><small>${r.tipus==="treball"?`${r.entrada||s?.inici||""} → ${r.sortida||s?.fi||""} · ${plainHours(r.hores||0)} h`:(plainHours(r.horesConcepte||0)+" h")}</small></div><button class="btn secondary small" onclick="openDay('${todayKey()}')">Editar</button></div>`}
 else box.innerHTML=`<div class="card-title">Avui · ${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}</div><div class="today"><div class="today-date"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0,3)}</span></div><div class="today-main"><b>Encara sense registre</b><small>${holiday(d)?"Avui és festiu · ":""}Prepara la jornada en segons.</small></div><button class="btn primary small" onclick="openDay('${todayKey()}')">Registrar</button></div>`;
 if(window.HomeActions)box.insertAdjacentHTML("beforeend",HomeActions.todayExtras(todayKey()));
 const qs=[
  ["green",fmtHours(c.accum),"Acumulades","accum"],
  ["purple",plainHours(state.vacancesTotals-c.vac)+" h","Vacances restants","vacances"],
  ["cyan",plainHours(state.assumptesTotals-c.pers)+" h","Assumptes restants","assumptes"],
  ["blue",plainHours(c.gnp)+" h","GNP fetes","gnp"],
  ["pink",plainHours(c.gnit)+" h","Nits","nits"],
  ["orange",plainHours(c.extra)+" h","Extres","extres"],
  ["green",plainHours(Math.max(0,(state.blausTotals||0)-c.blue))+" h","Dies Blaus","dies_blaus"],
  ["purple",String(state.judicis.filter(j=>!j.celebrat&&!j.suspes).length),"Judicis pendents","judicis"]
 ];
 document.getElementById("quickStats").innerHTML=qs.map(x=>`<div class="stat ${x[0]} clickable" role="button" tabindex="0" onclick="openDetail('${x[3]}')" onkeydown="if(event.key==='Enter')openDetail('${x[3]}')"><b>${x[1]}</b><span>${x[2]}</span></div>`).join("");
 const today=todayKey();
 const upcomingTrials=state.judicis.map((j,i)=>({...j,i})).filter(j=>j.data&&j.data>=today&&!j.celebrat).sort((a,b)=>(a.data+(a.hora||"")).localeCompare(b.data+(b.hora||""))).slice(0,5);
 const upcomingIcons=[];
 for(let i=0;i<60;i++){const x=new Date();x.setDate(x.getDate()+i);const k=key(x),r2=state.registres[k];if(r2?.noteIcon)upcomingIcons.push({d:x,k,r:r2});}
 let html=upcomingTrials.map(j=>`<div class="row" onclick="openTrial(${j.i})"><div class="grow"><strong><i class="ic ic-scale"></i> ${escapeHtml(j.jutjat||"Judici")} · ${j.hora||""}${j.observacions?.trim()?' <span title="Aquest judici té observacions" aria-label="Té observacions" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ef4444;vertical-align:middle;margin-left:5px"></span>':""}</strong><small>${j.data} · ${escapeHtml(j.procediment||"")}</small></div><span class="chip ${j.cobrament?"ok":"warn"}">${j.cobrament?"Cobrat":"Pendent"}</span></div>`).join("");
 html+=upcomingIcons.slice(0,5).map(o=>`<div class="row" onclick="openDay('${o.k}')"><div class="grow"><strong><i class="ic ic-bell"></i> ${DOW[o.d.getDay()]} ${o.d.getDate()} ${MONTHS[o.d.getMonth()]}</strong><small>Dia amb icona / observació</small></div><span class="chip info">${escapeHtml(o.r.noteIcon==="red_plus"?"➕":o.r.noteIcon)}</span></div>`).join("");
 document.getElementById("upcoming").innerHTML=html||`<div class="empty">No hi ha judicis ni dies amb icones programats.</div>`;
 const pending=state.judicis.map((j,i)=>({...j,i})).filter(j=>(!j.celebrat&&!j.suspes)||j.canviTorn||(j.celebrat&&!j.cobrament));
 const alerts=[];
 pending.forEach(j=>{const reasons=[];if(j.suspes)reasons.push("judici suspès");else if(!j.celebrat)reasons.push("judici pendent");if(j.canviTorn)reasons.push("canvi de torn");if(j.celebrat&&!j.cobrament)reasons.push("pendent de cobrament");alerts.push(`<div class="row" onclick="openTrial(${j.i})" style="cursor:pointer"><div class="grow"><strong><i class="ic ic-scale"></i> ${escapeHtml(j.jutjat||"Judici")} · ${j.data||"sense data"}</strong><small>${escapeHtml(reasons.join(" · "))}</small></div></div>`)});
 if(!r)alerts.push(`<div class="row"><div class="grow"><strong><i class="ic ic-clock"></i> Avui encara no has registrat la jornada</strong></div></div>`);
 document.getElementById("alerts").innerHTML=alerts.length?alerts.join(""):`<div class="empty">Tot al dia.</div>`;
}
let currentView="home";
function showView(v,fromHistory=false){
  if(!document.getElementById("view-"+v))return;
  const changed=currentView!==v;
  currentView=v;
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  document.getElementById("view-"+v).classList.add("active");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  if(changed&&!fromHistory)history.pushState({view:v},"","#"+v);
  if(v==="calendar")renderCalendar();
  if(v==="permisos")renderPermisos();
  if(v==="week")renderWeek();
  if(v==="trials")renderTrials();
  if(v==="stats")renderStats();
  if(v==="more")renderMore();
}
function syncViewFromHistory(){
  const v=(location.hash||"").replace(/^#/,"");
  showView(["home","calendar","week","trials","permisos","stats","more"].includes(v)?v:"home",true);
}
window.addEventListener("popstate",syncViewFromHistory);
if(!location.hash)history.replaceState({view:"home"},"","#home");
function changeMonth(n){currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+n,1);renderCalendar()}
function goToday(){const d=new Date();currentMonth=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()}
function syncMultiUi(){
 const a=document.getElementById("multiApply"),b=document.getElementById("weekMultiApply"),c=document.getElementById("calendarMultiToggle"),d=document.getElementById("weekMultiToggle");
 [a,b].forEach(x=>{if(x){x.style.display=multi?"inline-block":"none";x.setAttribute("aria-pressed",multi?"true":"false");x.textContent=multi?"Acabar selecció":"Aplicar"}});
 [c,d].forEach(x=>{if(x){x.setAttribute("aria-pressed",multi?"true":"false");x.textContent=multi?"Selecció activa":"Selecció múltiple"}});
}
function toggleMulti(){multi=!multi;if(!multi)selected.clear();syncMultiUi();renderCalendar();renderWeek()}
function toggleSelectedDay(k){if(!multi)return openDay(k);selected.has(k)?selected.delete(k):selected.add(k);renderCalendar();renderWeek()}
function clickDay(k){toggleSelectedDay(k)}
function clickWeekDay(k){toggleSelectedDay(k)}
function renderCalendar(){
 const y=currentMonth.getFullYear(),m=currentMonth.getMonth();document.getElementById("monthTitle").textContent=`${MONTHS[m]} ${y}`;const cal=document.getElementById("calendar");let html=DOW.slice(1).concat(["Dg"]).map(x=>`<div class="dow">${x}</div>`).join("");
 const first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
 for(let i=0;i<offset;i++)html+=`<div></div>`;
 for(let n=1;n<=days;n++){const d=new Date(y,m,n),k=key(d),r=state.registres[k],s=r?.tipus==="treball"?getShift(r.torn):null,jud=state.judicis.filter(j=>j.data===k);let cls="day "+(isWeekend(d)?"weekend ":"")+(holiday(d)?" holiday ":"")+(selected.has(k)?" selected ":"")+(k===todayKey()?" today ":"")+(r?.notes?.trim()?" has-note ":"")+(jud.length?" has-trial ":"");if(r)cls+=r.tipus==="treball"?` ${s?.id==="mati"?"mati":s?.id==="tarda"?"tarda":s?.id==="nit"?"nit":s?.id||"work"}`:` ${r.tipus}`;const label=r?(r.tipus==="treball"?s?.abbr||"Treball":r.tipus==="planificat"?(r.notes||"Planificat"):(TYPE_NAMES[r.tipus]||r.tipus)):"";const hours=r?(r.tipus==="treball"?plainHours(r.hores||0):plainHours(r.horesConcepte||0)):"";const noteIcon=r?.noteIcon||"";const noteHtml=noteIcon==="red_plus"?'<span class="note-icon red-plus" title="Observació">➕</span>':(noteIcon?`<span class="note-icon" title="Observació">${escapeHtml(noteIcon)}</span>`:"");html+=`<button class="${cls}" ${recordStyle(r)} type="button" onclick="event.preventDefault();clickDay('${k}')"><span class="num">${n}</span><span class="kind">${escapeHtml(label)}</span>${jud.length?`<span class="trial-icon" title="${jud.length===1?"Judici":"Judicis"}" onclick="event.stopPropagation();openTrialsForDate('${k}')">⚖️<b>${jud.length>1?jud.length:""}</b></span>`:""}${noteHtml}<span class="hrs">${hours}</span></button>`}
 cal.innerHTML=html;const monthly=document.getElementById("monthlyList");if(monthly&&monthly.style.display!=="none")renderMonthly();document.getElementById("legend").innerHTML=state.torns.map(t=>`<span class="legend-chip" style="--legend-color:${escapeHtml(t.color||"#93c5fd")}"><i></i>${escapeHtml(t.nom)}</span>`).concat([{name:"Vacances",color:TYPE_COLORS.vacances},{name:"Assumptes personals",color:TYPE_COLORS.assumptes},{name:"Dies Blaus",color:TYPE_COLORS.dies_blaus},{name:"Hores extres",color:TYPE_COLORS.hores_extres},{name:"Baixa",color:TYPE_COLORS.baixa}].map(x=>`<span class="legend-chip" style="--legend-color:${x.color}"><i></i>${x.name}</span>`)).join("");
}
function toggleCalendarMode(){
 const list=document.getElementById("monthlyList"),grid=document.getElementById("calendar"),btn=document.getElementById("calendarModeBtn");
 const monthly=list.style.display==="none";
 list.style.display=monthly?"flex":"none";grid.style.display=monthly?"none":"grid";
 btn.textContent=monthly?"Calendari":"Resum mensual";
 if(monthly)renderMonthly();
}
undefined
function renderMonthly(){
 const y=currentMonth.getFullYear(),m=currentMonth.getMonth(),days=new Date(y,m+1,0).getDate(),list=document.getElementById("monthlyList");
 let registered=0,totalHours=0;const rows=[];
 for(let n=1;n<=days;n++){
  const d=new Date(y,m,n),k=key(d),r=state.registres[k];if(!r)continue;
  registered++;const h=r.tipus==="treball"?Number(r.hores)||0:(r.tipus==="planificat"?0:Number(r.horesConcepte)||0);totalHours+=h;
  const shift=r.tipus==="treball"?getShift(r.torn):null,icon=r.noteIcon==="red_plus"?"➕":(r.noteIcon||"");
  const title=r.tipus==="planificat"?(r.notes||"Dia planificat"):(r.tipus==="treball"?(shift?.nom||"Treball"):(TYPE_NAMES[r.tipus]||r.tipus));
  const detail=r.tipus==="planificat"?"":(r.notes||"");
  rows.push(`<div class="monthly-row" onclick="openDay('${k}')"><div class="monthly-date"><b>${n}</b><small>${DOW[d.getDay()]}</small></div><div class="monthly-info"><strong>${escapeHtml((icon?icon+" ":"")+title)}</strong>${detail?`<small>${escapeHtml(detail)}</small>`:""}</div><div class="monthly-hours">${h?plainHours(h)+" h":"—"}</div></div>`);
 }
 const trials=state.judicis.filter(j=>j.data&&j.data.startsWith(y+"-"+String(m+1).padStart(2,"0"))).length;
 list.innerHTML='<div class="monthly-summary"><div><strong>'+registered+'</strong><span>dies planificats/registrats</span></div><div><strong>'+plainHours(totalHours)+' h</strong><span>hores del mes</span></div><div><strong>'+trials+'</strong><span>judicis</span></div></div>'+(rows.join("")||'<div class="empty">Encara no hi ha dies registrats ni planificats aquest mes.</div>');
}
function isoWeekNumber(d){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()+3-(x.getDay()+6)%7);const w1=new Date(x.getFullYear(),0,4);return 1+Math.round(((x-w1)/86400000-3+(w1.getDay()+6)%7)/7)}
function renderWeek(){
 const start=weekAnchor;document.getElementById("weekTitle").textContent=`Setmana ${isoWeekNumber(start)} · ${start.getDate()} ${MONTHS[start.getMonth()]} – ${new Date(start.getTime()+6*86400000).getDate()} ${MONTHS[new Date(start.getTime()+6*86400000).getMonth()]}`;
 let total=0;const rows=[];for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=key(d),r=state.registres[k],s=r?.tipus==="treball"?getShift(r.torn):null;const h=r?(r.tipus==="treball"?Number(r.hores)||0:Number(r.horesConcepte)||0):0;total+=r?.tipus==="treball"&&s?.id==="festa"?-h:h;const noteIcon=r?.noteIcon||"";const noteHtml=noteIcon==="red_plus"?'<span class="note-icon red-plus" title="Observació">➕</span>':(noteIcon?`<span class="note-icon" title="Observació">${escapeHtml(noteIcon)}</span>`:"");rows.push(`<div class="week-row ${r?(r.tipus==="treball"?(s?.id||"work"):(r.tipus||"")):""} ${selected.has(k)?"selected":""} ${r?.notes?.trim()?"has-note":""}" ${recordStyle(r)} onclick="event.preventDefault();clickWeekDay('${k}')"><div class="week-date"><b>${d.getDate()}</b><small>${DOW[d.getDay()]}</small></div><div><strong>${escapeHtml(r?(r.tipus==="treball"?s?.nom||"Treball":r.tipus==="planificat"?(r.notes||"Dia planificat"):(TYPE_NAMES[r.tipus]||r.tipus)):"Sense registre")}</strong><small>${r?(r.tipus==="treball"?`${r.entrada||s?.inici||""} → ${r.sortida||s?.fi||""}`:(r.notes||"")):"Toca per registrar"} ${noteHtml}</small></div><div class="week-sum">${r?plainHours(h)+" h":"—"}</div></div>`)}
 document.getElementById("weekList").innerHTML=rows.join("");
 const weekWorked=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const r=state.registres[key(d)],s=r?.tipus==="treball"?getShift(r.torn):null;return r?.tipus==="treball"&&s?.id!=="festa"?Number(r.hores)||0:0}).reduce((a,b)=>a+b,0);
 const remaining=Math.max(0,37.5-weekWorked);
 document.getElementById("weekStats").innerHTML=`<div class="stat blue"><b>${plainHours(weekWorked)} h</b><span>Fetes aquesta setmana</span></div><div class="stat green"><b>${plainHours(remaining)} h</b><span>Ritme restant (37,5 h)</span></div>`;
}
function expectedWeek(){return 37.5}

function changeWeek(days){weekAnchor=new Date(weekAnchor);weekAnchor.setDate(weekAnchor.getDate()+days);renderWeek()}

function openDay(k){openDayBase(k);window.HomeActions&&HomeActions.fillSpecial(k)}
function openDayBase(k){editingDay=k;const d=parseKey(k),r=state.registres[k]||{},s=getShift(r.torn)||state.torns[0];document.getElementById("dayModalTitle").textContent=`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;document.getElementById("dayType").value=r.tipus==="planificat"?"":(r.tipus||"treball");fillShiftSelects();document.getElementById("dayShift").value=r.torn||s?.id||"";document.getElementById("dayStart").value=r.entrada||s?.inici||"07:00";document.getElementById("dayEnd").value=r.sortida||s?.fi||"14:30";document.getElementById("dayHours").value=r.hores??defaultShiftHours(s);document.getElementById("conceptHours").value=r.horesConcepte??7.5;document.getElementById("dayNotes").value=r.notes||"";document.getElementById("dayNoteIcon").value=r.noteIcon||"";updateNoteIconButton();document.getElementById("deleteDayBtn").style.display=r.tipus?"block":"none";updateDayForm();calcHoursFromTimes();openModal("dayModal")}
function updateNoteIconButton(){const icon=document.getElementById("dayNoteIcon")?.value||"";const b=document.getElementById("noteIconBtn");if(!b)return;b.innerHTML=icon?'<span class="note-icon-current">'+icon+'</span> Canviar icona':'➕ Tria una icona'}
function openNoteIconPicker(){updateNoteIconButton();openModal("noteIconPicker")}
function selectNoteIcon(icon){document.getElementById("dayNoteIcon").value=icon||"";updateNoteIconButton();closeModal("noteIconPicker")}
function fillShiftSelects(){const opts=state.torns.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.abbr||s.nom)} · ${escapeHtml(s.nom)} (${s.hores}h)</option>`).join("");document.getElementById("dayShift").innerHTML=opts;document.getElementById("bulkShift").innerHTML=opts}
function shiftChanged(){const s=getShift(document.getElementById("dayShift").value);if(s){document.getElementById("dayStart").value=s.inici;document.getElementById("dayEnd").value=s.fi;calcHoursFromTimes()}}
function updateHint(){const s=getShift(document.getElementById("dayShift").value),el=document.getElementById("dayCalcHint");if(!el)return;if(!s){el.textContent="";return}const rec={torn:s.id,entrada:document.getElementById("dayStart").value,sortida:document.getElementById("dayEnd").value,hores:Number(document.getElementById("dayHours").value)||0},h=recordHours(rec,s),base=shiftBase(s),extra=Math.max(0,h-base);el.textContent=isMorning(s)&&s.id!=="festa"?`Matí: marc ${base} h · compta ${h} h al general · ${extra.toFixed(2)} h a acumulades`:`Base del torn: ${base} h · Acumulades generades si superes la base: ${extra.toFixed(2)} h`}
function minutesFromTime(value){
  if(!value) return null;
  const m=String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if(!m) return null;
  return Number(m[1])*60+Number(m[2]);
}
function calcHoursFromTimes(){
  const startEl=document.getElementById("dayStart");
  const endEl=document.getElementById("dayEnd");
  const hoursEl=document.getElementById("dayHours");
  if(!startEl||!endEl||!hoursEl) return;
  const a=minutesFromTime(startEl.value);
  const b=minutesFromTime(endEl.value);
  if(a===null||b===null){ return; }
  let d=b-a;
  if(d<0) d+=1440; // passa de mitjanit
  const h=Math.round((d/60)*100)/100;
  hoursEl.value=String(h);
  updateHint();
}
function updateDayForm(){const t=document.getElementById("dayType").value,work=t==="treball";document.getElementById("workFields").style.display=work?"block":"none";document.getElementById("conceptFields").style.display=!work&&t?"block":"none";if(work)updateHint()}
function saveDay(){if(!editingDay)return;const t=document.getElementById("dayType").value,notes=document.getElementById("dayNotes").value.trim(),noteIcon=document.getElementById("dayNoteIcon").value||"";if(!t){if(notes||noteIcon)state.registres[editingDay]={tipus:"planificat",notes,noteIcon,horesConcepte:0};else delete state.registres[editingDay]}else{const r={tipus:t,notes,noteIcon};if(t==="treball"){r.torn=document.getElementById("dayShift").value;r.entrada=document.getElementById("dayStart").value;r.sortida=document.getElementById("dayEnd").value;r.hores=Number(document.getElementById("dayHours").value)||0;if(window.HomeActions)Object.assign(r,HomeActions.readSpecial())}else r.horesConcepte=Number(document.getElementById("conceptHours").value)||0;state.registres[editingDay]=r}save();closeModal("dayModal");renderAll();toast("Jornada desada ✓","success")}
async function deleteDay(){if(!editingDay)return;if(!await uiConfirm("Esborrar aquest registre?",{ok:"Esborrar",danger:true}))return;delete state.registres[editingDay];save();closeModal("dayModal");renderAll();toast("Registre esborrat")}
function openBulk(){if(!selected.size)return toast("Selecciona almenys un dia");document.getElementById("bulkCount").textContent=`${selected.size} dia(s) seleccionat(s)`;fillShiftSelects();updateBulk();openModal("bulkModal")}
function updateBulk(){const t=document.getElementById("bulkType").value;document.getElementById("bulkWork").style.display=t==="treball"?"block":"none";document.getElementById("bulkHours").style.display=!["treball","esborrar"].includes(t)?"block":"none"}
async function applyBulk(){const t=document.getElementById("bulkType").value;if(t==="esborrar"){if(!await uiConfirm(`Esborrar ${selected.size} registres?`,{ok:"Esborrar",danger:true}))return;selected.forEach(k=>delete state.registres[k])}else selected.forEach(k=>{if(t==="treball"){const s=getShift(document.getElementById("bulkShift").value);state.registres[k]={tipus:t,torn:s.id,hores:defaultShiftHours(s),entrada:s.inici,sortida:s.fi,notes:""}}else state.registres[k]={tipus:t,horesConcepte:Number(document.getElementById("bulkHoursInput").value)||0,notes:""}});save();selected.clear();multi=false;closeModal("bulkModal");renderAll();toast("Canvis aplicats")}

const TRIAL_GROUPS=["Pendents","Per cobrar","Suspesos","Completats"];function trialGroup(j){return j.suspes?2:!j.celebrat?0:!j.cobrament?1:3}function groupHead(j,p){const g=trialGroup(j);return(!p||trialGroup(p)!==g)?`<div class="group-head">${TRIAL_GROUPS[g]}</div>`:""}
function renderTrials(){const q=(document.getElementById("trialSearch").value||"").toLowerCase();const list=state.judicis.map((j,i)=>({...j,i})).filter(j=>(!trialDateFilter||j.data===trialDateFilter)&&`${j.jutjat} ${j.procediment} ${j.agents} ${j.sala} ${j.data}`.toLowerCase().includes(q)).sort((a,b)=>trialGroup(a)-trialGroup(b)||(a.data+a.hora).localeCompare(b.data+b.hora));document.getElementById("trialDateClear").style.display=trialDateFilter?"inline-flex":"none";document.getElementById("trialPending").textContent=`${state.judicis.filter(j=>!j.celebrat&&!j.suspes).length} pendents`;document.getElementById("trialSuspended").textContent=`${state.judicis.filter(j=>j.suspes).length} suspesos`;document.getElementById("trialPay").textContent=`${state.judicis.filter(j=>j.celebrat&&!j.cobrament).length} per cobrar`;document.getElementById("trialsList").innerHTML=list.length?list.map((j,k,arr)=>groupHead(j,arr[k-1])+`<div class="row" onclick="openTrial(${j.i})"><div class="grow"><strong><i class="ic ic-scale"></i> ${escapeHtml(j.jutjat||"Judici")} · ${j.hora||""}${j.observacions?.trim()?' <span title="Aquest judici té observacions" aria-label="Té observacions" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ef4444;vertical-align:middle;margin-left:7px"></span>':""}</strong><small>${j.data||"—"} · ${escapeHtml(j.sala||"")} · ${escapeHtml(j.procediment||"")} ${j.agents?`· ${escapeHtml(j.agents)}`:""}</small></div><div>${j.suspes?'<span class="chip warn">Suspès</span>':j.celebrat?'<span class="chip ok">Celebrat</span>':'<span class="chip bad">Pendent</span>'}<br>${j.cobrament?'<span class="chip ok">Cobrat</span>':'<span class="chip warn">Per cobrar</span>'}</div></div>`).join(""):`<div class="card empty">No hi ha judicis que coincideixin.</div>`}
function openTrial(i=null){editingTrial=i;const j=i==null?{}:state.judicis[i];document.getElementById("trialTitle").textContent=i==null?"Nou judici":"Editar judici";document.getElementById("jDate").value=j?.data||"";document.getElementById("jTime").value=j?.hora||"";document.getElementById("jCourt").value=j?.jutjat||"";document.getElementById("jRoom").value=j?.sala||"";document.getElementById("jProc").value=j?.procediment||"";document.getElementById("jAgents").value=j?.agents||"";document.getElementById("jObservations").value=j?.observacions||"";document.getElementById("jHeld").checked=!!j?.celebrat;document.getElementById("jPaid").checked=!!j?.cobrament;document.getElementById("jShift").checked=!!j?.canviTorn;document.getElementById("jSuspended").checked=!!j?.suspes;document.getElementById("deleteTrialBtn").style.display=i==null?"none":"block";openModal("trialModal")}
function saveTrial(){const j={data:document.getElementById("jDate").value,hora:document.getElementById("jTime").value,jutjat:document.getElementById("jCourt").value.trim(),sala:document.getElementById("jRoom").value.trim(),procediment:document.getElementById("jProc").value.trim(),agents:document.getElementById("jAgents").value.trim(),observacions:document.getElementById("jObservations").value.trim(),celebrat:document.getElementById("jHeld").checked,cobrament:document.getElementById("jPaid").checked,canviTorn:document.getElementById("jShift").checked,suspes:document.getElementById("jSuspended").checked};if(editingTrial==null)state.judicis.push(j);else state.judicis[editingTrial]=j;save();closeModal("trialModal");renderAll();toast("Judici desat")}
function openTrialsForDate(k){trialDateFilter=k;document.getElementById("trialSearch").value="";showView("trials");renderTrials()}function clearTrialDateFilter(){trialDateFilter="";renderTrials()}async function deleteTrial(){if(editingTrial==null)return;if(!await uiConfirm("Esborrar aquest judici?",{ok:"Esborrar",danger:true}))return;state.judicis.splice(editingTrial,1);save();closeModal("trialModal");renderAll();toast("Judici esborrat")}

function monthWorkHours(r){
 if(!r?.tipus)return 0;
 if(r.tipus==="treball"){const s=getShift(r.torn),h=recordHours(r,s);return r.torn==="festa"?-h:h}
 if(["dies_blaus","assumptes","baixa"].includes(r.tipus))return Number(r.horesConcepte)||0;
 return 0;
}
function annualMonths(){
 const out=[];
 for(let i=0;i<12;i++){
  const d=new Date(state.anyInici,1+i,1),year=d.getFullYear(),month=d.getMonth(),prefix=year+"-"+String(month+1).padStart(2,"0");
  let hours=0,days=0;
  Object.entries(state.registres||{}).forEach(([k,r])=>{if(k.startsWith(prefix)){hours+=monthWorkHours(r);if(r?.tipus)days++}});
  const trials=(state.judicis||[]).filter(j=>String(j?.data||"").startsWith(prefix)).length;
  out.push({year,month,hours,days,trials});
 }
 return out;
}
function openAnnualMonth(year,month){
 currentMonth=new Date(Number(year),Number(month),1);
 const list=document.getElementById("monthlyList"),grid=document.getElementById("calendar"),btn=document.getElementById("calendarModeBtn");
 if(list)list.style.display="none";if(grid)grid.style.display="grid";if(btn)btn.textContent="Resum mensual";
 showView("calendar");
}
function renderStats(){
 const months=annualMonths(),vals=months.map(x=>x.hours),max=Math.max(1,...vals);
 document.getElementById("chart").innerHTML=months.map(x=>`<div class="bar-wrap${x.year===new Date().getFullYear()&&x.month===new Date().getMonth()?" now":""}"><div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center">${x.hours>0?`<div class="bar-val">${Math.round(x.hours)}</div>`:""}<div class="bar" style="height:${Math.max(2,x.hours/max*125)}px" title="${plainHours(x.hours)} h"></div><div class="bar-label">${MONTHS[x.month].slice(0,3)}</div></div></div>`).join("");
 const annualTitle=document.getElementById("annualTitle");if(annualTitle)annualTitle.textContent=`Calendari anual · ${state.anyInici}/${String(state.anyInici+1).slice(-2)}`;
 const annual=document.getElementById("annualCalendar");
 if(annual)annual.innerHTML=months.map(x=>`<button type="button" class="annual-month" onclick="openAnnualMonth(${x.year},${x.month})"><span class="annual-month-head">${MONTHS[x.month]} <small>${x.year}</small></span><strong>${plainHours(x.hours)} h</strong><span class="annual-month-meta">${x.days} dies registrats · ${x.trials} judicis</span></button>`).join("");
 const c=calc();document.getElementById("statsDetail").innerHTML=[["blue",plainHours(c.worked)+" h","Còmput efectiu"],["green",plainHours(c.accum)+" h","Acumulades"],["pink",plainHours(c.gnit)+" h","Nits"],["orange",plainHours(c.extra)+" h","Extres"],["purple",plainHours(c.vac)+" h","Vacances usades"],["cyan",plainHours(c.pers)+" h","AP usats"],["blue",plainHours(c.gnp)+" h","GNP"],["green",plainHours(c.blue)+" h","Blaus usats"]].map(x=>`<div class="stat ${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></div>`).join("");
 const start=new Date(state.anyInici,1,1),end=new Date(state.anyInici+1,0,31),today=new Date();start.setHours(0,0,0,0);end.setHours(0,0,0,0);const day=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 const totalDays=Math.max(1,Math.round((end-start)/86400000)+1),elapsedDays=day<start?0:day>end?totalDays:Math.min(totalDays,Math.round((day-start)/86400000)+1),fraction=elapsedDays/totalDays;
 const elapsedWeeks=elapsedDays/7,remainingWeeks=Math.max(0,(totalDays-elapsedDays)/7),rate=elapsedWeeks>0?c.worked/elapsedWeeks:0,projection=fraction>0?c.worked/fraction:0,needed=remainingWeeks>0?Math.max(0,state.horesAnuals-c.worked)/remainingWeeks:0,diff=projection-state.horesAnuals;
 const projectionLabel=fraction===0?"Encara no ha començat el període":(diff>=0?"Al ritme actual, arribaries a l'objectiu":"Al ritme actual, quedaries per sota");
 document.getElementById("forecast").innerHTML=`<div class="stats forecast-stats"><div class="stat blue"><b>${plainHours(c.worked)} h</b><span>Fetes fins avui</span></div><div class="stat purple"><b>${plainHours(state.horesAnuals)} h</b><span>Objectiu anual</span></div><div class="stat green"><b>${plainHours(Math.max(0,state.horesAnuals-c.worked))} h</b><span>Pendents</span></div><div class="stat orange"><b>${plainHours(needed)} h/set.</b><span>Ritme necessari restant</span></div></div><div class="row" style="margin-top:10px"><div class="grow"><strong>${projectionLabel}</strong><small>${elapsedDays} de ${totalDays} dies del període · ritme observat ${plainHours(rate)} h/setmana</small></div><span class="chip ${diff>=0?"ok":"warn"}">${fraction>0?plainHours(projection)+" h":"—"}</span></div><div class="hint" style="margin-top:10px">Previsió lineal orientativa basada en el còmput efectiu registrat entre l'1 de febrer i el 31 de gener. No afegeix hores futures ni modifica registres; pot variar si canvia el teu torn o la planificació.</div>`;
  renderShiftSimulator();
}

function simulatedShiftHours(item){
 const s=state.torns.find(t=>t.id===item.shiftId);if(!s)return 0;
 return recordHours({torn:s.id,entrada:s.inici,sortida:s.fi},s);
}
function renderShiftSimulator(){
 const host=document.getElementById("shiftSimulator");if(!host)return;
 const today=todayKey(),periodStart=String(state.anyInici)+"-02-01",periodEnd=String(state.anyInici+1)+"-01-31";
 const options=state.torns.filter(s=>s.id!=="festa");
 const oldDate=document.getElementById("simDate")?.value||"",oldShift=document.getElementById("simShift")?.value||"";
 const minDate=today>periodStart?today:periodStart;
 const dateValue=oldDate&&oldDate>=minDate&&oldDate<=periodEnd?oldDate:(minDate<=periodEnd?minDate:"");
 const total=num(shiftSimulations.reduce((sum,x)=>sum+simulatedShiftHours(x),0));
 const c=calc(),projected=num(c.worked+total),remaining=num(Math.max(0,state.horesAnuals-projected));
 const list=shiftSimulations.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{const s=state.torns.find(t=>t.id===x.shiftId);return '<div class="row"><div class="grow"><strong>'+x.date+' · '+escapeHtml(s?.nom||"Torn")+'</strong><small>'+escapeHtml(s?.inici||"")+'–'+escapeHtml(s?.fi||"")+' · '+plainHours(simulatedShiftHours(x))+' h</small></div><button class="btn danger small" type="button" onclick="removeShiftSimulation(\''+x.date+'\')">Treure</button></div>'}).join("");
 const selected=options.some(s=>s.id===oldShift)?oldShift:options[0]?.id||"";
 const valid=!!(dateValue&&dateValue>today&&dateValue<=periodEnd&&options.length);
 host.innerHTML='<div class="sim-head"><span class="chip warn">PROVA · NO DESAT</span><p class="hint">Afegeix torns futurs per veure’n l’efecte estimat. No crea registres ni modifica el calendari.</p></div><div class="form-grid"><div><label for="simDate">Data futura</label><input type="date" id="simDate" min="'+minDate+'" max="'+periodEnd+'" value="'+dateValue+'"></div><div><label for="simShift">Torn</label><select id="simShift">'+options.map(s=>'<option value="'+escapeHtml(s.id)+'" '+(s.id===selected?"selected":"")+'>'+escapeHtml(s.nom)+' · '+escapeHtml(s.inici)+'–'+escapeHtml(s.fi)+'</option>').join("")+'</select></div></div><button class="btn primary" type="button" onclick="addShiftSimulation()" '+(!valid?"disabled":"")+' style="width:100%;margin-top:9px">＋ Afegir torn a la simulació</button><div class="stats forecast-stats" style="margin-top:12px"><div class="stat blue"><b>'+plainHours(total)+' h</b><span>Hores simulades</span></div><div class="stat green"><b>'+plainHours(projected)+' h</b><span>Còmput estimat</span></div><div class="stat purple"><b>'+plainHours(remaining)+' h</b><span>Pendents després</span></div><div class="stat orange"><b>'+fmtHours(c.saldo+total)+'</b><span>Saldo estimat vs avui</span></div></div><div class="sim-list">'+(list||'<div class="empty">Encara no has afegit cap torn.</div>')+'</div><button class="btn secondary small" type="button" onclick="clearShiftSimulations()" '+(!shiftSimulations.length?"disabled":"")+' style="width:100%;margin-top:8px">Esborrar tota la simulació</button><p class="hint">Es calculen les hores segons els horaris configurats. Només s’hi inclouen torns de treball; no s’hi simulen festes, permisos ni altres conceptes. El saldo estimat compara aquestes hores amb el ritme previst d’avui.</p>';
}
function addShiftSimulation(){
 const date=document.getElementById("simDate")?.value,shiftId=document.getElementById("simShift")?.value,today=todayKey(),end=String(state.anyInici+1)+"-01-31";
 if(!date||date<=today||date>end){toast("Tria una data futura dins del període anual");return}
 if(shiftSimulations.some(x=>x.date===date)){toast("Ja hi ha un torn simulat en aquesta data");return}
 if(!state.torns.some(s=>s.id===shiftId&&s.id!=="festa")){toast("Torn no disponible");return}
 shiftSimulations.push({date,shiftId});renderShiftSimulator();
}
function removeShiftSimulation(date){shiftSimulations=shiftSimulations.filter(x=>x.date!==date);renderShiftSimulator()}
function clearShiftSimulations(){shiftSimulations=[];renderShiftSimulator()}

function renderMore(){for(const id of["appVersion","homeVersion"]){const av=document.getElementById(id);if(av)av.textContent="Codex GH v"+APP_VERSION}document.getElementById("cfgHours").value=state.horesAnuals;document.getElementById("cfgVac").value=state.vacancesTotals;document.getElementById("cfgPers").value=state.assumptesTotals;document.getElementById("cfgBlue").value=state.blausTotals;document.getElementById("cfgGnp").value=state.gnpTotals;document.getElementById("cfgGnit").value=state.gnitTotals;document.getElementById("cfgAccum").value=state.acumTotals;document.getElementById("cfgTitle").value=state.titol;document.getElementById("cfgSubtitle").value=state.subtitol;document.getElementById("cfgTip").value=state.tip||"";
 const darkEl=document.getElementById("cfgDark");if(darkEl)darkEl.value=state.darkMode||"auto";
 const notEl=document.getElementById("cfgNotify");if(notEl)notEl.checked=!!state.notifyDaily;document.getElementById("shiftConfig").innerHTML=state.torns.map((s,i)=>`<div class="setting-row"><div><strong><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${escapeHtml(s.color||"#93c5fd")};margin-right:6px;vertical-align:-1px"></span>${escapeHtml(s.nom)}</strong><small>${s.inici} → ${s.fi} · ${s.hores} h</small></div><div style="display:flex;align-items:center;gap:7px"><input type="color" value="${escapeHtml(s.color||"#93c5fd")}" title="Color del torn" onchange="setShiftColor(${i},this.value)" style="width:38px;height:32px;padding:2px;margin:0"><button class="btn secondary small" onclick="editShift(${i})">Editar</button><button class="btn danger small" onclick="deleteShift(${i})">Esborrar</button></div></div>`).join("");document.getElementById("pwaStatus").textContent=window.matchMedia("(display-mode: standalone)").matches?"Aplicació instal·lada.":"Pots instal·lar-la com a PWA si el navegador ho permet."}
function saveConfig(){
 state.horesAnuals=Number(document.getElementById("cfgHours").value)||0;
 state.vacancesTotals=Number(document.getElementById("cfgVac").value)||0;
 state.assumptesTotals=Number(document.getElementById("cfgPers").value)||0;
 state.blausTotals=Number(document.getElementById("cfgBlue").value)||0;
 state.gnpTotals=Number(document.getElementById("cfgGnp").value)||0;
 state.gnitTotals=Number(document.getElementById("cfgGnit").value)||0;
 state.acumTotals=Number(document.getElementById("cfgAccum").value)||0;
 state.titol=document.getElementById("cfgTitle").value.trim()||"Codex GH";
 state.subtitol=document.getElementById("cfgSubtitle").value.trim();
 state.tip=document.getElementById("cfgTip").value.trim();
 state.darkMode=document.getElementById("cfgDark")?.value||"auto";
 const wantNotify=!!document.getElementById("cfgNotify")?.checked;
 const finish=(msg)=>{save();applyTheme();scheduleDailyCheck();renderAll();toast(msg||"Configuració desada","success")};
 if(wantNotify && !state.notifyDaily){
   requestNotifyPermission().then(ok=>{state.notifyDaily=ok;finish(ok?"Recordatori activat":"Permís de notificacions denegat")});
 } else {
   state.notifyDaily=wantNotify;
   finish();
 }
}
async function editShift(i){
 const s=state.torns[i];if(!s)return;
 if(FIXED_SHIFTS[s.id]){await uiAlert("Aquest és un torn fix (horari marc). Només en pots canviar el color.");return}
 const v=await uiForm("Editar torn",[
  {id:"nom",label:"Nom",value:s.nom},
  {id:"inici",label:"Entrada",type:"time",value:s.inici},
  {id:"fi",label:"Sortida",type:"time",value:s.fi},
  {id:"hores",label:"Hores de referència",type:"number",step:"0.25",min:"0",value:s.hores}
 ]);
 if(!v)return;
 const hores=Number(v.hores);
 if(!Number.isFinite(hores)||hores<0||timeToMin(v.inici)===null||timeToMin(v.fi)===null){toast("Dades del torn no vàlides");return}
 s.nom=v.nom.trim()||s.nom;s.inici=v.inici;s.fi=v.fi;s.hores=hores;save();renderAll();toast("Torn actualitzat")
}
async function deleteShift(i){
 const s=state.torns[i];if(!s)return;
 const used=Object.values(state.registres).filter(r=>r?.tipus==="treball"&&r.torn===s.id).length;
 if(used){await uiAlert("No es pot eliminar aquest torn perquè hi ha "+used+" registre(s) que l'utilitzen. Canvia primer aquests registres a un altre torn.");return}
 if(!await uiConfirm("Eliminar el torn «"+s.nom+"»? Aquesta acció no es pot desfer.",{ok:"Eliminar",danger:true}))return;
 state.torns.splice(i,1);save();renderAll();toast("Torn eliminat");
}
function setShiftColor(i,color){if(!state.torns[i])return;state.torns[i].color=color;save();renderAll();toast("Color del torn actualitzat")}
async function addShift(){
 const v=await uiForm("Nou torn",[
  {id:"nom",label:"Nom",value:"Nou torn"},
  {id:"inici",label:"Entrada",type:"time",value:"07:00"},
  {id:"fi",label:"Sortida",type:"time",value:"14:30"},
  {id:"hores",label:"Hores de referència",type:"number",step:"0.25",min:"0",value:"7.5"},
  {id:"color",label:"Color",type:"color",value:"#93c5fd"}
 ],{ok:"Afegir"});
 if(!v||!v.nom.trim())return;
 const hores=Number(v.hores);
 if(!Number.isFinite(hores)||hores<0||timeToMin(v.inici)===null||timeToMin(v.fi)===null){toast("Dades del torn no vàlides");return}
 state.torns.push({id:"t_"+Date.now(),nom:v.nom.trim(),abbr:v.nom.trim().slice(0,4),hores,inici:v.inici,fi:v.fi,color:/^#[0-9a-fA-F]{6}$/.test(v.color)?v.color:"#93c5fd"});save();renderAll();toast("Torn afegit")
}

function exportJSON(){ensureHistory();try{localStorage.setItem(KEY+".lastExport",String(Date.now()))}catch(e){}const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});download(blob,`registre-horari-${state.anyInici}.json`);toast("Còpia JSON exportada")}
function importJSON(){document.getElementById("fileInput").click()}
document.getElementById("fileInput").addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=async()=>{let raw;try{raw=JSON.parse(reader.result);if(!raw||typeof raw!=="object"||Array.isArray(raw))throw 0}catch(err){await uiAlert("El fitxer no és un JSON vàlid.");e.target.value="";return}
 if(!await uiConfirm("Importar substituirà les dades actuals (se'n guarda una còpia al dispositiu). Continuar?",{ok:"Importar"})){e.target.value="";return}
 try{localStorage.setItem(KEY+".backup-"+Date.now(),JSON.stringify(state))}catch(err){}
 state=migrate(raw);save();renderAll();toast("Dades importades");e.target.value=""};reader.readAsText(f)})
function exportCSV(){const rows=[["Data","Tipus","Torn","Entrada","Sortida","Hores","Notes"]];Object.entries(state.registres).sort().forEach(([k,r])=>{const s=r.tipus==="treball"?getShift(r.torn):null;rows.push([k,TYPE_NAMES[r.tipus]||r.tipus,s?.nom||"",r.entrada||"",r.sortida||"",r.tipus==="treball"?r.hores||0:r.horesConcepte||0,(r.notes||"").replace(/"/g,'""')])});const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n");download(new Blob([csv],{type:"text/csv;charset=utf-8"}),`registre-horari-${state.anyInici}.csv`);toast("CSV exportat")}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function resetAll(){
  if(!await uiConfirm("Es crearà una còpia de seguretat i després s'esborraran totes les dades (també als altres dispositius). Continuar?",{ok:"Esborrar-ho tot",danger:true}))return;
  // Còpia fora del prefix que es recupera automàticament
  try{ localStorage.setItem("codexGHBackup-"+Date.now(),JSON.stringify(state)); }catch(e){}
  // Neteja també .latest perquè no reapareguin dades antigues
  try{ localStorage.removeItem(KEY+".latest"); }catch(e){}
  state=defaultState();
  save();
  renderAll();
  toast("Dades restablertes");
}
function openModal(id){document.getElementById(id).classList.add("open")}function closeModal(id){document.getElementById(id).classList.remove("open");if(id==="dayModal")editingDay=null;if(id==="trialModal")editingTrial=null}
function toast(msg,type){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.className="toast show"+(type?" "+type:"");clearTimeout(window.__toast);window.__toast=setTimeout(()=>{t.classList.remove("show")},type==="success"?2800:2200)}


/* ——— Tema, notificacions i PDF (2.1) ——— */


const PERMIT_FILTER={current:"tots"};
const PERMISOS_CATALOG=[
{id:"est_ret",cat:"lllicencia",freq:0,retribuit:true,tags:"estudis retribuida ispc promocio oposicio formacio administracio",titol:"Llicència per a estudis retribuïda (interès Administració)",resum:"Formació de promoció o provisió (concursos d'oposició d'ascens i d'especialitat). Es poden computar hores de treball segons planificació d'origen si són cursos ISPC o determinats per la DGP. No dóna dret a indemnitzacions per raó de servei.",com:"ATRI: Llicència d'estudis per interès Administració. Indicar a observacions quina formació.",termini:"Resolució: màx. 3 mesos. Silenci desestimatori.",pagat:"Retribuïda"},
{id:"est_no",cat:"lllicencia",freq:0,retribuit:false,tags:"estudis no retribuida matricula formacio",titol:"Llicència per a estudis no retribuïda",resum:"Estudis sobre matèries relacionades amb el lloc de treball. Cal informe favorable del comandament (àrea o superior). Denegació motivada. Sense indemnitzacions per raó de servei.",com:"ATRI: Llicència per estudis no retribuïts. Document d'estudis o pagament de matrícula.",termini:"Resolució: màx. 3 mesos. Silenci desestimatori.",pagat:"No retribuïda"},
{id:"prac_altre",cat:"lllicencia",freq:0,retribuit:false,tags:"practiques altre cos escala administracio oposicio",titol:"Llicència per pràctiques en un altre cos / Administració",resum:"Fase de pràctiques en concurs d'ascens CME sense optar per mantenir retribucions d'origen, o pràctiques per accedir a un altre cos d'una altra administració. Retribucions de funcionari en pràctiques a càrrec de l'altra administració (si escau).",com:"ATRI: Llicència per pràctiques en un altre cos, escala, categoria o administració. Document de pràctiques si és fora CME.",termini:"Resolució: màx. 3 mesos. Silenci desestimatori.",pagat:"Segons destinació de pràctiques (no retribucions d'origen Generalitat si fora CME)"},
{id:"prac_ret",cat:"lllicencia",freq:0,retribuit:true,tags:"practiques retribuides ascens origen",titol:"Llicència per pràctiques retribuïdes",resum:"Fase de pràctiques en concurs d'oposició d'ascens CME optant per mantenir les retribucions del lloc d'origen.",com:"ATRI: Llicència per pràctiques retribuïdes. Sense documentació addicional.",termini:"Resolució: màx. 3 mesos. Silenci desestimatori.",pagat:"Retribuïda (retribucions d'origen)"},
{id:"ll_propis",cat:"lllicencia",freq:0,retribuit:false,tags:"llicencia assumptes propis no remunerada 6 mesos",titol:"Llicència per a assumptes propis",resum:"Sense retribució. Màxim 6 mesos acumulats cada 2 anys. Mínim 1 dia natural. El període engloba de la primera a la darrera jornada planificada (no fraccionable entre dies intermedis). Subordinada a necessitats del servei.",com:"ATRI: Llicència per assumptes propis no remunerats. Sense documentació addicional.",termini:"Resolució: màx. 3 mesos. Silenci desestimatori.",pagat:"No retribuïda"},
{id:"ll_sind",cat:"lllicencia",freq:0,retribuit:true,tags:"sindicat funcions sindicals temps complet parcial",titol:"Llicència per exercici de funcions sindicals",resum:"A temps total o parcial, segons acord amb les organitzacions sindicals representatives del CME.",com:"A instància de l'organització sindical.",termini:"Resolució: màx. 3 mesos. Silenci estimatori.",pagat:"Retribuïda (quadrant PAR4 o RESIN segons modalitat)"},
{id:"matrimoni",cat:"permis",freq:1,retribuit:true,tags:"matrimoni casament convivència parella 15 dies",titol:"Permís per matrimoni o inici de convivència",resum:"15 dies naturals consecutius. Gaudiment dins l'any següent a la data del casament o de l'inici de la convivència.",com:"ATRI: Permís per matrimoni o parella de fet. Certificat/partida de matrimoni o documentació de convivència (escriptura, acta, registre de parelles de Catalunya).",termini:"Resolució: màx. 15 dies hàbils. Silenci estimatori.",pagat:"Retribuït · no recuperable"},
{id:"matrimoni_fam",cat:"permis",freq:0,retribuit:true,tags:"matrimoni familiar fill segon grau casament",titol:"Permís per matrimoni d'un familiar",resum:"1 dia de treball si coincideix amb jornada planificada (familiar fins a 2n grau). Fora de Catalunya: fins a 2 dies consecutius (dia de l'acte + anterior o posterior).",com:"ATRI. Certificat de matrimoni + llibre de família (o documentació de parentiu amb la parella).",termini:"Resolució: màx. 5 dies hàbils. Silenci estimatori.",pagat:"Retribuït · no recuperable"},
{id:"prenatal_emb",cat:"permis",freq:0,retribuit:true,tags:"prenatal embarassada examen part reproduccio urgencia",titol:"Permís prenatal per a embarassades",resum:"Temps necessari per exàmens prenatals, preparació al part i reproducció assistida dins la jornada (amb justificació). També urgències vinculades a l'embaràs. Inclou desplaçament (web mobilitat Generalitat).",com:"ATRI: Permís examen prenatal/preparació part/reproducció assistida. Justificant sanitari.",termini:"Exàmens/cursos: màx. 5 dies hàbils. Urgències: concedides amb la comunicació; justificar en 10 dies hàbils. Silenci estimatori.",pagat:"Retribuït · no recuperable"},
{id:"prenatal_acomp",cat:"permis",freq:0,retribuit:true,tags:"prenatal acompanyar progenitor no gestant",titol:"Permís prenatal per acompanyar la progenitora embarassada",resum:"El/la progenitor/a no gestant pot acompanyar en exàmens prenatals, preparació al part, reproducció assistida i urgències d'embaràs. Inclou desplaçament.",com:"ATRI (mateix tràmit prenatal). Justificant.",termini:"Com el prenatal d'embarassades (5 dies hàbils / urgències amb comunicació).",pagat:"Retribuït · no recuperable"},
{id:"prenatal_adop",cat:"permis",freq:0,retribuit:true,tags:"prenatal adopcio acolliment tramits catalunya",titol:"Permís prenatal en adopció o acolliment",resum:"Temps necessari per tràmits administratius d'adopció o acolliment permanent/preadoptiu fets a Catalunya, si cal fer-los dins la jornada.",com:"ATRI: Permís per tràmits adopció/acolliment. Document que indiqui que els tràmits s'han de fer en jornada laboral.",termini:"Resolució: màx. 5 dies. Silenci estimatori.",pagat:"Retribuït · no recuperable"},
{id:"dol_gest",cat:"permis",freq:0,retribuit:true,tags:"dol gestacional perdua gestacio avortament",titol:"Permís per dol gestacional",resum:"Pèrdua gestacional entre setmana 6 i dia 179: 3 dies hàbils per a la persona gestant, l'altra progenitora o familiar fins a 2n grau. A continuació del fet o de l'alta mèdica si hi ha hospitalització.",com:"ATRI: Permís per dol gestacional. Certificat mèdic (+ llibre de família / declaració progenitora segons cas).",termini:"Concedit amb la comunicació; justificar en 10 dies hàbils des de la reincorporació.",pagat:"Retribuït · no recuperable"},
{id:"prematur",cat:"permis",freq:0,retribuit:true,tags:"prematur hospitalitzat part 2 hores diaries",titol:"Permís per fill/a prematur o hospitalitzat després del part",resum:"El progenitor que no gaudeix del permís de naixement de la mare biològica: fins a 2 hores diàries amb retribucions íntegres mentre duri l'hospitalització. No acumulable amb la reducció de jornada equivalent.",com:"ATRI: Absència naix. fill prematur/hospitalitzat. Justificant mèdic + alta hospitalària al final.",termini:"Concedit amb la comunicació; justificar en 5 dies hàbils.",pagat:"Retribuït íntegrament · no recuperable"},
{id:"naix_no_mono",cat:"permis",freq:0,retribuit:true,tags:"naixement cura menor 19 setmanes no monoparental maternitat paternitat",titol:"Permís per naixement i cura (famílies no monoparentals)",resum:"19 setmanes (6 obligatòries ininterrompudes després del fet). Ampliacions per discapacitat del fill i part múltiple. Després de les 6: gaudiment continu o interromput (preavís 15 dies, setmanes completes). 11 setmanes dins 12 mesos; 2 setmanes fins als 8 anys. Ampliació per hospitalització del nounat (màx. 13 setmanes).",com:"ATRI + documentació de naixement/adopció/acolliment. Coordinar amb RRHH.",termini:"Segons normativa de naixement i cura; preavís 15 dies en gaudiment interromput.",pagat:"Retribuït · no recuperable · intransferible"},
{id:"naix_mono",cat:"permis",freq:0,retribuit:true,tags:"naixement cura menor 32 setmanes monoparental guarda exclusiva",titol:"Permís per naixement i cura (famílies monoparentals)",resum:"32 setmanes amb guarda legal exclusiva (6 obligatòries). Ampliacions per discapacitat i part múltiple. 22 setmanes dins 12 mesos; 4 fins als 8 anys. Mateixes regles d'interrupció, jornada parcial i ampliació per hospitalització del nounat.",com:"ATRI + acreditació de monoparentalitat / guarda exclusiva.",termini:"Preavís 15 dies en gaudiment interromput.",pagat:"Retribuït · no recuperable"},
{id:"adop_int",cat:"permis",freq:0,retribuit:true,tags:"adopcio acolliment internacional desplaçament 2 mesos",titol:"Permís per adopció o acolliment internacional",resum:"Si cal desplaçament previ al país d'origen del menor: fins a 2 mesos, fraccionable, només amb retribucions bàsiques.",com:"ATRI: Permís per adopció internacional. Sentència o document de necessitat de desplaçament.",termini:"Resolució: màx. 15 dies hàbils. Silenci estimatori.",pagat:"Només retribucions bàsiques"},
{id:"lact_no_mono",cat:"permis",freq:0,retribuit:true,tags:"lactancia 1 hora diària 12 mesos no monoparental compactacio",titol:"Permís per lactància (no monoparentals)",resum:"1 hora diària fins als 12 mesos del fill (divisible en 2×30 min). Dret individual intransferible de cada progenitor. Es pot fer borsa d'hores i gaudir en jornades completes (compactació després del permís de naixement). Increment proporcional en part múltiple.",com:"ATRI abans de l'inici del període de dret. Documentació del menor.",termini:"Còmput general des de la 17a setmana (gaudiment diari possible des de la 6a de descans obligatori).",pagat:"Retribuït · no recuperable"},
{id:"lact_mono",cat:"permis",freq:0,retribuit:true,tags:"lactancia 2 hores monoparental",titol:"Permís per lactància (monoparentals)",resum:"2 hores diàries (fraccions d'1 h a l'inici i final) fins als 12 mesos. Només per a la persona encarregada de la cura. Borsa d'hores / compactació amb les mateixes regles generals.",com:"ATRI amb antelació a l'inici del dret.",termini:"Còmput general des de la 28a setmana (gaudiment diari des de la 6a de descans obligatori).",pagat:"Retribuït · no recuperable"},
{id:"fill_disc",cat:"permis",freq:0,retribuit:true,tags:"fill discapacitat reunions visites centre educatiu sanitari",titol:"Permís per reunions/visites de fills amb discapacitat",resum:"Absència per assistir a reunions o visites en centres educatius especials o sanitaris on el fill/a discapacitat rep suport. Es pot concedir a dues persones pel mateix fet.",com:"ATRI: Permís per atendre fill discapacitat. Llibre de família + certificat discapacitat + justificant del centre.",termini:"Resolució: màx. 3 dies. Silenci estimatori.",pagat:"Retribuït · no recuperable"},
{id:"trasllat",cat:"permis",freq:1,retribuit:true,tags:"trasllat domicili mudança empadronament 2 dies",titol:"Permís per trasllat de domicili",resum:"2 dies planificats de treball consecutius. Des del dia del canvi o, com a màxim, en els 6 mesos següents. L'Administració pot verificar d'ofici l'empadronament.",com:"ATRI. Empadronament o factura de mudances/lloguer de furgoneta.",termini:"Resolució: màx. 5 dies hàbils. Silenci estimatori.",pagat:"Retribuït · no recuperable"},
{id:"deures_conc",cat:"permis",freq:0,retribuit:true,tags:"deures inexcusables conciliacio recollida menor urgencies familiar",titol:"Deures inexcusables de conciliació familiar i laboral",resum:"Temps indispensable (màx. 1 jornada) per: recollida de menor a requeriment del centre; tràmits d'incapacitat del menor; atenció a familiar de 1r grau amb repòs domiciliari després d'urgències (si no hi ha permís d'hospitalització). No delegable i sense altre permís aplicable.",com:"ATRI + justificants del centre/hospital. Cal que no es pugui delegar i que l'incompliment tingui conseqüències negatives.",termini:"El mateix dia del fet causant.",pagat:"Retribuït · no recuperable"},
{id:"deures_pub",cat:"permis",freq:1,retribuit:true,tags:"deures inexcusables public personal tribunal mesa electoral reservista",titol:"Deures inexcusables de caràcter públic o personal",resum:"Temps indispensable per obligacions inajornables (tribunals, meses electorals, requeriments amb data/hora, proves de reservista, etc.). No cobreix notari, banc, renovació DNI/passaport/carnet ni IRPF.",com:"ATRI: Permís per deures inexcusables. Citació prèvia + justificant d'assistència.",termini:"Resolució: màx. 5 dies hàbils. Silenci estimatori.",pagat:"Retribuït · no recuperable"},
{id:"nitjudici",cat:"permis",freq:1,retribuit:true,tags:"judici nit torn anterior 5 hores assistència",titol:"Permís pel torn de nit anterior a un judici",resum:"Si el judici és al matí després d'un torn de nit planificat, es pot demanar aquell torn. Es computen 5 h de treball efectiu (ampliables si el judici dura més i es justifica). Incompatible amb computar/cobrar les hores del judici de l'endemà.",com:"DAD 23. Comprovant d'assistència al judici.",termini:"Resolució: màx. 5 dies hàbils. Silenci estimatori.",pagat:"Retribuït (5 h efectives al còmput)"},
{id:"pha",cat:"permis",freq:1,retribuit:true,tags:"hores acumulades pha festa fraccionat 30 minuts",titol:"Permís per hores acumulades",resum:"Gaudir festa o part de jornada amb hores de la borsa d'acumulades. Fraccionable (mín. 30 min) si el servei ho permet. Denegació motivada.",com:"DAD32 (o DAD23 en casos vinculats a judici).",termini:"Resolució: màx. 7 dies hàbils. Silenci estimatori.",pagat:"Retribuït (compensa hores ja generades) · PHA"},
{id:"examens",cat:"permis",freq:1,retribuit:true,tags:"examen final centre oficial proves alliberadores català universitat",titol:"Permís per exàmens finals / proves alliberadores",resum:"1 dia per examen final en centre oficial d'ensenyament reglat; altres proves alliberadores: temps indispensable. No cobreix carnet de conduir ni habilitacions administratives. En torn de nit es pot optar pel torn anterior o el del dia.",com:"Justificant del centre. Processos selectius CME: només temps indispensable.",termini:"Segons tramitació ATRI.",pagat:"Retribuït · no recuperable"},
{id:"credit_sind",cat:"permis",freq:0,retribuit:true,tags:"credit horari sindical delegat prevencio 96 hores",titol:"Permís per crèdit horari sindical",resum:"Crèdit mensual nominal assignat pels sindicats (mín. 80% nominal + 20% lliure distribució). No acumulable al mes següent; generalment jornades senceres. 30 h/mes addicionals per delegats de prevenció.",com:"ATRI amb antelació mínima de 96 h + certificat DAD52 del sindicat.",termini:"Antelació 96 h abans de l'inici del gaudiment.",pagat:"Retribuït"},
{id:"hospital",cat:"permis",freq:1,retribuit:true,tags:"hospitalització malaltia greu intervenció familiar accident repòs",titol:"Permís per hospitalització / malaltia greu de familiar",resum:"Familiar fins a 2n grau: 5 jornades de treball consecutives (cònjuge, 1r grau o persona convivint a càrrec) o 4 (2n grau). Gaudiment dins 10 dies naturals del fet (o mentre dura l'hospitalització/repòs).",com:"Justificant mèdic/hospitalari. Es pot concedir a més d'una persona pel mateix fet.",termini:"Inici flexible mentre es manté l'hospitalització o el repòs; darrer dia d'inici = alta hospitalària.",pagat:"Retribuït · no recuperable"},
{id:"mort",cat:"permis",freq:1,retribuit:true,tags:"mort defunció dol familiar funeral",titol:"Permís per mort d'un familiar (fins a 2n grau)",resum:"1r grau/cònjuge: 3 dies (mateixa localitat) o 5 (altra). 2n grau: 2 o 4 dies. Dies = jornades planificades de treball consecutives. Si durant hospitalització es produeix la mort, es tanca aquell permís i neix el de mort.",com:"Documentació del fet causant. En torn de nit es pot optar pel torn anterior o el del fet.",termini:"Gaudir en 5 dies naturals (mateixa localitat) o 10 (altra) des del fet.",pagat:"Retribuït · no recuperable"},
{id:"metge",cat:"permis",freq:1,retribuit:true,tags:"consulta mèdica metge visita rehabilitació proves",titol:"Absència per consulta mèdica",resum:"Temps indispensable per anar i tornar. Preferentment fora d'horari; si no, declaració responsable ATRI + justificant amb hores. Proves invasives (colonoscòpia, etc.): jornada sencera.",com:"Justificant del centre amb nom i hores. Desplaçament segons web de mobilitat de la Generalitat.",termini:"Comunicar i acreditar segons circuit ATRI/unitat.",pagat:"Retribuït pel temps indispensable"},
{id:"viol_abs",cat:"permis",freq:0,retribuit:true,tags:"violencia masclista genere absencia justificada",titol:"Absències per situacions de violència masclista",resum:"Les faltes d'assistència de dones víctimes de violència masclista es consideren justificades segons serveis socials, policials o de salut.",com:"ATRI: Permís per situació violència de gènere. Informes socials/policials/salut o ordre de protecció.",termini:"Concedit amb la comunicació; justificar en 5 dies hàbils.",pagat:"Retribuït · justificat"},
{id:"flex_conc",cat:"permis",freq:0,retribuit:true,tags:"flexibilitat horària conciliació recuperable visita medica tutoria",titol:"Flexibilitat horària recuperable (conciliació)",resum:"1 a 7 hores per visites/proves mèdiques de cònjuge, parella, ascendents/descendents fins a 2n grau, o tutories escolars. Cal recuperar (preferentment la mateixa setmana; si no, en 4 setmanes).",com:"ATRI: Permís per flexib. horària recuperable. Justificant del centre + acreditació de parentiu/parella.",termini:"Resolució: màx. 3 dies hàbils. Silenci estimatori.",pagat:"Retribuït · recuperable"},
{id:"flex_disc",cat:"permis",freq:0,retribuit:true,tags:"flexibilitat fills discapacitats 2 hores centres",titol:"Flexibilitat horària per fills amb discapacitat",resum:"2 hores diàries de flexibilitat per conciliar horaris de centres d'educació especial o atenció. Recuperables dins la mateixa jornada diària.",com:"ATRI. Llibre de família + certificat discapacitat + horaris del centre.",termini:"Resolució: màx. 3 dies. Silenci estimatori.",pagat:"Retribuït · recuperable el mateix dia"},
{id:"flex_viol",cat:"permis",freq:0,retribuit:true,tags:"flexibilitat violencia masclista recuperable",titol:"Flexibilitat horària per violència masclista",resum:"Hores de flexibilitat necessàries per a protecció o assistència social. Recuperables dins la mateixa jornada diària.",com:"ATRI. Informes socials/policials/salut o ordre de protecció.",termini:"Concedit amb la comunicació; justificar en 5 dies hàbils.",pagat:"Retribuït · recuperable el mateix dia"},
{id:"flex_mens",cat:"permis",freq:0,retribuit:true,tags:"menstruació climateri flexibilitat salut una jornada mes",titol:"Flexibilitat per menstruació o climateri",resum:"Fins a 1 jornada planificada de treball al mes per menstruació o climateri amb afectació a la salut. Comunicar al cap d'unitat al més aviat possible. Recuperació en 4 mesos.",com:"ATRI: Absència per flexibilitat horària recuperable per menstruació / climateri. Sense justificació mèdica detallada.",termini:"Recuperar en 4 mesos posteriors.",pagat:"Retribuït · recuperable · sense justificació"},
{id:"ap",cat:"permis",freq:1,retribuit:true,tags:"assumptes personals ap hores 68 fraccionat",titol:"Permís per a assumptes personals",resum:"Fins a 68 h per any complet de servei (o proporcional). Dies addicionals per triennis (2 al 6è; 1 per trienni des del 8è ≈ 8 h 20 min/dia). Fraccionable (mín. 30 min). Subordinat a necessitats del servei.",com:"Segons instrucció d'assumptes personals / ATRI. Sense justificació del motiu.",termini:"Gaudiment dins l'any policial; límit general 31 de gener. Denegació motivada.",pagat:"Retribuït · no recuperable · sense justificació del motiu"},
{id:"parental",cat:"permis",freq:0,retribuit:false,tags:"parental cura fill acolliment 8 setmanes no retribuït",titol:"Permís parental per cura de fill/a o menor en acolliment",resum:"No retribuït. Fins a 8 setmanes (contínues o discontínues), a temps complet o parcial, fins que el menor compleixi 8 anys (per a menors en acolliment >1 any). Preavís 15 dies.",com:"Sol·licitud amb dates d'inici i final. L'Administració pot proposar alternatives si el servei no ho permet.",termini:"Antelació mínima 15 dies.",pagat:"No retribuït (alta i cotització a temps complet)"},
{id:"familiar_nr",cat:"permis",freq:0,retribuit:false,tags:"atendre familiar sense retribució 10 dies 3 mesos",titol:"Permís sense retribució per atendre un familiar",resum:"Familiar fins a 2n grau. Mínim 10 dies, màxim 3 mesos (prorrogable excepcionalment 3 mesos més). Incompatible amb compatibilitat (suspesa d'ofici).",com:"ATRI. Llibre de família o documentació de parella de fet.",termini:"Resolució: màx. 15 dies hàbils. Silenci estimatori.",pagat:"No retribuït"},
{id:"red_prematur",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio jornada prematur hospitalitzat 2 hores",titol:"Reducció per fill/a prematur o hospitalitzat després del part",resum:"Fins a 2 hores diàries amb disminució proporcional de retribucions mentre duri l'hospitalització. No acumulable amb el permís d'absència equivalent. Incompatible amb compatibilitat.",com:"Petició genèrica mentre no hi hagi tràmit ATRI. Certificat de naixement + certificat hospitalari d'ingrés/alta.",termini:"Resolució: màx. 1 mes. Silenci estimatori.",pagat:"Retribució proporcional"},
{id:"red_0_6",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio jornada fill 0 6 anys terç meitat 80 60",titol:"Reducció de jornada per cura de fill/a (0–6 anys)",resum:"1/3 de jornada amb 80% de retribucions; 1/2 amb 60%. També 1/4 o 3/8 amb reducció proporcional si el servei ho permet. Sol·licitud amb 1 mes d'antelació. No a dues persones pel mateix fet (excepte alternatiu). Incompatible amb compatibilitat.",com:"ATRI. Documentació de filiació.",termini:"Resolució: màx. 1 mes. Silenci estimatori. Antelació 1 mes.",pagat:"80% (1/3) o 60% (1/2); proporcional en altres fraccions"},
{id:"red_6_12",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio jornada fill 6 12 anys",titol:"Reducció de jornada per cura de fill/a (6–12 anys)",resum:"1/3, 1/2, 1/4 o 3/8 de jornada amb minoració proporcional de retribucions. Mateixes regles d'incompatibilitat i no duplicitat que 0–6 anys.",com:"ATRI: Red. de jornada per cura de fill menor de 12 anys o cura de familiar.",termini:"Resolució: màx. 1 mes. Antelació 1 mes.",pagat:"Proporcional a la jornada"},
{id:"red_12_14",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio jornada fill 12 14 anys",titol:"Reducció de jornada per cura de fill/a (12–14 anys)",resum:"1/3 o 1/2 de jornada amb deducció proporcional. Es regeix com a interès particular però la concessió no resta subordinada a les necessitats del servei.",com:"Segons circuit de reducció per interès particular / cura de menor.",termini:"Segons resolució (antelació típica 1 mes).",pagat:"Proporcional · no subordinada al servei"},
{id:"red_cancer",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio cancer malaltia greu fill menor retribucions intreges",titol:"Reducció per fill menor amb càncer o malaltia greu",resum:"Almenys 1/2 de jornada amb retribucions íntegres mentre hi hagi hospitalització i tractament continuat (atenció directa, contínua i permanent). Fins als 23 anys (o 26 amb discapacitat ≥65%). Cal que ambdós progenitors treballin.",com:"Informe del servei públic de salut / òrgan sanitari. Llista de malalties greus: RD 1148/2011.",termini:"Segons resolució administrativa específica.",pagat:"Retribucions íntegres (≥1/2 jornada)"},
{id:"red_malaltia_1r",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio familiar primer grau malaltia molt greu 1 mes 50",titol:"Reducció per familiar de 1r grau amb malaltia molt greu",resum:"Fins al 50% de jornada, retribuïda, màxim 1 mes. Una sola vegada pel mateix fet i malaltia. Es pot prorratejar entre titulars. Formes: diària, jornades fixes, torn concret o planificació del servei.",com:"Constància escrita de facultatiu que indiqui «malaltia molt greu» o informes mèdics justificatius.",termini:"Màxim 1 mes de durada.",pagat:"Retribuïda (fins al 50%)"},
{id:"red_fam_disc",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio familiar discapacitat dependencia atencio especial 2n grau",titol:"Reducció per familiar amb discapacitat / dependència",resum:"1/3 (80% retribucions) o 1/2 (60%) per familiar fins a 2n grau amb discapacitat ≥65%, dependència o necessitat d'atenció especial. No cal acreditar convivència. Incompatible amb compatibilitat.",com:"ATRI. Llibre de família + certificat ICASS/mèdic de discapacitat, dependència o atenció especial.",termini:"Resolució: màx. 1 mes. Silenci estimatori.",pagat:"80% (1/3) o 60% (1/2)"},
{id:"red_guarda_disc",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio guarda legal discapacitat sense activitat retribuida",titol:"Reducció per guarda legal de persona amb discapacitat",resum:"1/3 (80%) o 1/2 (60%) per persona amb discapacitat psíquica, física o sensorial sense activitat retribuïda, de la qual se'n tingui la guarda legal.",com:"ATRI. Document de guarda + certificat discapacitat + certificat AEAT (i vida laboral si cal).",termini:"Resolució: màx. 1 mes. Silenci estimatori.",pagat:"80% (1/3) o 60% (1/2)"},
{id:"red_viol",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio violencia genere masclista",titol:"Reducció de jornada per violència de gènere",resum:"1/2 jornada amb 60% de retribucions; o 1/3 (o fracció inferior) amb retribucions íntegres. Per a protecció o assistència social íntegra. Incompatible amb compatibilitat.",com:"ATRI (tràmits amb/sense minoració). Informes socials/policials/salut o ordre de protecció.",termini:"Resolució: màx. 1 mes. Silenci estimatori.",pagat:"60% (1/2) o íntegres (≤1/3)"},
{id:"red_disc_prop",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio discapacitat propia tractament",titol:"Reducció per discapacitat legalment reconeguda (pròpia)",resum:"Reducció equivalent al temps de tractament en centre públic o privat, sense pèrdua de retribucions. Cal informe mèdic de necessitat, periodicitat i que s'hagi de fer en horari laboral.",com:"ATRI. Certificat de discapacitat + informe mèdic + justificant mensual d'assistència al tractament.",termini:"Resolució: màx. 1 mes. Silenci estimatori.",pagat:"Retribucions íntegres"},
{id:"red_interes",cat:"reduccio",freq:0,retribuit:true,tags:"reduccio interes particular terç meitat un any",titol:"Reducció de jornada per interès particular",resum:"1/3 o 1/2 de jornada amb reducció proporcional. Període mínim 1 any. Forma de gaudiment: diària, jornades fixes, torn concret o planificació. Subordinada a necessitats del servei (excepte cura directa de fill <14 anys).",com:"Sol·licitud amb 1 mes d'antelació indicant dates, percentatge i forma de gaudiment. Revisable anualment.",termini:"Antelació mínima 1 mes. Resolució segons circuit.",pagat:"Proporcional a la jornada"}
];
function setPermitFilter(f){
  PERMIT_FILTER.current=f;
  document.querySelectorAll("#permitFilters button").forEach(b=>b.classList.toggle("on",b.dataset.f===f));
  renderPermisos();
}
function renderPermisos(){
  const q=(document.getElementById("permitSearch")?.value||"").trim().toLowerCase();
  const f=PERMIT_FILTER.current;
  let list=PERMISOS_CATALOG.filter(p=>{
    if(f==="retribuit"&&!p.retribuit)return false;
    if(f==="no_retribuit"&&p.retribuit)return false;
    if(f==="lllicencia"&&p.cat!=="lllicencia")return false;
    if(f==="permis"&&p.cat!=="permis")return false;
    if(f==="frequents"&&!p.freq)return false;
    if(f==="reduccio"&&p.cat!=="reduccio")return false;
    if(!q)return true;
    const blob=(p.titol+" "+p.resum+" "+p.tags+" "+p.com+" "+p.pagat).toLowerCase();
    return q.split(/\s+/).every(w=>blob.includes(w));
  });
  const box=document.getElementById("permitList");
  const cnt=document.getElementById("permitCount");
  if(cnt)cnt.textContent=list.length?`${list.length} resultat(s)`:"Cap resultat amb aquesta cerca";
  if(!box)return;
  if(!list.length){box.innerHTML=`<div class="empty">Prova amb altres paraules (ex.: «judici», «mort», «68», «trasllat»).</div>`;return}
  box.innerHTML=list.map(p=>`<div class="permit-card">
    <h3>${escapeHtml(p.titol)}</h3>
    <div class="p-meta">
      <span class="chip ${p.retribuit?"ok-soft":"bad-soft"}">${p.retribuit?"Retribuït":"No retribuït"}</span>
      <span class="chip neu">${p.cat==="lllicencia"?"Llicència":p.cat==="reduccio"?"Reducció de jornada":"Permís / absència"}</span>
    </div>
    <div class="p-body">
      <p><strong>Què és:</strong> ${escapeHtml(p.resum)}</p>
      <p><strong>Terminis:</strong> ${escapeHtml(p.termini)}</p>
      <p><strong>Retribució:</strong> ${escapeHtml(p.pagat)}</p>
    </div>
    <div class="p-how"><strong>Com es demana:</strong> ${escapeHtml(p.com)}</div>
  </div>`).join("");
}

function openDetail(kind){
  const titles={accum:"Hores acumulades",vacances:"Vacances",assumptes:"Assumptes personals",gnp:"GNP (Guàrdia No Presencial)",nits:"Nits (22:00–06:00)",extres:"Hores extres",dies_blaus:"Dies Blaus",judicis:"Judicis pendents"};
  const c=calc();
  const items=[];
  if(kind==="judicis"){
    state.judicis.forEach((j,i)=>{
      if(!j.celebrat) items.push({i,label:j.data||"Sense data",sub:`${j.jutjat||"Judici"} · ${j.hora||""} · ${j.procediment||""}`,hoursLabel:""});
    });
  } else {
    Object.entries(state.registres).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,r])=>{
      if(!r?.tipus) return;
      let hours=null, sub="";
      if(kind==="vacances" && r.tipus==="vacances"){hours=Number(r.horesConcepte)||0;sub="Vacances"}
      else if(kind==="assumptes" && r.tipus==="assumptes"){hours=Number(r.horesConcepte)||0;sub="Assumptes personals"}
      else if(kind==="dies_blaus" && r.tipus==="dies_blaus"){hours=Number(r.horesConcepte)||0;sub="Dies Blaus · còmput general"}
      else if(kind==="gnp" && r.tipus==="guardia_np"){hours=Number(r.horesConcepte)||0;sub="GNP"}
      else if(kind==="extres" && r.tipus==="hores_extres"){hours=Number(r.horesConcepte)||0;sub="Extres"}
      else if(kind==="accum"){
        if(r.tipus==="hores_acum"){hours=-(Number(r.horesConcepte)||7.5);sub="Ús d'acumulades"}
        else if(r.tipus==="treball" && r.torn!=="festa"){
          const s=getShift(r.torn);
          let hr=Number(r.hores); if(!Number.isFinite(hr)||hr===0) hr=defaultShiftHours(s);
          if(isMorning(s) && hr<=7.5) hr=8;
          const over=isMorning(s)?Math.max(0,hr-7.5):Math.max(0,hr-(Number(s?.hores)||0));
          if(over>0){hours=over;sub=`Generades · ${s?.nom||"Treball"}`}
        }
      } else if(kind==="nits" && r.tipus==="treball"){
        const s=getShift(r.torn);
        if(isNightShift(s)){
          const nh=nightHoursForRecord(r,s);
          if(nh>0){hours=nh;sub=`${s?.nom||"Nit"} · ${r.entrada||s?.inici||"?"} → ${r.sortida||s?.fi||"?"} · torn ${plainHours(Number(r.hores)||defaultShiftHours(s))} h`}
        }
      }
      if(hours!==null){
        const d=parseKey(k);
        items.push({k,label:`${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,sub,hours});
      }
    });
  }
  const filtered = kind==="accum" ? items.filter(it=>Math.abs(it.hours)>=0.25) : items;
  let summary="";
  if(kind==="vacances") summary=`Usades: ${plainHours(c.vac)} h · Restants: ${plainHours(state.vacancesTotals-c.vac)} h · ${filtered.length} dia(es)`;
  else if(kind==="assumptes") summary=`Usats: ${plainHours(c.pers)} h · Restants: ${plainHours(state.assumptesTotals-c.pers)} h · ${filtered.length} dia(es) · (també descompten del còmput general)`;
  else if(kind==="dies_blaus") summary=`Usats: ${plainHours(c.blue)} h · Restants: ${plainHours(Math.max(0,(state.blausTotals||0)-c.blue))} h · ${filtered.length} dia(es) · (també descompten del còmput general)`;
  else if(kind==="gnp") summary=`GNP fetes: ${plainHours(c.gnp)} h · ${filtered.length} dia(es) · (no afecten el còmput general)`;
  else if(kind==="nits") summary=`Hores de nit 22:00–06:00: ${plainHours(c.gnit)} h · ${filtered.length} dia(es) · (el torn sencer va al còmput general)`;
  else if(kind==="extres") summary=`Extres: ${plainHours(c.extra)} h · ${filtered.length} dia(es)`;
  else if(kind==="accum") summary=`Saldo: ${fmtHours(c.accum)} · Generades: ${plainHours(c.accExtra)} h · Usades: ${plainHours(c.accUsed)} h · ${filtered.length} moviment(s)`;
  else if(kind==="judicis") summary=`${filtered.length} judici(s) pendent(s)`;
  document.getElementById("detailTitle").textContent=titles[kind]||"Detall";
  document.getElementById("detailSummary").textContent=summary;
  const list=document.getElementById("detailList");
  if(!filtered.length){
    list.innerHTML=`<div class="empty">No hi ha registres en aquesta categoria${kind==="nits"?" (encara)":""}.</div>`;
  } else if(kind==="judicis"){
    list.innerHTML=filtered.map(it=>`<div class="row" onclick="closeModal('detailModal');openTrial(${it.i})"><div class="grow"><strong>${escapeHtml(it.label)}</strong><small>${escapeHtml(it.sub)}</small></div></div>`).join("");
  } else {
    list.innerHTML=filtered.map(it=>{
      const chip=it.hours<0?`<span class="chip warn">${fmtHours(it.hours)}</span>`:`<span class="chip info">${plainHours(it.hours)} h</span>`;
      return `<div class="row" onclick="closeModal('detailModal');openDay('${it.k}')"><div class="grow"><strong>${escapeHtml(it.label)}</strong><small>${escapeHtml(it.sub)}</small></div>${chip}</div>`;
    }).join("");
  }
  openModal("detailModal");
}

function applyTheme(){
  const mode=state.darkMode||"auto";
  const root=document.documentElement;
  root.classList.remove("dark","light");
  if(mode==="dark") root.classList.add("dark");
  else if(mode==="light") root.classList.add("light");
  else if(window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if((state.darkMode||"auto")==="auto")applyTheme()});

async function requestNotifyPermission(){
  if(!("Notification" in window)){toast("Aquest navegador no suporta notificacions","warn");return false}
  if(Notification.permission==="granted")return true;
  if(Notification.permission==="denied"){toast("Notificacions bloquejades al navegador","warn");return false}
  try{const p=await Notification.requestPermission();return p==="granted"}catch(e){return false}
}
function scheduleDailyCheck(){
  clearTimeout(window.__dailyCheck);
  if(!state.notifyDaily||!("Notification" in window)||Notification.permission!=="granted")return;
  const now=new Date();
  // Check every 30 min while app is open; also on visibility
  const tick=()=>{
    if(!state.notifyDaily)return;
    const key=todayKey();
    if(!state.registres[key] && now.getHours()>=18){
      const last=localStorage.getItem(KEY+".lastNotify");
      if(last!==key){
        try{new Notification("Codex GH",{body:"Encara no has registrat la jornada d'avui.",icon:"app-icon.png",tag:"codexgh-daily"});localStorage.setItem(KEY+".lastNotify",key)}catch(e){}
      }
    }
  };
  tick();
  window.__dailyCheck=setInterval(tick,30*60*1000);
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")scheduleDailyCheck()});

function exportPDF(){
  const c=calc();
  const year=state.anyInici;
  const rows=Object.entries(state.registres).sort().map(([k,r])=>{
    const s=r.tipus==="treball"?getShift(r.torn):null;
    const h=r.tipus==="treball"?(r.hores||0):(r.horesConcepte||0);
    return `<tr><td>${k}</td><td>${TYPE_NAMES[r.tipus]||r.tipus}</td><td>${s?.nom||"—"}</td><td>${plainHours(h)}</td><td>${(r.notes||"").replace(/</g,"&lt;")}</td></tr>`;
  }).join("");
  const htmlDoc=`<!doctype html><html lang="ca"><head><meta charset="utf-8"><title>Resum ${year}/${year+1}</title>
  <style>
    body{font-family:system-ui,sans-serif;color:#111;padding:24px;max-width:900px;margin:auto}
    h1{font-size:1.4rem;margin:0 0 4px} h2{font-size:1.05rem;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
    .meta{color:#555;font-size:.85rem;margin-bottom:16px}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0 20px}
    .stat{border:1px solid #ddd;border-radius:8px;padding:10px} .stat b{display:block;font-size:1.15rem}
    .stat span{font-size:.7rem;color:#666}
    table{width:100%;border-collapse:collapse;font-size:.8rem} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f1f5f9} tr:nth-child(even){background:#f8fafc}
    @media print{body{padding:0} .no-print{display:none}}
  </style></head><body>
  <h1>${escapeHtml(state.titol||"Codex GH")} · ${year}/${String(year+1).slice(-2)}</h1>
  <div class="meta">${escapeHtml(state.subtitol||"")} ${state.tip?" · "+escapeHtml(state.tip):""} · Generat el ${new Date().toLocaleString("ca-ES")}</div>
  <h2>Resum anual</h2>
  <div class="stats">
    <div class="stat"><b>${plainHours(c.worked)} h</b><span>Hores fetes</span></div>
    <div class="stat"><b>${plainHours(state.horesAnuals)} h</b><span>Objectiu anual</span></div>
    <div class="stat"><b>${fmtHours(c.saldo)}</b><span>Saldo vs ritme</span></div>
    <div class="stat"><b>${Math.round(c.progress)}%</b><span>Progrés</span></div>
    <div class="stat"><b>${plainHours(state.vacancesTotals-c.vac)} h</b><span>Vacances restants</span></div>
    <div class="stat"><b>${plainHours(state.assumptesTotals-c.pers)} h</b><span>Assumptes restants</span></div>
    <div class="stat"><b>${plainHours(c.gnit)} h</b><span>Nits</span></div>
    <div class="stat"><b>${plainHours(c.extra)} h</b><span>Extres</span></div>
  </div>
  <h2>Registres (${Object.keys(state.registres).length})</h2>
  <table><thead><tr><th>Data</th><th>Tipus</th><th>Torn</th><th>Hores</th><th>Notes</th></tr></thead>
  <tbody>${rows||"<tr><td colspan=5>Sense registres</td></tr>"}</tbody></table>
  <p class="no-print" style="margin-top:24px"><button onclick="window.print()" style="padding:10px 18px;font-size:1rem;cursor:pointer">Imprimir / Desar com a PDF</button>
  <button onclick="window.close()" style="padding:10px 18px;margin-left:8px;cursor:pointer">Tancar</button></p>
  <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script>
  </body></html>`;
  const w=window.open("","_blank");
  if(!w){toast("Permet finestres emergents per exportar","warn");return}
  w.document.write(htmlDoc);w.document.close();
  toast("Resum obert · utilitza «Desar com a PDF»","success");
}


function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
function updateInstallBanner(){const b=document.getElementById("installBanner"),btn=document.getElementById("installBtn");if(!b)return;const ready=!!deferredPrompt;const visible=ready&&!isStandalone()&&!localStorage.getItem(KEY+".installDismissed");b.classList.toggle("show",visible);if(btn)btn.style.display=ready&&!isStandalone()?"inline-block":"none"}
function dismissInstall(){localStorage.setItem(KEY+".installDismissed","1");document.getElementById("installBanner")?.classList.remove("show");document.getElementById("installBtn")?.style.setProperty("display","none")}
async function installApp(){if(isStandalone())return;if(!deferredPrompt){toast("La instal·lació encara no està disponible en aquest navegador.");return}const promptEvent=deferredPrompt;deferredPrompt=null;updateInstallBanner();
backupReminder();try{promptEvent.prompt();const choice=await promptEvent.userChoice;if(choice.outcome==="accepted")toast("Instal·lació iniciada")}catch(e){deferredPrompt=promptEvent;updateInstallBanner()}}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;updateInstallBanner()});
window.addEventListener("appinstalled",()=>{deferredPrompt=null;localStorage.removeItem(KEY+".installDismissed");updateInstallBanner();toast("Codex GH instal·lat")});
window.addEventListener("online",()=>toast("Connexió recuperada"));window.addEventListener("offline",()=>toast("Mode offline"));
if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try{
      // Quan arriba una versió nova del service worker, recarrega una vegada perquè s'apliqui sense haver de tancar l'app.
      let reloaded=false,had=!!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange",()=>{if(had&&!reloaded){reloaded=true;location.reload()}had=true});
      const registration=await navigator.serviceWorker.register("sw.js");
      await registration.update();
    }catch(e){}
  });
}

/* --- Accés: compte d'usuari (Firebase). Sense Firebase configurat l'app funciona en local, sense pantalla de bloqueig. --- */
function authConfigured(){const c=window.FIREBASE_CONFIG;return !!(c&&c.apiKey&&!/^PEGA/.test(c.apiKey))}
function tryUnlock(e){if(e)e.preventDefault();if(authConfigured())window.RHSync&&RHSync.login();return false}
function enforceLock(){
  const screen=document.getElementById("lockScreen");if(!screen)return;
  if(!authConfigured()){screen.classList.add("hidden");return}
  // sync.js amaga la pantalla quan hi ha sessió iniciada.
  document.getElementById("lockEmail").style.display="";
  document.getElementById("lockRegister").style.display="";
  document.getElementById("lockReset").style.display="";
  const i=document.getElementById("lockInput");i.removeAttribute("inputmode");i.placeholder="Contrasenya";
  document.getElementById("lockSub").textContent="Inicia sessió o crea el teu compte";
  screen.classList.remove("hidden");
}
enforceLock();
// Aplica un estat rebut del núvol (sync.js)
function applyRemoteState(raw){
  state=migrate(raw);
  const payload=JSON.stringify(state);
  localStorage.setItem(KEY,payload);localStorage.setItem(KEY+".latest",payload);
  window.__lastContent=null;
  renderAll();
}

if(window.HomeActions)HomeActions.init();
load();
applyTheme();
scheduleDailyCheck();
if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
updateInstallBanner();
// Càlcul automàtic d'hores des d'entrada/sortida
(function(){
  const start=document.getElementById("dayStart");
  const end=document.getElementById("dayEnd");
  const hrs=document.getElementById("dayHours");if(hrs){hrs.readOnly=true;hrs.title="Calculades automàticament a partir de l'entrada i la sortida"}
  if(start&&end){
    ["input","change"].forEach(ev=>{
      start.addEventListener(ev, calcHoursFromTimes);
      end.addEventListener(ev, calcHoursFromTimes);
    });
  }
})();
