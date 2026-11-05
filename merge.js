/* Codex GH — nucli de sincronització (funcions pures, sense DOM ni Firebase; es prova amb Node).
   L'estat de l'app es "aplana" en elements independents (config, un per dia, un per judici, un per any antic).
   Cada element té un segell de modificació (m). Entre dispositius es fusiona element a element: guanya el més recent.
   Claus:  c|main · a|<any> · d|<any>|<YYYY-MM-DD> · j|<any>|<hash>   */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.RHMerge=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';
const EXCLUDE=new Set(['registres','judicis','historic','_savedAt']);

/* Hash ràpid (cyrb53) → text base36 */
function hash(str){
  let h1=0xdeadbeef,h2=0x41c6ce57;
  for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}

/* Estat → {clau:{json}} */
function flatten(st){
  const items={},active=String(st.anyInici);
  const cfg={};Object.keys(st).forEach(k=>{if(!EXCLUDE.has(k))cfg[k]=st[k]});
  items['c|main']={json:JSON.stringify(cfg)};
  const addDays=(y,regs)=>Object.keys(regs||{}).forEach(d=>{items['d|'+y+'|'+d]={json:JSON.stringify(regs[d])}});
  const addTrials=(y,list)=>{
    const seen={};
    (list||[]).forEach(j=>{
      const json=JSON.stringify(j),h=hash(json);seen[h]=(seen[h]||0)+1;
      items['j|'+y+'|'+h+(seen[h]>1?'-'+seen[h]:'')]={json};
    });
  };
  addDays(active,st.registres);addTrials(active,st.judicis);
  Object.keys(st.historic||{}).forEach(y=>{
    if(y===active)return; // l'any actiu viu a l'estat principal
    const snap=st.historic[y]||{},rest={};
    Object.keys(snap).forEach(k=>{if(k!=='registres'&&k!=='judicis')rest[k]=snap[k]});
    items['a|'+y]={json:JSON.stringify(rest)};
    addDays(y,snap.registres);addTrials(y,snap.judicis);
  });
  return items;
}

/* {clau:{json}} → estat (null si no hi ha config) */
function inflate(items){
  const c=items['c|main'];if(!c)return null;
  const st=JSON.parse(c.json);st.registres={};st.judicis=[];st.historic={};
  const active=String(st.anyInici);
  const year=y=>y===active?st:(st.historic[y]=st.historic[y]||{registres:{},judicis:[]});
  const trials=[];
  Object.keys(items).sort().forEach(key=>{
    const p=key.split('|'),t=p[0];
    if(t==='a'){const snap=JSON.parse(items[key].json);const h=st.historic[p[1]]=st.historic[p[1]]||{registres:{},judicis:[]};Object.assign(h,snap)}
    else if(t==='d'){year(p[1]).registres[p.slice(2).join('|')]=JSON.parse(items[key].json)}
    else if(t==='j'){trials.push({y:p[1],j:JSON.parse(items[key].json)})}
  });
  trials.sort((a,b)=>((a.j.data||'')+(a.j.hora||'')).localeCompare((b.j.data||'')+(b.j.hora||'')));
  trials.forEach(t=>year(t.y).judicis.push(t.j));
  return st;
}

/* Clau ⇄ (col·lecció, id de document) a Firestore */
function refFor(key){
  const p=key.split('|');
  if(p[0]==='c')return {col:'dades',id:'config'};
  if(p[0]==='a')return {col:'anys',id:p[1]};
  if(p[0]==='d')return {col:'dies',id:p[1]+'_'+p.slice(2).join('|')};
  if(p[0]==='j')return {col:'judicis',id:p[1]+'_'+p.slice(2).join('|')};
  return null;
}
function keyFor(col,id){
  if(col==='dades')return id==='config'?'c|main':null;
  if(col==='anys')return 'a|'+id;
  const i=id.indexOf('_');if(i<1)return null;
  if(col==='dies')return 'd|'+id.slice(0,i)+'|'+id.slice(i+1);
  if(col==='judicis')return 'j|'+id.slice(0,i)+'|'+id.slice(i+1);
  return null;
}

/* Detecta canvis locals respecte a les metadades: edició/alta → m=now,p=1; element desaparegut → tombstone */
function detectLocal(items,meta,now){
  Object.keys(items).forEach(key=>{
    const h=hash(items[key].json),M=meta[key];
    if(!M||M.del)meta[key]={h,m:now,p:1};
    else if(M.h!==h){M.h=h;M.m=now;M.p=1}
  });
  Object.keys(meta).forEach(key=>{if(!items[key]&&!meta[key].del)meta[key]={h:'',m:now,p:1,del:1}});
}

/* Aplica documents remots {key,m,del,json}. Retorna {changed:[claus], overwrotePending:bool} */
function applyRemote(items,meta,docs){
  const changed=[];let overwrotePending=false;
  docs.forEach(d=>{
    if(!d||!d.key||typeof d.m!=='number')return;
    const M=meta[d.key],lm=M?M.m:-1;
    if(d.m>lm){
      if(M&&M.p)overwrotePending=true;
      if(d.del){delete items[d.key];meta[d.key]={h:'',m:d.m,del:1}}
      else{items[d.key]={json:d.json};meta[d.key]={h:hash(d.json),m:d.m}}
      changed.push(d.key);
    }else if(d.m<lm&&M){M.p=1} // el local és més nou: cal pujar-lo
  });
  return {changed,overwrotePending};
}

/* Primera fusió d'una sessió: remote={clau:{m,del,json}}; localSaved=segell de l'últim desat local */
function initialMerge(items,meta,remote,now,localSaved){
  // Elements locals sense metadades però que ja existeixen al núvol: porten el segell de l'últim desat local
  Object.keys(items).forEach(key=>{if(!meta[key]&&remote[key])meta[key]={h:hash(items[key].json),m:localSaved||0}});
  detectLocal(items,meta,now);
  const docs=Object.keys(remote).map(key=>({key,m:remote[key].m,del:!!remote[key].del,json:remote[key].json}));
  const res=applyRemote(items,meta,docs);
  // Tot el que el núvol no té s'ha de pujar
  Object.keys(meta).forEach(key=>{if(!remote[key])meta[key].p=1});
  return res;
}

/* Contingut a escriure a Firestore per a una clau */
function payload(key,items,meta){
  const M=meta[key];
  return M.del?{j:'',m:M.m,d:1}:{j:items[key].json,m:M.m,d:0};
}
function pending(meta){return Object.keys(meta).filter(k=>meta[k].p)}

/* Estat antic (versió 2.3: un sol document {json,savedAt}) → elements remots */
function legacyToRemote(doc,migrate){
  let raw;try{raw=JSON.parse(doc.json)}catch(e){return {}}
  const st=migrate?migrate(raw):raw,items=flatten(st),out={},m=Number(doc.savedAt)||1;
  Object.keys(items).forEach(k=>{out[k]={m,del:false,json:items[k].json}});
  return out;
}

return {hash,flatten,inflate,refFor,keyFor,detectLocal,applyRemote,initialMerge,payload,pending,legacyToRemote};
});
