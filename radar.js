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
 const dateValue=v=>{
  const raw=String(v||'').trim();
  let m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[1]+'-'+m[2]+'-'+m[3];
  m=raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):'';
 };
 const truth=(o,keys)=>keys.some(k=>[true,1,'true','1','yes','si','sí'].includes(o?.[k]));
 (s.judicis||[]).forEach(j=>{
  const k=dateValue(j.data||j.date||j.dataJudici);
  if(!k||k<today||k>dateKey(limit)||truth(j,['suspes','suspended'])||truth(j,['celebrat','held','celebratJudici','realitzat','fet','judiciCelebrat']))return;
  items.push({date:k,kind:'judici',title:'Judici programat',detail:[j.hora||j.time||j.horaJudici,j.jutjat||j.court||j.tribunal,j.sala||j.room].filter(Boolean).join(' · ')});
 });
 Object.entries(s.registres||{}).forEach(([k,r])=>{
  if(k<today||k>dateKey(limit)||!r)return;
  if(r.noteIcon)items.push({date:k,kind:'plan',title:'Dia amb avís',detail:[r.noteIcon==='red_plus'?'Plus vermell':r.noteIcon,r.observacions||r.observacio||r.notes||r.nota].filter(Boolean).join(' · ')});
  const special=truth(r,['pagamentEspecial','cobramentEspecial','cobroEspecial','specialPayment','paymentSpecial']);
  const paid=truth(r,['pagamentEspecialCobrat','cobramentEspecialCobrat','cobroEspecialCobrat','specialPaymentPaid','paymentSpecialPaid']);
  if(special&&!paid)items.push({date:k,kind:'baixa',title:'Cobrament especial pendent',detail:'Revisa l’import i les hores'});
 });
 items.sort((a,b)=>a.date.localeCompare(b.date));
 const count=items.length;
 host.innerHTML='<div class="radar-head"><div><div class="radar-kicker">PROPERES 3 SETMANES</div><h3>Radar</h3></div><span class="radar-count">'+count+'</span></div>'+
 (count?'<div class="radar-list">'+items.slice(0,6).map(x=>'<div class="radar-item"><span class="radar-dot '+esc(x.kind)+'"></span><div class="radar-copy"><strong>'+esc(x.title)+'</strong><small>'+esc(fmt(x.date))+(x.detail?' · '+esc(x.detail):'')+'</small></div></div>').join('')+'</div>':'<div class="radar-empty">Tot al dia. No hi ha judicis ni avisos registrats per als pròxims 21 dies.</div>');
}
window.renderCodexRadar=renderRadar;

window.restoreLatestLocalBackup=async function(){
 const keys=[];
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('codexGHDailyBackup-'))keys.push(k)}
 keys.sort().reverse();
 if(!keys.length){toast('No hi ha cap còpia local disponible');return}
 let key='',candidate=null;
 for(const k of keys){
  try{
   const parsed=JSON.parse(localStorage.getItem(k));
   if(parsed&&typeof parsed==='object'&&parsed.registres&&typeof parsed.registres==='object'){
    key=k;candidate=parsed;break;
   }
  }catch(e){}
 }
 if(!candidate){toast('No hi ha cap còpia local vàlida');return}
 const n=Object.keys(candidate.registres||{}).length;
 if(!await uiConfirm('Es restaurarà la còpia del '+key.replace('codexGHDailyBackup-','')+' amb '+n+' registres. Abans es guardarà l’estat actual com a còpia de seguretat. Vols continuar?',{title:'Restaurar còpia local',ok:'Restaurar'}))return;
 try{
  const current=localStorage.getItem('codexGH');
  if(current)localStorage.setItem('codexGHRestoreBefore-'+Date.now(),current);
  candidate._savedAt=Date.now();
  const payload=JSON.stringify(candidate);
  localStorage.setItem('codexGH',payload);localStorage.setItem('codexGH.latest',payload);
  toast('Còpia restaurada');setTimeout(()=>location.reload(),500);
 }catch(e){toast('No s’ha pogut restaurar la còpia')}
};

const old=window.renderAll;
if(typeof old==='function')window.renderAll=function(){old();renderRadar()};
document.addEventListener('DOMContentLoaded',renderRadar);
window.addEventListener('load',renderRadar);
})();