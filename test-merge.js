// node tests/merge.test.js — simula dos dispositius i un "Firestore" en memòria
const assert=require('assert');const M=require('./merge.js');
const mkState=(o)=>Object.assign({titol:'RH',anyInici:2026,horesAnuals:1580,registres:{},judicis:[],historic:{},torns:[]},o);
// "núvol"
const cloud={};
function device(name,st){return {name,st,meta:{}}}
function items(d){return M.flatten(d.st)}
function push(d,now){const it=items(d);M.detectLocal(it,d.meta,now);
  M.pending(d.meta).forEach(k=>{const p=M.payload(k,it,d.meta);const r=cloud[k];
    if(r&&p.m<r.m)return; /* regla Firestore: escriptura antiga rebutjada */ cloud[k]={m:p.m,del:!!p.d,json:p.j};d.meta[k].p=0})}
function pull(d,now,initial){const it=items(d);let res;
  if(initial)res=M.initialMerge(it,d.meta,cloud,now,d.st._savedAt||0);
  else{M.detectLocal(it,d.meta,now);res=M.applyRemote(it,d.meta,Object.keys(cloud).map(k=>({key:k,m:cloud[k].m,del:cloud[k].del,json:cloud[k].json})))}
  const st=M.inflate(it);if(st){d.st=st}return res}

// 1. A puja dades inicials, B es connecta en blanc i les rep
const A=device('A',mkState({registres:{'2026-03-01':{tipus:'treball',torn:'mati',hores:8},'2026-03-02':{tipus:'vacances',horesConcepte:7.5}},judicis:[{data:'2026-04-01',hora:'10:00'}]}));
pull(A,1000,true);push(A,1000);
const B=device('B',mkState({}));pull(B,1100,true);
assert.deepStrictEqual(Object.keys(B.st.registres).sort(),['2026-03-01','2026-03-02']);
assert.strictEqual(B.st.judicis.length,1);
// 2. Edicions en dies diferents sense connexió → es fusionen
A.st.registres['2026-03-03']={tipus:'treball',torn:'tarda',hores:7.5};
B.st.registres['2026-03-04']={tipus:'treball',torn:'nit',hores:9};
push(A,2000);push(B,2100);pull(A,2200);pull(B,2200);
for(const d of[A,B])assert.deepStrictEqual(Object.keys(d.st.registres).sort(),['2026-03-01','2026-03-02','2026-03-03','2026-03-04'],d.name);
// 3. Mateix dia editat als dos: guanya l'últim
A.st.registres['2026-03-01']={tipus:'treball',torn:'mati',hores:8,notes:'A'};
B.st.registres['2026-03-01']={tipus:'treball',torn:'mati',hores:8,notes:'B'};
push(A,3000);push(B,3100);pull(A,3200);pull(B,3200);
assert.strictEqual(A.st.registres['2026-03-01'].notes,'B');assert.strictEqual(B.st.registres['2026-03-01'].notes,'B');
// 4. Una escriptura antiga que arriba tard NO trepitja la nova (regla Firestore m>=m)
A.st.registres['2026-03-02']={tipus:'vacances',horesConcepte:5};
const itA=items(A);M.detectLocal(itA,A.meta,3500); // A edita a t=3500 però no puja encara
B.st.registres['2026-03-02']={tipus:'vacances',horesConcepte:6};
push(B,3600);push(A,3700); // A puja després però amb m=3500 < 3600 → rebutjat
pull(A,3800);assert.strictEqual(A.st.registres['2026-03-02'].horesConcepte,6);
// 5. Esborrat → tombstone arriba a l'altre dispositiu
delete A.st.registres['2026-03-04'];push(A,4000);pull(B,4100);
assert.ok(!B.st.registres['2026-03-04']);
// 6. Canvi d'any actiu: els dies de l'any antic es conserven com a històric
const snap={horesAnuals:1580,registres:A.st.registres,judicis:A.st.judicis};
A.st.historic['2026']=snap;A.st.anyInici=2027;A.st.registres={'2027-01-02':{tipus:'treball',torn:'mati',hores:8}};A.st.judicis=[];
push(A,5000);pull(B,5100);
assert.strictEqual(B.st.anyInici,2027);assert.ok(B.st.registres['2027-01-02']);
assert.ok(B.st.historic['2026'].registres['2026-03-01'],'any antic');assert.strictEqual(B.st.historic['2026'].judicis.length,1);
// 7. Dispositiu nou amb dades locals antigues (sense metadades) i núvol més nou: guanya el núvol
const C=device('C',mkState({_savedAt:10,registres:{'2026-03-01':{tipus:'treball',torn:'mati',hores:8,notes:'vell'}}}));
// (C és de l'any 2026 però el núvol ja té config amb any 2027; només comprovem el dia)
pull(C,6000,true);assert.strictEqual(C.st.anyInici,2027);
assert.strictEqual((C.st.historic['2026'].registres['2026-03-01']||{}).notes,'B');
// 8. Migració des del document únic de la 2.3
const legacy={json:JSON.stringify(mkState({registres:{'2026-05-05':{tipus:'treball',torn:'mati',hores:8}}})),savedAt:777};
const remote=M.legacyToRemote(legacy);assert.ok(remote['d|2026|2026-05-05']&&remote['c|main']);
const D=device('D',mkState({}));const itD=items(D);M.initialMerge(itD,D.meta,remote,9000,0);
assert.ok(M.inflate(itD).registres['2026-05-05']);
// 9. Claus ⇄ documents
for(const k of['c|main','a|2025','d|2026|2026-03-01','j|2026|abc-2']){const r=M.refFor(k);assert.strictEqual(M.keyFor(r.col,r.id),k)}
// 10. Judicis idèntics no es col·lapsen
const T=mkState({judicis:[{data:'x'},{data:'x'}]});assert.strictEqual(M.inflate(M.flatten(T)).judicis.length,2);
console.log('merge: tots els tests OK');
