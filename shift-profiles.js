/* Codex GH 2.5.0 — Perfils i planificació de torns
   La planificació és independent de state.registres i no entra al còmput d'hores. */
(function(){
 "use strict";
 if(!Array.isArray(state.shiftProfiles))state.shiftProfiles=[];
 if(!state.planOverrides||typeof state.planOverrides!=="object")state.planOverrides={};
 if(!state.planExtras||typeof state.planExtras!=="object")state.planExtras={};
 if(typeof state.activeShiftProfileId!=="string")state.activeShiftProfileId="";
 const labels={mati:"Matí",tarda:"Tarda",nit:"Nit",festa:"Festa",cs_dia:"Cap de setmana dia",cs_nit:"Cap de setmana nit",fd:"Festiu dia",fn:"Festiu nit",treball:"Treball (sense torn assignat)"};
 const options=()=>state.torns.map(s=>({id:s.id,label:s.nom}));
 function parsePattern(raw){
  return String(raw||"").split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean).map(x=>{
   const v=x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
   const aliases={m:"mati",matí:"mati",mati:"mati",t:"tarda",tarda:"tarda",n:"nit",nit:"nit",d:"cs_dia",dia:"cs_dia",f:"festa",festa:"festa",descans:"festa",tr:"treball",treball:"treball","cap de setmana dia":"cs_dia","cap de setmana nit":"cs_nit","nit cap de setmana":"cs_nit"};
   return aliases[v]||state.torns.find(s=>s.id===x||s.nom.toLowerCase()===v)?.id||"";
  }).filter(Boolean);
 }
 function weekStart(d){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
 function mod(n,m){return ((n%m)+m)%m}
 function planForDate(dateKey){
  if(state.planOverrides?.[dateKey])return state.planOverrides[dateKey];
  const p=state.shiftProfiles.find(x=>x.id===state.activeShiftProfileId);
  if(!p||!p.pattern?.length||!p.anchorDate)return "";
  const d=new Date(dateKey+"T12:00:00"),a=new Date(p.anchorDate+"T12:00:00");
  const diff=p.unit==="day"?Math.round((d-a)/86400000):Math.round((weekStart(d)-weekStart(a))/604800000);
  return p.pattern[mod(diff+(Number(p.phase)||0),p.pattern.length)]||"";
 }
 function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
 function decorateCalendar(){
  document.querySelectorAll("#calendar .day").forEach(el=>{
   const k=(el.getAttribute("onclick")||"").match(/clickDay\('([^']+)'\)/)?.[1];
   if(!k||state.registres[k])return;
   const id=planForDate(k),s=state.torns.find(x=>x.id===id),extras=state.planExtras?.[k]||[];if(!s&&!extras.length)return;
   el.classList.add("planned-shift");el.style.setProperty("--record-color",s.color||"#93c5fd");
   const kind=el.querySelector(".kind"),hrs=el.querySelector(".hrs");
   if(kind)kind.textContent="Pla: "+(s.abbr||s.nom);
   if(hrs)hrs.textContent="previst";
   el.title=(s?"Torn teòric: "+s.nom:"Servei addicional planificat")+(extras.length?" · Addicionals: "+extras.map(x=>state.torns.find(t=>t.id===x)?.nom||x).join(", "):"")+" · No és un registre real";
  });
 }
 function decorateWeek(){
  document.querySelectorAll("#weekList .week-row").forEach(el=>{
   const k=(el.getAttribute("onclick")||"").match(/clickWeekDay\('([^']+)'\)/)?.[1];
   if(!k||state.registres[k])return;
   const id=planForDate(k),s=state.torns.find(x=>x.id===id),extras=state.planExtras?.[k]||[];if(!s&&!extras.length)return;
   el.classList.add("planned-shift");el.style.setProperty("--record-color",s.color||"#93c5fd");
   const strong=el.querySelector("strong"),small=el.querySelector("small"),sum=el.querySelector(".week-sum");
   if(strong)strong.textContent=s?"Previst: "+s.nom:"Servei addicional";
   if(small)small.textContent=(s?((s.inici||"")+" → "+(s.fi||"")):"")+" · "+(extras.length?"Addicionals: "+extras.map(x=>state.torns.find(t=>t.id===x)?.nom||x).join(", "):"Horari teòric");
   if(sum)sum.textContent="Pla";
  });
 }
 function renderProfiles(){
  const host=document.getElementById("shiftProfilesPanel");if(!host)return;
  const profiles=state.shiftProfiles||[],active=profiles.find(p=>p.id===state.activeShiftProfileId);
  const shiftOpts=options().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.label)+'</option>').join("");
  const rows=profiles.map(p=>{
   const isActive=p.id===state.activeShiftProfileId;
   const pattern=p.pattern.map(id=>labels[id]||state.torns.find(s=>s.id===id)?.nom||id).join(" → ");
   return '<div class="row" style="align-items:flex-start"><div class="grow"><strong>'+esc(p.name)+' '+(isActive?'<span class="chip ok">Actiu</span>':'')+'</strong><small>'+esc(p.kindLabel)+' · '+esc(p.unit==="day"?"Cicle per dies":"Cicle per setmanes")+' · Referència '+esc(p.anchorDate)+' · '+esc(pattern)+'</small></div><div style="display:flex;gap:6px;flex-wrap:wrap">'+(isActive?'':'<button class="btn primary small" type="button" onclick="activateShiftProfile(\''+esc(p.id)+'\')">Activar</button>')+'<button class="btn danger small" type="button" onclick="deleteShiftProfile(\''+esc(p.id)+'\')">Eliminar</button></div></div>';
  }).join("");
  const today=new Date(),defaultDate=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const extraRows=Object.entries(state.planExtras||{}).sort().flatMap(([date,ids])=>(ids||[]).map((id,i)=>({date,id,i}))).map(x=>{const s=state.torns.find(t=>t.id===x.id);return '<div class="row"><div class="grow"><strong>'+esc(x.date)+' · + '+esc(s?.nom||x.id)+'</strong><small>Servei addicional al pla base</small></div><button class="btn danger small" onclick="removePlanExtra(\''+esc(x.date)+\',\'+x.i+\')">Treure</button></div>'}).join("");
  const overrideRows=Object.entries(state.planOverrides||{}).sort().map(([date,id])=>{
   const s=state.torns.find(x=>x.id===id);
   return '<div class="row"><div class="grow"><strong>'+esc(date)+' · '+esc(s?.nom||id)+'</strong><small>Servei puntual / canvi de planificació</small></div><button class="btn danger small" onclick="removePlanOverride(\''+esc(date)+'\')">Treure</button></div>';
  }).join("");
  host.innerHTML=
   '<div class="form-grid"><div><label for="profileKind">Tipus de quadrant</label><select id="profileKind" onchange="profileKindChanged()"><option value="q5">Q5</option><option value="q3">Q3</option><option value="7x7">7x7</option><option value="investigacio">Investigació / especial flexible</option><option value="custom">Altres / personalitzat</option></select></div><div><label for="profileName">Nom del perfil / escamot</label><input id="profileName" placeholder="Ex. Q5 · Escamot B"></div><div><label for="profileAnchor">Dilluns de referència</label><input id="profileAnchor" type="date" value="'+defaultDate+'"></div><div><label for="profileUnit">Rotació</label><select id="profileUnit"><option value="week">Per setmanes</option><option value="day">Per dies</option></select></div><div><label for="profilePhase">Fase que correspon a la setmana/dia de referència</label><select id="profilePhase"></select></div></div>'+
   '<label for="profilePattern">Seqüència del cicle (separada per comes)</label><input id="profilePattern" value="Matí,Festa,Tarda,Nit,Festa" placeholder="Matí,Festa,Tarda,Nit,Festa"><p class="hint" id="profileHint">Q5: cada element representa una setmana. La rotació continua entre anys; no es reinicia al febrer.</p>'+
   '<button class="btn primary" type="button" onclick="createShiftProfile()" style="width:100%;margin:8px 0 12px">＋ Crear perfil de quadrant</button>'+
   (rows||'<div class="empty">Encara no hi ha cap perfil de torn. Crea’n un per generar la planificació.</div>')+
   (active?'<div class="card" style="margin-top:12px;padding:12px"><strong>Perfil actiu: '+esc(active.name)+'</strong><p class="hint">El calendari mostrarà els torns previstos quan no hi hagi cap registre real. Els registres, vacances i canvis personals tenen prioritat visual.</p></div>':'')+
   '<div class="card" style="margin-top:12px;padding:12px"><strong>Afegir servei puntual o canvi de planificació</strong><div class="form-grid" style="margin-top:8px"><div><label for="overrideDate">Data</label><input type="date" id="overrideDate" value="'+defaultDate+'"></div><div><label for="overrideShift">Servei</label><select id="overrideShift">'+shiftOpts+'</select></div></div><button class="btn secondary small" type="button" onclick="savePlanOverride()" style="width:100%;margin-top:8px">Afegir al pla</button><div style="margin-top:8px">'+(overrideRows||'<p class="hint">Encara no hi ha serveis puntuals.</p>')+'</div></div>'+
   '<div class="card" style="margin-top:12px;padding:12px"><strong>Afegir servei addicional (sense substituir el torn base)</strong><div class="form-grid" style="margin-top:8px"><div><label for="extraDate">Data</label><input type="date" id="extraDate" value="'+defaultDate+'"></div><div><label for="extraShift">Servei addicional</label><select id="extraShift">'+shiftOpts+'</select></div></div><button class="btn secondary small" type="button" onclick="savePlanExtra()" style="width:100%;margin-top:8px">Afegir servei addicional</button><div style="margin-top:8px">'+(extraRows||'<p class="hint">Encara no hi ha serveis addicionals.</p>')+'</div></div>'+
   '<div class="card" style="margin-top:12px;padding:12px"><strong>Marc horari 2026–2030</strong><p class="hint">1.580 h anuals · mínim 8 dies de festa al mes (4 en cap de setmana) · Q5, Q3, 7x7 i dilluns-divendres com a quadrants marc quan correspongui. La planificació anual assigna explícitament el torn de cada jornada. Les unitats d’investigació tenen règim especial flexible; la seva planificació concreta no s’ha de deduir d’una rotació genèrica.</p><p class="hint">Fonts: <a href="https://uspac.cat/wp-content/uploads/2025/12/Q5_2026.pdf" target="_blank" rel="noopener">Q5 USPAC 2026</a> · <a href="https://uspac.cat/wp-content/uploads/2025/12/Q3_2026.pdf" target="_blank" rel="noopener">Q3 USPAC 2026</a> · <a href="https://spc-me.cat/wp-content/uploads/2026/01/acord-de-millora.pdf" target="_blank" rel="noopener">Acord de millora 2026–2030</a></p></div>'+
   '<p class="hint">Important: el pla és una previsió visual. Per comptar hores, registrar vacances o reflectir un canvi real, continua utilitzant «Registrar». Així no es dupliquen hores ni es modifiquen dades antigues.</p>';
  profileKindChanged();
 }
 window.profileKindChanged=function(){
  const kind=document.getElementById("profileKind")?.value||"q5",pat=document.getElementById("profilePattern"),unit=document.getElementById("profileUnit"),hint=document.getElementById("profileHint"),phase=document.getElementById("profilePhase");
  if(!pat||!unit||!hint||!phase)return;
  const defaults={q5:{pattern:"",unit:"day",hint:"Q5: hi ha cinc calendaris diferents (E1–E5). No s’aplica una seqüència genèrica: cal carregar el patró diari verificat de l’escamot i la seva data d’ancoratge."},investigacio:{pattern:"Matí,Tarda",unit:"week",hint:"Investigació / especial flexible: alternança setmanal de matins i tardes. Els serveis de cap de setmana i nits s’afegeixen com a serveis puntuals."},q3:{pattern:"",unit:"day",hint:"Q3: hi ha tres calendaris diferents (A–C). El document USPAC 2026 identifica treball/festa; cal confirmar el torn i l’ancoratge de cada escamot abans d’extrapolar."},"7x7":{pattern:"",unit:"day",hint:"7x7: cal seleccionar l’escamot i carregar la seqüència diària del document vigent. No hi ha cap plantilla 2026 actualitzada confirmada en les fonts consultades."},custom:{pattern:"",unit:"week",hint:"Defineix el cicle propi i la seva durada."}};
  const d=defaults[kind];pat.value=d.pattern;unit.value=d.unit;hint.textContent=d.hint;
  const parts=parsePattern(pat.value);phase.innerHTML=parts.map((id,i)=>'<option value="'+i+'">'+(i+1)+' · '+esc(labels[id]||state.torns.find(s=>s.id===id)?.nom||id)+'</option>').join("");
  pat.oninput=()=>{const p=parsePattern(pat.value);phase.innerHTML=p.map((id,i)=>'<option value="'+i+'">'+(i+1)+' · '+esc(labels[id]||state.torns.find(s=>s.id===id)?.nom||id)+'</option>').join("")};
 };
 window.createShiftProfile=function(){
  const kind=document.getElementById("profileKind").value,raw=document.getElementById("profilePattern").value,pattern=parsePattern(raw),anchor=document.getElementById("profileAnchor").value,unit=document.getElementById("profileUnit").value,phase=Number(document.getElementById("profilePhase").value)||0;
  if(!anchor||!pattern.length){toast("Indica una data de referència i una seqüència vàlida");return}
  const name=document.getElementById("profileName").value.trim()||({q5:"Q5",q3:"Q3","7x7":"7x7",investigacio:"Investigació / especial flexible",custom:"Torn personalitzat"}[kind]);
  const labelsKind={q5:"Q5",q3:"Q3","7x7":"7x7",investigacio:"Investigació / especial flexible",custom:"Personalitzat"};
  const p={id:"sp_"+Date.now(),name,kind,kindLabel:labelsKind[kind],unit,anchorDate:anchor,phase,pattern};
  state.shiftProfiles.push(p);state.activeShiftProfileId=p.id;save();renderAll();toast("Perfil creat i activat");
 };
 window.activateShiftProfile=function(id){if(!state.shiftProfiles.some(p=>p.id===id))return;state.activeShiftProfileId=id;save();renderAll();toast("Perfil de quadrant activat")};
 window.deleteShiftProfile=function(id){
  const p=state.shiftProfiles.find(x=>x.id===id);if(!p)return;
  if(!confirm("Eliminar el perfil «"+p.name+"»? Els registres reals no es tocaran."))return;
  state.shiftProfiles=state.shiftProfiles.filter(x=>x.id!==id);if(state.activeShiftProfileId===id)state.activeShiftProfileId=state.shiftProfiles[0]?.id||"";
  save();renderAll();toast("Perfil eliminat");
 };
 window.savePlanOverride=function(){
  const date=document.getElementById("overrideDate")?.value,id=document.getElementById("overrideShift")?.value;
  if(!date||!state.torns.some(s=>s.id===id)){toast("Tria una data i un servei");return}
  state.planOverrides[date]=id;save();renderAll();toast("Servei afegit al pla");
 };
 window.removePlanOverride=function(date){delete state.planOverrides[date];save();renderAll();toast("Servei puntual eliminat")};
 window.savePlanExtra=function(){const date=document.getElementById("extraDate")?.value,id=document.getElementById("extraShift")?.value;if(!date||!state.torns.some(s=>s.id===id)){toast("Tria una data i un servei");return}if(!Array.isArray(state.planExtras[date]))state.planExtras[date]=[];state.planExtras[date].push(id);save();renderAll();toast("Servei addicional afegit")};
 window.removePlanExtra=function(date,index){if(!Array.isArray(state.planExtras[date]))return;state.planExtras[date].splice(index,1);if(!state.planExtras[date].length)delete state.planExtras[date];save();renderAll();toast("Servei addicional eliminat")};
 const oldCalendar=renderCalendar,oldWeek=renderWeek,oldMore=renderMore;
 renderCalendar=function(){oldCalendar();decorateCalendar()};
 renderWeek=function(){oldWeek();decorateWeek()};
 renderMore=function(){oldMore();renderProfiles()};
 const originalRenderAll=renderAll;
 renderAll=function(){originalRenderAll();renderProfiles();decorateCalendar();decorateWeek()};
 renderAll();
})();