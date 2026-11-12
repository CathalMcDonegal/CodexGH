/* Pantalla d'inici: resum de judicis, Accions pendents i cobrament especial. Sense polling ni wrappers: app.js crida HomeActions directament. */
(function(){
'use strict';
function S(){return (typeof state!=='undefined'&&state)?state:null}
function esc(v){try{return escapeHtml(v==null?'':String(v))}catch(e){return String(v==null?'':v).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]))}}
function txt(v){return String(v==null?'':v).trim()}
function truth(o,keys){return keys.some(k=>{const v=o?.[k];return v===true||v===1||v==='true'||v==='1'||v==='yes'||v==='si'||v==='sí'})}
function paid(j){return truth(j,['cobrament','cobrat','paid','pagat','cobramentCobrat','cobratJudici','pagamentCobrat'])}
function held(j){return truth(j,['celebrat','held','celebratJudici','realitzat','fet','judiciCelebrat'])}
function dateRaw(j){return j?.data||j?.date||j?.dataJudici||''}
function dateOrder(v){const s=txt(v);let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[1]+m[2]+m[3];m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m)return m[3]+m[2].padStart(2,'0')+m[1].padStart(2,'0');return '99999999'}
function timeOrder(v){const m=txt(v).match(/^(\d{1,2}):([0-5]\d)/);return m?m[1].padStart(2,'0')+m[2]:'0000'}
function dateLabel(v){const s=txt(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return s;const d=new Date(+m[1],+m[2]-1,+m[3]);return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`}
function timeLabel(v){const s=txt(v);const m=s.match(/^([0-2]\d):([0-5]\d)$/);return m?`${m[1]}.${m[2]}h`:s}
function detail(j){const a=[];const court=txt(j?.jutjat||j?.court||j?.tribunal);const room=txt(j?.sala||j?.room);const proc=txt(j?.procediment||j?.proc||j?.procedimentJudicial);const agents=txt(j?.agents||j?.agentsCitatsa||j?.agent);if(court)a.push(court);if(room)a.push('sala '+room);if(proc)a.push('dil. '+proc);if(agents)a.push(agents);return a.join(', ')}
function trialRow(j,i,showChip){const top=['⚖️',dateLabel(dateRaw(j)),timeLabel(j?.hora||j?.time||j?.horaJudici)].filter(Boolean).join(' ');const sub=detail(j);const hasObs=!!txt(j?.observacions??j?.observacio??j?.observación??j?.observacion);const mark=hasObs?'<span title="Aquest judici té observacions" aria-label="Té observacions" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ef4444;vertical-align:middle;margin-left:7px"></span>':'';return `<div class="row" onclick="openTrial(${i})" style="cursor:pointer"><div class="grow"><strong>${esc(top)}${mark}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>${showChip?'<span class="chip warn">Per cobrar</span>':''}</div>`}
function special(r){return truth(r,['pagamentEspecial','cobramentEspecial','cobroEspecial','specialPayment','paymentSpecial'])}
function specialPaid(r){return truth(r,['pagamentEspecialCobrat','cobramentEspecialCobrat','cobroEspecialCobrat','specialPaymentPaid','paymentSpecialPaid'])}
function observation(r){return txt(r?.observacions??r?.observacio??r?.observación??r?.observacion??r?.notes??r?.nota)}
function dayLabel(k){try{const d=parseKey(k);return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`}catch(e){return k}}
function renderUpcoming(){const st=S(),box=document.getElementById('upcoming');if(!st||!box)return;const today=typeof todayKey==='function'?todayKey():'';const trials=(Array.isArray(st.judicis)?st.judicis:[]).map((j,i)=>({...j,i})).filter(j=>{const d=dateOrder(dateRaw(j));return d!=='99999999'&&(!today||d>dateOrder(today))&&!held(j)&&!j.suspes}).sort((a,b)=>(dateOrder(dateRaw(a))+timeOrder(a.hora||a.time||a.horaJudici)).localeCompare(dateOrder(dateRaw(b))+timeOrder(b.hora||b.time||b.horaJudici))).slice(0,5);const planned=Object.entries(st.registres||{}).filter(([k,r])=>dateOrder(k)>dateOrder(today)&&r?.noteIcon).sort((a,b)=>dateOrder(a[0]).localeCompare(dateOrder(b[0]))).slice(0,5);const items=[...trials.map(j=>({date:dateOrder(dateRaw(j)),time:timeOrder(j.hora||j.time||j.horaJudici),html:trialRow(j,j.i,false)})),...planned.map(([k,r])=>{const icon=r.noteIcon==='red_plus'?'➕':txt(r.noteIcon);const obs=observation(r);return {date:dateOrder(k),time:'0000',html:`<div class="row" onclick="openDay('${k}')" style="cursor:pointer"><div class="grow"><strong>🔔 ${esc(dayLabel(k))}</strong>${obs?`<small>${esc(obs)}</small>`:''}</div>${icon?`<span class="chip info">${esc(icon)}</span>`:''}</div>`}})];items.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));box.innerHTML=items.map(x=>x.html).join('')||'<div class="empty">No hi ha judicis ni dies programats.</div>'}
function renderPending(){const st=S(),box=document.getElementById('alerts');if(!st||!box)return;const out=[];(Array.isArray(st.judicis)?st.judicis:[]).forEach((j,i)=>{if(j?.suspes){const top=['⚖️',dateLabel(dateRaw(j)),timeLabel(j?.hora||j?.time||j?.horaJudici)].filter(Boolean).join(' ');const sub=detail(j);out.push('<div class="row" onclick="openTrial('+i+')" style="cursor:pointer"><div class="grow"><strong>'+esc(top)+'</strong>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div><span class="chip warn">Reprogramar</span></div>')}else if(held(j)&&!paid(j))out.push(trialRow(j,i,true))});Object.entries(st.registres||{}).forEach(([k,r])=>{if(special(r)&&!specialPaid(r)){const o=observation(r);out.push(`<div class="row" onclick="openDay('${k}')" style="cursor:pointer"><div class="grow"><strong>💶 ${esc(dayLabel(k))}</strong>${o?`<small>${esc(o)}</small>`:''}</div><span class="chip warn">Per cobrar</span></div>`)}});box.innerHTML=out.length?out.join(''):'<div class="empty">Tot al dia.</div>'}

