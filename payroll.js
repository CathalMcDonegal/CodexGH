/* Codex GH · Guàrdies nit/dia, perllongaments ponderats i pagaments especials */
(function(){
'use strict';
const st=()=>typeof state!=='undefined'?state:null;
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const dateOf=k=>new Date(k+'T00:00:00');
const mins=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
const isWeekendDate=d=>d.getDay()===0||d.getDay()===6;
const isHolidayDate=k=>{const s=st();if(s?.festius?.[k])return true;const d=dateOf(k),y=d.getFullYear(),e=easter(y);return k===key(addDays(e,-2))||k===key(addDays(e,1))||['01-01','01-06','05-01','06-24','08-15','09-11','09-24','10-12','12-06','12-08','12-25','12-26'].includes(k.slice(5));};
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(y,month-1,day)}
function windowsForYear(y){
 const out=[],add=(startDate,startTime,endDate,endTime,rate,label)=>out.push({a:new Date(startDate+'T'+startTime+':00').getTime(),b:new Date(endDate+'T'+endTime+':00').getTime(),rate,label});
 const one=(mmdd,from,to,rate,label)=>{const d=y+'-'+mmdd;add(d,from,d,to,rate,label)};
 const span=(mmdd,from,emmd,to,rate,label)=>{const ey=emmd<=mmdd?y+1:y;add(y+'-'+mmdd,from,ey+'-'+emmd,to,rate,label)};
 const good=key(addDays(easter(y),-2)),mon=key(addDays(easter(y),1));
 span(good.slice(5), '06:00',key(addDays(dateOf(good),1)).slice(5),'06:30',14,'Divendres Sant');
 one(mon.slice(5),'06:00','22:30',14,'Dilluns de Pasqua');
 one('05-01','06:00','22:30',14,'1 de maig');
 span('06-23','14:30','06-24','06:30',14,'23 de juny');
 one('06-24','06:00','22:30',14,'24 de juny');
 for(const d of ['12-06','12-08'])span(d,'06:00',d==='12-06'?'12-07':'12-09','06:30',14,d==='12-06'?'6 de desembre':'8 de desembre');
 span('12-24','14:30','12-25','06:30',24,'24 de desembre');
 one('12-25','06:00','22:30',24,'25 de desembre');
 one('12-26','06:00','22:30',24,'26 de desembre');
 span('12-31','14:30','01-01','06:30',24,'31 de desembre');
 one('01-01','06:00','22:30',24,'1 de gener');
 span('01-05','14:30','01-06','06:30',24,'5 de gener');
 one('01-06','06:00','22:30',24,'6 de gener');
 return out;
}
function specialPayForRecord(dateKey,r){
 const s=st();if(!s||r?.tipus!=='treball')return {eligible:false,hours:0,amount:0,windows:[]};
 const aMin=mins(r.entrada),bMin=mins(r.sortida);if(aMin===null||bMin===null)return {eligible:false,hours:0,amount:0,windows:[]};
 if(aMin===bMin&&!r?.sortidaDiaSeguent)return {eligible:false,hours:0,amount:0,windows:[],invalid:true,workedHours:0};
 const start=dateOf(dateKey).getTime()+aMin*60000;let end=dateOf(dateKey).getTime()+bMin*60000;if(r?.sortidaDiaSeguent||end<=start)end+=86400000;
 let windows=[];const y=dateOf(dateKey).getFullYear();
 for(let yy=y-1;yy<=y+1;yy++)windows.push(...windowsForYear(yy));
 const byMinute=new Map();
 for(const w of windows){const lo=Math.max(start,w.a),hi=Math.min(end,w.b);for(let t=Math.ceil(lo/60000);t<Math.floor(hi/60000);t++){const old=byMinute.get(t);if(!old||w.rate>old.rate)byMinute.set(t,{rate:w.rate,label:w.label})}}
 let total=byMinute.size/60,amount=0,partsMap=new Map();
 for(const v of byMinute.values()){amount+=v.rate/60;const k=v.rate+'|'+v.label;partsMap.set(k,(partsMap.get(k)||0)+1/60)}
 const parts=[...partsMap.entries()].map(([k,h])=>({rate:Number(k.split('|')[0]),label:k.slice(k.indexOf('|')+1),hours:h}));
 const eligible=total>=3-1e-9&&!r.horesExtresCobrades;
 return {eligible,hours:eligible?total:0,amount:eligible?Math.round(amount*100)/100:0,windows:parts,incompatible:!!r.horesExtresCobrades,workedHours:total};
}
function profileShiftForDate(k){
 const s=st();if(!s)return '';
 if(s.planOverrides?.[k])return s.planOverrides[k];
 const p=(s.shiftProfiles||[]).find(x=>x.id===s.activeShiftProfileId);if(!p||!p.pattern?.length||!p.anchorDate)return '';
 const d=dateOf(k);
 if(p.kind==='investigacio'&&(isWeekendDate(d)||isHolidayDate(k)))return '';
 const a=dateOf(p.anchorDate),weekStart=x=>{const z=new Date(x);z.setDate(z.getDate()-((z.getDay()+6)%7));return z};
 const diff=p.unit==='day'?Math.round((d-a)/86400000):Math.round((weekStart(d)-weekStart(a))/604800000);
 const n=((diff+(Number(p.phase)||0))%p.pattern.length+p.pattern.length)%p.pattern.length;
 return p.pattern[n]||'';
}
function plannedGuardForShift(k,id){
 const s=st(),shift=s?.torns?.find(x=>x.id===id);if(!shift||id==='festa')return 0;
 const night=['nit','cs_nit','fn'].includes(id)||(shift.nom||'').toLowerCase().includes('nit');
 if(night){const f=window.nightHoursInRange||(()=>0);return f(shift.inici||'22:00',shift.fi||'06:00')||8}
 const d=dateOf(k);if(isWeekendDate(d)||isHolidayDate(k))return window.recordHours({torn:id,entrada:shift.inici,sortida:shift.fi,hores:shift.hores},shift);
 return 0;
}
function guardAccounting(){
 const s=st();if(!s)return {used:0,planned:0,items:[]};
 let used=0,planned=0,items=[],plannedRanges=[];
 for(const [k,r] of Object.entries(s.registres||{})){
  if(r?.tipus!=='treball')continue;
  const sh=s.torns.find(x=>x.id===r.torn);if(!sh||r.torn==='festa')continue;
  let h=0;
  const night=['nit','cs_nit','fn'].includes(r.torn)||(sh.nom||'').toLowerCase().includes('nit');
  if(night)h=window.nightHoursForRecord(r,sh);
  else if(isWeekendDate(dateOf(k))||isHolidayDate(k))h=window.recordHours(r,sh);
  if(h>0){used+=h;items.push({date:k,hours:h,kind:'real',name:sh.nom})}
 }
 const from=new Date(Number(s.anyInici)||new Date().getFullYear(),1,1),to=new Date((Number(s.anyInici)||new Date().getFullYear())+1,0,31);
 for(let d=new Date(from);d<=to;d=addDays(d,1)){
  const k=key(d),existing=s.registres?.[k];if(existing?.tipus&&existing.tipus!=='planificat')continue;
  const ids=[...new Set([profileShiftForDate(k),...(s.planExtras?.[k]||[])].filter(Boolean))];
  for(const id of ids){const h=plannedGuardForShift(k,id);if(h<=0)continue;const sh=s.torns.find(x=>x.id===id);if(!sh)continue;const a=mins(sh.inici),b=mins(sh.fi);if(a===null||b===null)continue;const start=dateOf(k).getTime()+a*60000;let end=dateOf(k).getTime()+b*60000;if(end<=start)end+=86400000;const overlaps=plannedRanges.some(x=>start<x.end&&end>x.start);if(overlaps)continue;plannedRanges.push({start,end});planned+=h;items.push({date:k,hours:h,kind:'planned',name:sh.nom||id})}
 }
 return {used,planned,items};
}
function isNightMinute(d){const h=d.getHours();return h>=22||h<6}
function isDayHoliday(k){return isWeekendDate(dateOf(k))||isHolidayDate(k)}
// Classificació única de festius per als perfils i els càlculs.
window.isHolidayDate=isHolidayDate;
window.CodexPayrollTest={windowsForYear,specialPayForRecord,weightedOvertimeForRecord,guardAccounting,nightHoursInRange,isDayHoliday};
function weightedOvertimeForRecord(k,r,sh){
 const actual=window.recordHours(r,sh),base=window.shiftBase(sh),over=Math.max(0,actual-base);if(over<=0)return 0;
 const startMin=mins(r.entrada||sh.inici);if(startMin===null)return over;
 let t=dateOf(k).getTime()+startMin*60000+base*3600000,end=t+over*3600000,total=0;\n // Els perllongaments només generen hores ponderades a partir del 23/11/2026.\n const coefficientStart=dateOf('2026-11-23').getTime();\n if(end<=coefficientStart)return 0;\n t=Math.max(t,coefficientStart);
 while(t<end){const d=new Date(t),dk=key(d),coef=isNightMinute(d)?1.5:(isDayHoliday(dk)?1.75:1.25);total+=coef/60;t+=60000}
 return total;
}
function weightedAccumulated(){
 const s=st();let total=0;
 for(const [k,r] of Object.entries(s?.registres||{})){if(r?.tipus!=='treball'||r.torn==='festa')continue;const sh=s.torns.find(x=>x.id===r.torn);if(sh)total+=weightedOvertimeForRecord(k,r,sh)}
 return total;
}
function fmt(v){const n=Math.round(Math.abs(v)*60),h=Math.floor(n/60),m=n%60;return (v<0?'-':'')+h+':'+pad(m)}
const originalCalc=window.calc;
if(typeof originalCalc==='function'){
 window.calc=function(){
  const c=originalCalc(),s=st(),g=guardAccounting(),weighted=weightedAccumulated();
  c.accExtra=Number(weighted.toFixed(4));c.accum=Number(((Number(s?.acumTotals)||0)+weighted-(Number(c.accUsed)||0)).toFixed(4));
  c.gnitUsed=Number(g.used.toFixed(2));c.gnitPlanned=Number(g.planned.toFixed(2));c.gnitTarget=Number(s?.gnitTotals)||175.5;c.gnit=Number((c.gnitTarget-g.used-g.planned).toFixed(2));
  return c;
 };
}
function openGuardiaDetail(){
 const s=st(),c=window.calc(),g=guardAccounting(),title=document.getElementById('detailTitle'),summary=document.getElementById('detailSummary'),list=document.getElementById('detailList');
 if(!title||!summary||!list)return;
 title.textContent='Guàrdies nit/dia';
 summary.innerHTML='<strong>Saldo disponible: '+fmt(c.gnit)+' h</strong><small>Objectiu anual: '+fmt(c.gnitTarget)+' h · Realitzades: '+fmt(g.used)+' h · Planificades: '+fmt(g.planned)+' h</small>';
 const rows=g.items.sort((a,b)=>a.date.localeCompare(b.date)).map(x=>'<div class="detail-row"><div><strong>'+x.date+' · '+(x.kind==='planned'?'Planificada':'Realitzada')+'</strong><small>'+String(x.name).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</small></div><b>'+fmt(x.hours)+' h</b></div>');
 list.innerHTML=rows.join('')||'<div class="empty">Encara no hi ha guàrdies planificades ni realitzades.</div>';
 window.openModal('detailModal');
}
function fmtPrecise(h){const sec=Math.round(Math.abs(h)*3600),hh=Math.floor(sec/3600),mm=Math.floor(sec%3600/60),ss=sec%60;return (h<0?'-':'')+(hh?hh+' h ':'')+(mm?mm+' min ':'')+ss+' s'}
function openAccumDetail(){
 const s=st(),c=window.calc(),list=document.getElementById('detailList'),summary=document.getElementById('detailSummary'),title=document.getElementById('detailTitle');if(!s||!list||!summary||!title)return;
 title.textContent='Hores acumulades';
 summary.innerHTML='<strong>Saldo actual: '+fmt(c.accum)+' h</strong><small>Inicials: '+fmt(Number(s.acumTotals)||0)+' h · Generades amb coeficient · Utilitzades: '+fmt(Number(c.accUsed)||0)+' h</small>';
 const rows=[];
 for(const [k,r] of Object.entries(s.registres||{}).sort((a,b)=>a[0].localeCompare(b[0]))){
  if(r?.tipus==='hores_acum'){const h=Number(r.horesConcepte)||7.5;rows.push({date:k,html:'<div class="detail-row"><div><strong>'+k+' · Ús d’acumulades</strong></div><b>−'+fmt(h)+' h</b></div>'});continue}
  if(r?.tipus!=='treball'||r.torn==='festa')continue;
  const sh=s.torns.find(x=>x.id===r.torn);if(!sh)continue;
  const raw=Math.max(0,window.recordHours(r,sh)-window.shiftBase(sh));if(raw<=0)continue;
  const weighted=weightedOvertimeForRecord(k,r,sh),coef=weighted/raw;
  rows.push({date:k,html:'<div class="detail-row"><div><strong>'+k+' · '+String(sh.nom).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</strong><small>Perllongament real: '+fmtPrecise(raw)+' · Coeficient ×'+coef.toFixed(2).replace('.',',')+'</small></div><b>+'+fmtPrecise(weighted)+'</b></div>'});
 }
 list.innerHTML=rows.map(x=>x.html).join('')||'<div class="empty">Encara no hi ha moviments d’acumulades.</div>';
 window.openModal('detailModal');
}
const originalOpenDetail=window.openDetail;
if(typeof originalOpenDetail==='function')window.openDetail=function(kind){if(kind==='nits'||kind==='guardies')return openGuardiaDetail();if(kind==='accum')return openAccumDetail();return originalOpenDetail(kind)};
function addPayFields(){
 const work=document.getElementById('workFields');if(!work||document.getElementById('specialPayFields'))return;
 const wrap=document.createElement('div');wrap.id='specialPayFields';wrap.style.cssText='margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px';
 wrap.innerHTML='<div id="specialPaySummary" class="hint" style="margin:0 0 8px">El cobrament especial es calcularà automàticament segons la data i les hores treballades.</div><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="daySpecialPaid" style="width:auto;margin:0"> Cobrament especial ja cobrat</label><label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" id="dayExtraPaid" style="width:auto;margin:0"> Aquest servei s\'ha cobrat com a hores extraordinàries</label>';
 work.appendChild(wrap);
 ['dayStart','dayEnd','dayHours','dayType'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshPayPreview));
}
function currentPay(){
 const k=typeof editingDay!=='undefined'?editingDay:'',r={tipus:document.getElementById('dayType')?.value||'treball',entrada:document.getElementById('dayStart')?.value,sortida:document.getElementById('dayEnd')?.value,sortidaDiaSeguent:!!document.getElementById('dayEndNext')?.checked,horesExtresCobrades:!!document.getElementById('dayExtraPaid')?.checked};
 return specialPayForRecord(k,r);
}
function refreshPayPreview(){
 const box=document.getElementById('specialPaySummary');if(!box)return;
 const p=currentPay();
 if(p.incompatible)box.textContent='No es pot combinar: aquest servei consta com a hores extraordinàries.';
 else if(p.eligible)box.innerHTML='<strong>Pagament especial: '+p.hours.toFixed(2).replace('.',',')+' h · '+(p.windows.map(x=>x.rate+' €/h').filter((v,i,a)=>a.indexOf(v)===i).join(' / '))+' · '+p.amount.toFixed(2).replace('.',',')+' €</strong><small>Només hores efectivament treballades dins la franja. Mínim 3 hores assolit.</small>';
 else box.textContent=p.workedHours>0?'Franja especial detectada, però no s’arriba al mínim de 3 hores o s’ha marcat com a hores extraordinàries.':'Aquest torn no coincideix amb cap franja de pagament especial.';
}
function fillSpecial(k){
 const r=st()?.registres?.[k]||{};
 const paid=document.getElementById('daySpecialPaid'),extra=document.getElementById('dayExtraPaid');
 if(paid)paid.checked=!!r.pagamentEspecialCobrat;
 if(extra)extra.checked=!!r.horesExtresCobrades;
 refreshPayPreview();
}
function readSpecial(){
 const k=typeof editingDay!=='undefined'?editingDay:'',r={tipus:'treball',entrada:document.getElementById('dayStart')?.value,sortida:document.getElementById('dayEnd')?.value,sortidaDiaSeguent:!!document.getElementById('dayEndNext')?.checked,horesExtresCobrades:!!document.getElementById('dayExtraPaid')?.checked};
 const p=specialPayForRecord(k,r);
 return {pagamentEspecial:p.eligible,pagamentEspecialCobrat:p.eligible&&!!document.getElementById('daySpecialPaid')?.checked,pagamentEspecialHores:p.hours,pagamentEspecialImport:p.amount,horesExtresCobrades:!!r.horesExtresCobrades};
}
function initHomeActions(){
 addPayFields();
 if(window.HomeActions){window.HomeActions.fillSpecial=fillSpecial;window.HomeActions.readSpecial=readSpecial}
}
function decoratePlannedPayments(){
 const s=st();if(!s)return;
 const decorate=(el,k)=>{
  if(!k)return;
  el.querySelectorAll('.pay-plan-chip').forEach(n=>n.remove());
  if(s.registres?.[k]?.tipus==='treball')return;
  const ids=[profileShiftForDate(k),...(s.planExtras?.[k]||[])].filter(Boolean),parts=[];
  for(const id of ids){const sh=s.torns.find(x=>x.id===id);if(!sh)continue;const p=specialPayForRecord(k,{tipus:'treball',entrada:sh.inici,sortida:sh.fi});if(p.eligible)parts.push(p)}
  if(!parts.length)return;
  const amount=parts.reduce((n,p)=>n+p.amount,0),rates=[...new Set(parts.flatMap(p=>p.windows.map(w=>w.rate)))].sort((a,b)=>a-b);
  const tag=document.createElement('span');tag.className='pay-plan-chip';tag.textContent='💶 '+rates.join('/')+' €/h · '+amount.toFixed(2).replace('.',',')+' €';
  tag.title='Pagament especial estimat segons el torn planificat. Import definitiu segons les hores efectivament treballades.';
  tag.style.cssText='display:inline-block;margin:3px 0;padding:2px 6px;border-radius:7px;background:rgba(245,158,11,.14);color:var(--text);font-size:.72rem;font-weight:800';
  const host=el.querySelector('.kind')||el.querySelector('small')||el;
  host.appendChild(tag);
 };
 document.querySelectorAll('#calendar .day').forEach(el=>{const k=(el.getAttribute('onclick')||'').match(/clickDay\('([^']+)'\)/)?.[1];decorate(el,k)});
 document.querySelectorAll('#weekList .week-row').forEach(el=>{const k=(el.getAttribute('onclick')||'').match(/clickWeekDay\('([^']+)'\)/)?.[1];decorate(el,k)});
 document.querySelectorAll('#monthlyList .monthly-row').forEach(el=>{const k=(el.getAttribute('onclick')||'').match(/openDay\('([^']+)'\)/)?.[1];decorate(el,k)});
}
const oldRenderAll=window.renderAll;
if(typeof oldRenderAll==='function')window.renderAll=function(){oldRenderAll();const c=window.calc();const target=document.querySelector('#quickStats .stat.pink');if(target){const b=target.querySelector('b'),sp=target.querySelector('span');if(b)b.textContent=fmt(c.gnit)+' h';if(sp)sp.textContent='Guàrdies nit/dia'}decoratePlannedPayments()};
initHomeActions();
window.addEventListener('load',()=>{initHomeActions();window.renderAll?.()});
})();
