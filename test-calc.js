// node tests/calc.test.js — prova les regles de còmput de js/app.js (només la part pura, sense DOM)
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/app.js','utf8');
const pure=src.slice(src.indexOf('const KEY='),src.indexOf('function renderAll'));
const store={};
const ctx={localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},key:i=>Object.keys(store)[i],get length(){return Object.keys(store).length}},
  window:{addEventListener(){},dispatchEvent(){}},document:{getElementById:()=>({addEventListener(){}}),addEventListener(){}},CustomEvent:function(){},console};
vm.createContext(ctx);
vm.runInContext(pure+`
this.api={migrate,calc,recordHours,defaultState,nightHoursForRecord,getShift,setState:s=>{state=s},getState:()=>state,FIXED_SHIFTS};`,ctx);
const A=ctx.api;
const run=(regs,extra)=>{const st=A.migrate(Object.assign(A.defaultState(),{registres:regs},extra||{}));A.setState(st);return A.calc()};
const eq=(a,b,m)=>assert.ok(Math.abs(a-b)<1e-9,`${m}: ${a} ≠ ${b}`);

let c=run({'2026-03-02':{tipus:'treball',torn:'mati',entrada:'07:00',sortida:'15:00',hores:8}});
eq(c.worked,8,'matí 07–15 → 8 h al general');eq(c.accExtra,0.5,'matí → 0,5 h a acumulades');eq(c.accum,0.5,'saldo acumulades');
c=run({'d':{tipus:'treball',torn:'mati',entrada:'07:00',sortida:'14:30',hores:7.5}});
eq(c.worked,8,'matí marc 07–14:30 també compta 8 h');eq(c.accExtra,0.5,'… i 0,5 h acumulades');
c=run({'d':{tipus:'treball',torn:'mati',hores:7.5}});eq(c.worked,8,'matí sense hores → 8');eq(c.accExtra,0.5,'… 0,5');
const reg=[1,2,3,4,5].reduce((o,i)=>(o['2026-03-0'+i]={tipus:'treball',torn:'mati',entrada:'07:00',sortida:'15:00',hores:8},o),{});
c=run(reg);eq(c.worked,40,'5 matins = 40 h');eq(c.accExtra,2.5,'5 matins = 2,5 h acumulades');
// migració: el registre antic 07:00–14:30 passa a 15:00 / 8 h i els torns fixos tornen a l'horari marc
let st=A.migrate(Object.assign(A.defaultState(),{registres:{d:{tipus:'treball',torn:'mati',entrada:'07:00',sortida:'14:30',hores:7.5}},torns:A.defaultState().torns.map(t=>t.id==='mati'?{...t,fi:'14:30'}:t)}));
assert.strictEqual(st.registres.d.sortida,'15:00');eq(st.registres.d.hores,8,'migració hores');assert.strictEqual(st.torns.find(t=>t.id==='mati').fi,'15:00');
// altres torns
c=run({'d':{tipus:'treball',torn:'tarda',entrada:'14:30',sortida:'22:00',hores:7.5}});eq(c.worked,7.5,'tarda');eq(c.accExtra,0,'tarda sense acumulades');
c=run({'d':{tipus:'treball',torn:'nit',entrada:'22:00',sortida:'07:00',hores:9}});eq(c.worked,9,'nit');eq(c.gnit,8,'nit: només 22–06');eq(c.accExtra,0,'nit base 9');
c=run({'d':{tipus:'treball',torn:'cs_dia',entrada:'07:00',sortida:'19:00',hores:12}});eq(c.worked,12,'cs dia');eq(c.accExtra,0,'cs dia base 12');
c=run({'d':{tipus:'treball',torn:'tarda',entrada:'14:30',sortida:'23:00',hores:8.5}});eq(c.accExtra,1,'tarda allargada → 1 h acumulada');
// festa, conceptes
c=run({'a':{tipus:'treball',torn:'festa',entrada:'07:00',sortida:'15:00',hores:8}});eq(c.worked,-8,'torn festa resta');
c=run({'a':{tipus:'vacances',horesConcepte:7.5},'b':{tipus:'assumptes',horesConcepte:7.5},'c':{tipus:'dies_blaus',horesConcepte:7.5},'d':{tipus:'guardia_np',horesConcepte:3},'e':{tipus:'hores_extres',horesConcepte:2},'f':{tipus:'baixa',horesConcepte:7.5}});
eq(c.vac,7.5,'vacances');eq(c.worked,22.5,'general = AP + blaus + baixa (sense vacances ni GNP ni extres)');eq(c.pers,7.5,'AP');eq(c.blue,7.5,'blaus');eq(c.gnp,3,'GNP');eq(c.extra,2,'extres');
c=run({'a':{tipus:'treball',torn:'mati',entrada:'07:00',sortida:'15:00',hores:8},'b':{tipus:'hores_acum',horesConcepte:0.5}});eq(c.accum,0,'ús d\'acumulades resta del saldo');eq(c.worked,8,'ús d\'acumulades no entra al general');
console.log('calc: tots els tests OK');