function addSpecialFields(){
  if(document.getElementById('specialPayFields'))return;
  const work=document.getElementById('workFields');if(!work)return;
  const wrap=document.createElement('div');wrap.id='specialPayFields';
  wrap.innerHTML='<div class="check"><input type="checkbox" id="daySpecialPay"><label for="daySpecialPay">Aquest dia té cobrament especial</label></div><div class="check" id="daySpecialPaidWrap" style="display:none"><input type="checkbox" id="daySpecialPaid"><label for="daySpecialPaid">Cobrament especial cobrat</label></div>';
  work.appendChild(wrap);
  document.getElementById('daySpecialPay').addEventListener('change',function(){
    const w=document.getElementById('daySpecialPaidWrap');if(w)w.style.display=this.checked?'block':'none';
    if(!this.checked){const p=document.getElementById('daySpecialPaid');if(p)p.checked=false}
  });
}
function fillSpecial(k){
  const r=S()?.registres?.[k]||{};
  const a=document.getElementById('daySpecialPay'),b=document.getElementById('daySpecialPaid'),w=document.getElementById('daySpecialPaidWrap');
  if(a){a.checked=special(r);if(w)w.style.display=a.checked?'block':'none'}
  if(b)b.checked=specialPaid(r);
}
function readSpecial(){
  const a=document.getElementById('daySpecialPay'),b=document.getElementById('daySpecialPaid');
  const sp=!!a?.checked;return {pagamentEspecial:sp,pagamentEspecialCobrat:sp&&!!b?.checked};
}

/* Avui: tot el que hi ha planificat per al dia (icona + observacions, judicis del dia, cobrament especial), amb el mateix format que «Pròxim». */
function todayExtras(k){
  const st=S();if(!st)return '';
  const r=st.registres?.[k]||{},out=[];
  const icon=r.noteIcon==='red_plus'?'➕':txt(r.noteIcon),obs=observation(r);
  if(icon||obs)out.push(`<div class="row" onclick="openDay('${k}')" style="cursor:pointer"><div class="grow"><strong>🔔 ${esc(dayLabel(k))}</strong>${obs?`<small>${esc(obs)}</small>`:''}</div>${icon?`<span class="chip info">${esc(icon)}</span>`:''}</div>`);
  (Array.isArray(st.judicis)?st.judicis:[]).forEach((j,i)=>{if(txt(dateRaw(j))===k)out.push(trialRow(j,i,held(j)&&!paid(j)))});
  if(special(r))out.push(`<div class="row" onclick="openDay('${k}')" style="cursor:pointer"><div class="grow"><strong>💶 Cobrament especial</strong></div><span class="chip ${specialPaid(r)?'ok':'warn'}">${specialPaid(r)?'Cobrat':'Per cobrar'}</span></div>`);
  return out.length?`<div class="today-extra" style="display:flex;flex-direction:column;gap:8px;margin-top:12px">${out.join('')}</div>`:'';
}
function render(){try{renderUpcoming();renderPending()}catch(e){}}
window.HomeActions={todayExtras,init:addSpecialFields,fillSpecial,readSpecial,render};
})();
