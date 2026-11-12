/* Diàlegs propis (substitueixen prompt/confirm/alert del navegador). Reutilitzen les classes .modal-bg/.modal/.btn. */
(function(){
'use strict';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function open(html,onOpen){
  return new Promise(resolve=>{
    const bg=document.createElement('div');
    bg.className='modal-bg open';bg.style.zIndex='400';
    bg.innerHTML='<div class="modal" role="dialog" aria-modal="true">'+html+'</div>';
    const prevFocus=document.activeElement;
    const done=v=>{document.removeEventListener('keydown',onKey,true);bg.remove();try{prevFocus&&prevFocus.focus&&prevFocus.focus()}catch(e){}resolve(v)};
    const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();done(null)}};
    document.addEventListener('keydown',onKey,true);
    bg.addEventListener('mousedown',e=>{if(e.target===bg)done(null)});
    document.body.appendChild(bg);
    onOpen(bg,done);
  });
}
window.uiConfirm=function(msg,opt){
  opt=opt||{};
  return open('<div class="modal-head"><h2>'+esc(opt.title||'Confirmació')+'</h2></div><p style="margin:6px 0 16px;line-height:1.45">'+esc(msg)+'</p>'+
    '<div class="actions" style="justify-content:flex-end"><button type="button" class="btn secondary" data-a="no">'+esc(opt.cancel||'Cancel·lar')+'</button><button type="button" class="btn '+(opt.danger?'danger':'primary')+'" data-a="yes">'+esc(opt.ok||'Acceptar')+'</button></div>',
    (bg,done)=>{
      bg.querySelector('[data-a=no]').onclick=()=>done(false);
      const y=bg.querySelector('[data-a=yes]');y.onclick=()=>done(true);y.focus();
    }).then(v=>v===true);
};
window.uiAlert=function(msg,title){
  return open('<div class="modal-head"><h2>'+esc(title||'Avís')+'</h2></div><p style="margin:6px 0 16px;line-height:1.45">'+esc(msg)+'</p>'+
    '<div class="actions" style="justify-content:flex-end"><button type="button" class="btn primary" data-a="ok">D\'acord</button></div>',
    (bg,done)=>{const b=bg.querySelector('[data-a=ok]');b.onclick=()=>done(true);b.focus()}).then(()=>undefined);
};
/* fields: [{id,label,type,value,step,min,max,placeholder}] → promesa amb {id:valor} o null si es cancel·la */
window.uiForm=function(title,fields,opt){
  opt=opt||{};
  const inputs=fields.map(f=>'<label for="uf_'+esc(f.id)+'">'+esc(f.label)+'</label><input id="uf_'+esc(f.id)+'" type="'+esc(f.type||'text')+'" value="'+esc(f.value)+'"'+
    (f.step?' step="'+esc(f.step)+'"':'')+(f.min!=null?' min="'+esc(f.min)+'"':'')+(f.max!=null?' max="'+esc(f.max)+'"':'')+(f.placeholder?' placeholder="'+esc(f.placeholder)+'"':'')+(f.type==='color'?' style="height:44px;padding:4px"':'')+'>').join('');
  return open('<div class="modal-head"><h2>'+esc(title)+'</h2><button type="button" class="close" data-a="no" aria-label="Tancar">×</button></div><form novalidate>'+inputs+
    '<div class="actions" style="justify-content:flex-end;margin-top:14px"><button type="button" class="btn secondary" data-a="no">Cancel·lar</button><button type="submit" class="btn primary">'+esc(opt.ok||'Desar')+'</button></div></form>',
    (bg,done)=>{
      bg.querySelectorAll('[data-a=no]').forEach(b=>b.onclick=()=>done(null));
      bg.querySelector('form').onsubmit=e=>{e.preventDefault();const out={};fields.forEach(f=>{out[f.id]=bg.querySelector('#uf_'+f.id).value});done(out)};
      const first=bg.querySelector('input');first&&first.focus();
    });
};
})();
window.toggleStats=function(){const q=document.getElementById('quickStats'),b=document.getElementById('statsMore');if(!q)return;const c=q.classList.toggle('collapsed');if(b)b.textContent=c?"Mostra'n més":"Mostra'n menys"};
