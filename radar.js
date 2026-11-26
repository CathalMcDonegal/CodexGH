/* Codex GH 3.0 · Radar personal */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fmt=k=>{const d=new Date(k+'T00:00:00');return d.toLocaleDateString('ca',{weekday:'short',day:'numeric',month:'short'})};
function renderRadar(){
 const host=document.getElementById('codexRadar');if(!host||typeof state==='undefined')return;
 const s=state,now=new Date(),today=dateKey(now),limit=new Date(now);limit.setDate(limit.getDate()+21);
 const items=[];
 (s.judicis||[]).forEach(j=>{
  const k=j.data||j.date||'';if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||k<today||k>dateKey(limit))return;
  items.push({date:k,kind:'judici',title:'Judici programat',detail:[j.hora,j.jutjat,j.sala].filter(Boolean).join(' · ')});
 });
 Object.entries(s.registres||{}).forEach(([k,r])=>{
  if(k<today||k>dateKey(limit)||!r)return;
  if(r.tipus==='planificat')items.push({date:k,kind:'plan',title:'Torn planificat',detail:r.torn||r.nom||'Revisa els detalls'});
  if(r.tipus==='baixa')items.push({date:k,kind:'baixa',title:'Baixa registrada',detail:'Entrada al calendari'});
 });
 items.sort((a,b)=>a.date.localeCompare(b.date));
 const count=items.length;
 host.innerHTML='<div class="radar-head"><div><div class="radar-kicker">PROPERES 3 SETMANES</div><h3>Radar</h3></div><span class="radar-count">'+count+'</span></div>'+
 (count?'<div class="radar-list">'+items.slice(0,6).map(x=>'<div class="radar-item"><span class="radar-dot '+esc(x.kind)+'"></span><div class="radar-copy"><strong>'+esc(x.title)+'</strong><small>'+esc(fmt(x.date))+(x.detail?' · '+esc(x.detail):'')+'</small></div></div>').join('')+'</div>':'<div class="radar-empty">Tot al dia. No hi ha judicis ni torns especials registrats per als pròxims 21 dies.</div>');
}
window.renderCodexRadar=renderRadar;
const old=window.renderAll;
if(typeof old==='function')window.renderAll=function(){old();renderRadar()};
document.addEventListener('DOMContentLoaded',renderRadar);
window.addEventListener('load',renderRadar);
})();