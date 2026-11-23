/* Codex GH · Guàrdies nit/dia, perllongaments ponderats i pagaments especials */
(function(){
'use strict';
const st=()=>window.state||null;
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
 const span=(mmdd,from,emmd,to,rate,label)=>add(y+'-'+mmdd,from,y+'-'+emmd,to,rate,label);
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
 const start=dateOf(dateKey).getTime()+aMin*60000;let end=dateOf(dateKey).getTime()+bMin*60000;if(end<=start)end+=86400000;
 let windows=[];const y=dateOf(dateKey).getFullYear();
 for(let yy=y-1;yy<=y+1;yy++)windows.push(...windowsForYear(yy));
 let total=0,amount=0,parts=[];
 for(const w of windows){const overlap=Math.max(0,Math.min(end,w.b)-Math.max(start,w.a));if(overlap>0){const h=overlap/3600000;total+=h;amount+=h*w.rate;parts.push({hours:h,rate:w.rate,label:w.label})}}
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
 const d=dateOf(k);if(isWeekendDate(d)||isHolidayDate(k))return 12;
 return 0;
}
function guardAccounting(){
 const s=st();if(!s)return {used:0,planned:0,items:[]};
 let used=0,planned=0,items=[];
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
  const k=key(d);if(s.registres?.[k]?.tipus==='treball')continue;
  const ids=[profileShiftForDate(k),...(s.planExtras?.[k]||[])].filter(Boolean);
  for(const id of ids){const h=plannedGuardForShift(k,id);if(h>0){planned+=h;items.push({date:k,hours:h,kind:'planned',name:s.torns.find(x=>x.id===id)?.nom||id})}}
 }
 return {used,planned,items};
}
function isNightMinute(d){const h=d.getHours();return h>=22||h<6}
function isDayHoliday(k){return isWeekendDate(dateOf(k))||isHolidayDate(k)}
function weightedOvertimeForRecord(k,r,sh){
 const actual=window.recordHours(r,sh),base=window.shiftBase(sh),over=Math.max(0,actual-base);if(over<=0)return 0;
 const startMin=mins(r.entrada||sh.inici);if(startMin===null)return over;
 let t=dateOf(k).getTime()+startMin*60000+base*60000,end=t+over*60000,total=0;
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
const originalOpenDetail=window.openDetail;
if(typeof originalOpenDetail==='function')window.openDetail=function(kind){if(kind==='nits'||kind==='guardies')return openGuardiaDetail();return originalOpenDetail(kind)};
function addPayFields(){
 const work=document.getElementById('workFields');if(!work||document.getElementById('specialPayFields'))return;
 const wrap=document.createElement('div');wrap.id='specialPayFields';wrap.style.cssText='margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px';
 wrap.innerHTML='<div id="specialPaySummary" class="hint" style="margin:0 0 8px">El cobrament especial es calcularà automàticament segons la data i les hores treballades.</div><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="daySpecialPaid" style="width:auto;margin:0"> Cobrament especial ja cobrat</label><label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" id="dayExtraPaid" style="width:auto;margin:0"> Aquest servei s'ha cobrat com a hores extraordinàries</label>';
 work.appendChild(wrap);
 ['dayStart','dayEnd','dayHours'].forEach(id=>document.getElementById(id)?.addEventListener('input',refreshPayPreview));
}
function currentPay(){
 const k=window.editingDay||'',r={tipus:document.getElementById('dayType')?.value||'treball',entrada:document.getElementById('dayStart')?.value,sortida:document.getElementById('dayEnd')?.value,horesExtresCobrades:!!document.getElementById('dayExtraPaid')?.checked};
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
 const k=window.editingDay||'',r={tipus:'treball',entrada:document.getElementById('dayStart')?.value,sortida:document.getElementById('dayEnd')?.value,horesExtresCobrades:!!document.getElementById('dayExtraPaid')?.checked};
 const p=specialPayForRecord(k,r);
 return {pagamentEspecial:p.eligible,pagamentEspecialCobrat:p.eligible&&!!document.getElementById('daySpecialPaid')?.checked,pagamentEspecialHores:p.hours,pagamentEspecialImport:p.amount,horesExtresCobrades:!!r.horesExtresCobrades};
}
function initHomeActions(){
 addPayFields();
 if(window.HomeActions){window.HomeActions.fillSpecial=fillSpecial;window.HomeActions.readSpecial=readSpecial}
}
const oldRenderAll=window.renderAll;
if(typeof oldRenderAll==='function')window.renderAll=function(){oldRenderAll();const c=window.calc();const target=document.querySelector('#quickStats .stat.pink');if(target){const b=target.querySelector('b'),sp=target.querySelector('span');if(b)b.textContent=fmt(c.gnit)+' h';if(sp)sp.textContent='Guàrdies nit/dia'}};
initHomeActions();
window.addEventListener('load',()=>{initHomeActions();window.renderAll?.()});
})();
