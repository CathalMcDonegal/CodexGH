/* Codex GH 3.0 · Radar personal */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fmt=k=>{const d=new Date(k+'T00:00:00');return d.toLocaleDateString('ca',{weekday:'short',day:'numeric',month:'short'})};
function renderRadar(){
 const host=document.getElementById('codexRadar');if(!host||typeof state==='undefined')return;
 const s=state,now=new Date(),today=dateKey(now),limit=new Date(now);limit.setDate(limit.getDate()+21);
 const limitKey=dateKey(limit),trials=[],notes=[],specials=[],suspended=[],trialPayments=[];
 const dateValue=v=>{
  const raw=String(v||'').trim();
  let m=raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);if(m)return m[1]+'-'+m[2]+'-'+m[3];
  m=raw.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})$/);
  return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):'';
 };
 const truth=(o,keys)=>keys.some(k=>[true,1,'true','1','yes','si','sí'].includes(o?.[k]));
 const held=j=>truth(j,['celebrat','held','celebratJudici','realitzat','fet','judiciCelebrat']);
 const paid=j=>truth(j,['cobrament','cobrat','paid','pagat','cobramentCobrat','cobratJudici','pagamentCobrat']);
 const special=r=>truth(r,['pagamentEspecial','cobramentEspecial','cobroEspecial','specialPayment','paymentSpecial']);
 const specialPaid=r=>truth(r,['pagamentEspecialCobrat','cobramentEspecialCobrat','cobroEspecialCobrat','specialPaymentPaid','paymentSpecialPaid']);
 (s.judicis||[]).forEach(j=>{
  const k=dateValue(j.data||j.date||j.dataJudici);
  if(truth(j,['suspes','suspended'])){suspended.push(j);return}
  if(held(j)&&!paid(j))trialPayments.push(j);
  if(!k||k<today||k>limitKey||held(j))return;
  trials.push({date:k,title:'Judici programat',detail:[j.hora||j.time||j.horaJudici,j.jutjat||j.court||j.tribunal,j.sala||j.room].filter(Boolean).join(' · ')});
 });
 Object.entries(s.registres||{}).forEach(([k,r])=>{
  if(!r)return;
  if(k>=today&&k<=limitKey&&r.noteIcon)notes.push({date:k,title:'Dia amb avís',detail:[r.noteIcon==='red_plus'?'Plus vermell':r.noteIcon,r.observacions||r.observacio||r.observación||r.observacion||r.notes||r.nota].filter(Boolean).join(' · ')});
  if(special(r)&&!specialPaid(r))specials.push({date:k});
 });
 trials.sort((a,b)=>(a.date+a.detail).localeCompare(b.date+b.detail));
 const count=trials.length+notes.length+specials.length+suspended.length+trialPayments.length;
 const metric=(n,label,kind)=>'<div class="radar-metric '+kind+'"><strong>'+n+'</strong><span>'+label+'</span></div>';
 const highlights=[];
 if(trials[0])highlights.push('<div class="radar-item"><span class="radar-dot judici"></span><div class="radar-copy"><strong>Proper judici</strong><small>'+esc(fmt(trials[0].date))+(trials[0].detail?' · '+esc(trials[0].detail):'')+'</small></div></div>');
 if(suspended.length)highlights.push('<div class="radar-item"><span class="radar-dot plan"></span><div class="radar-copy"><strong>'+suspended.length+' judicis suspesos</strong><small>Revisa si cal reprogramar-los</small></div></div>');
 if(trialPayments.length)highlights.push('<div class="radar-item"><span class="radar-dot baixa"></span><div class="radar-copy"><strong>'+trialPayments.length+' judicis per cobrar</strong><small>Celebrats i pendents de cobrament</small></div></div>');
 if(specials.length)highlights.push('<div class="radar-item"><span class="radar-dot baixa"></span><div class="radar-copy"><strong>'+specials.length+' cobraments especials pendents</strong><small>Revisa imports i hores</small></div></div>');
 if(notes.length)highlights.push('<div class="radar-item"><span class="radar-dot plan"></span><div class="radar-copy"><strong>'+notes.length+' dies amb avisos</strong><small>Consulta el detall a Pròxim</small></div></div>');
 host.innerHTML='<div class="radar-head"><div><div class="radar-kicker">VISIÓ GENERAL · 21 DIES</div><h3>Radar</h3></div><span class="radar-count">'+count+'</span></div>'+
 '<div class="radar-metrics">'+metric(trials.length,'judicis pròxims','blue')+metric(notes.length,'avisos','purple')+metric(suspended.length+trialPayments.length+specials.length,'accions pendents','orange')+'</div>'+
 (highlights.length?'<div class="radar-list">'+highlights.join('')+'</div>':'<div class="radar-empty">Tot al dia. No hi ha judicis, avisos ni cobraments pendents per als pròxims 21 dies.</div>');
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