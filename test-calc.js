// node tests/calc.test.js — prova les regles de còmput de js/app.js (només la part pura, sense DOM)
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/app.js','utf8');
const pure=src.slice(src.indexOf('const KEY='),src.indexOf('function expectedWeek'));
const store={};
const ctx={localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},key:i=>Object.keys(store)[i],get length(){return Object.keys(store).length}},
  document:{getElementById:()=>null,addEventListener(){},createElement:()=>({})},CustomEvent:function(){},console,Date,JSON,Math,Set};
ctx.window=ctx;ctx.location={hash:'#home'};ctx.history={replaceState(){}};ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};
vm.createContext(ctx);
vm.runInContext(pure+`
this.api={migrate,calc,recordHours,defaultState,nightHoursForRecord,getShift,setState:s=>{state=s},getState:()=>state,FIXED_SHIFTS,setActiveYear,weeklyCreditedHours};`,ctx);
vm.runInContext(fs.readFileSync(__dirname+'/payroll.js','utf8'),ctx,{filename:'payroll.js'});
ctx.renderAll=()=>{};ctx.toast=()=>{};
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

// Migració i canvi d'any: conserva el valor de guàrdies configurat, inclòs zero explícit.
let migrated=A.migrate({gnitTotals:0});
eq(migrated.gnitTotals,0,'zero explícit de guàrdies es conserva');
migrated=A.migrate({});
eq(migrated.gnitTotals,175.5,'valor inicial per defecte de guàrdies');
let yr=A.migrate(Object.assign(A.defaultState(),{gnitTotals:142.25}));A.setState(yr);
vm.runInContext('setActiveYear(2027)',ctx);
eq(A.getState().gnitTotals,142.25,'any nou hereta el valor preestablert configurat');

// Nou còmput ponderat de perllongaments: dia ×1,25, nit ×1,50, diumenge/festiu diürn ×1,75.
const payroll=ctx.CodexPayrollTest;
let custom=A.defaultState();custom.torns.push(
 {id:'nit_ext',nom:'Torn nit ampliat',hores:7,inici:'21:00',fi:'06:00',color:'#000000'},
 {id:'dia_ext',nom:'Torn dia ampliat',hores:12,inici:'07:00',fi:'20:00',color:'#000000'}
);
A.setState(A.migrate(custom));
let overtime=payroll.weightedOvertimeForRecord('2026-03-02',{tipus:'treball',torn:'mati',entrada:'07:00',sortida:'15:15'},A.getState().torns.find(x=>x.id==='mati'));
eq(overtime,0.9375,'45 min diürns ×1,25 = 56 min 15 s');
overtime=payroll.weightedOvertimeForRecord('2026-03-02',{tipus:'treball',torn:'nit_ext',entrada:'21:00',sortida:'06:00'},A.getState().torns.find(x=>x.id==='nit_ext'));
eq(overtime,3,'2 h nocturnes ×1,50 = 3 h');
const holidayState=A.getState();holidayState.festius['2026-03-03']='Festiu de prova';A.setState(holidayState);
overtime=payroll.weightedOvertimeForRecord('2026-03-03',{tipus:'treball',torn:'dia_ext',entrada:'07:00',sortida:'20:00'},A.getState().torns.find(x=>x.id==='dia_ext'));
eq(overtime,1.75,'1 h diürna festiva ×1,75 = 1 h 45 min');
overtime=payroll.weightedOvertimeForRecord('2026-03-02',{tipus:'treball',torn:'dia_ext',entrada:'07:00',sortida:'20:00'},A.getState().torns.find(x=>x.id==='dia_ext'));
eq(overtime,1.25,'1 h diürna feiner ×1,25');

// Les finestres especials 06:00–06:30 de l'endemà són 24,5 h, no 30 minuts.
const specialWindow=payroll.windowsForYear(2026).find(x=>x.label==='6 de desembre');
eq((specialWindow.b-specialWindow.a)/3600000,24.5,'finestra especial del 6 de desembre = 24,5 h');
const special=payroll.specialPayForRecord('2026-12-06',{tipus:'treball',entrada:'06:00',sortida:'06:30',sortidaDiaSeguent:true});
assert.ok(special.eligible,'finestra de 24,5 h compleix el mínim');
eq(special.hours,24.5,'hores de pagament especial 24,5');
eq(special.amount,343,'24,5 h × 14 € = 343 €');

// Les hores setmanals computables segueixen la mateixa regla que el còmput anual.
// Jornada de 24,5 h: es diferencia explícitament d'un tram de només 30 minuts.
const longShift={id:'long',nom:'Servei llarg',hores:24.5,inici:'06:00',fi:'06:30'};
eq(A.recordHours({torn:'long',entrada:'06:00',sortida:'06:30',sortidaDiaSeguent:true},longShift),24.5,'sortida l’endemà = 24,5 h');
eq(A.nightHoursForRecord({torn:'long',entrada:'06:00',sortida:'06:30',sortidaDiaSeguent:true},longShift),8,'una jornada de 24,5 h inclou 8 h nocturnes 22–06');

// Guàrdies planificades: nits entre setmana i serveis diürns en dissabte.
const guardState=A.getState();guardState.planOverrides={'2026-03-02':'cs_nit','2026-03-07':'mati'};guardState.planExtras={'2026-03-02':['cs_nit']};A.setState(guardState);
const guard=payroll.guardAccounting();
eq(guard.planned,16,'8 h de nit + 8 h de dia de cap de setmana; duplicat ignorat');

eq(A.weeklyCreditedHours({tipus:'assumptes',horesConcepte:7.5}),7.5,'AP computa a la setmana');
eq(A.weeklyCreditedHours({tipus:'dies_blaus',horesConcepte:7.5}),7.5,'Dies Blaus computen a la setmana');
eq(A.weeklyCreditedHours({tipus:'baixa',horesConcepte:7.5}),7.5,'Baixa computa a la setmana');
eq(A.weeklyCreditedHours({tipus:'vacances',horesConcepte:7.5}),0,'Vacances no entren al còmput general');
eq(A.weeklyCreditedHours({tipus:'guardia_np',horesConcepte:7.5}),0,'GNP no entra al còmput general');

console.log('calc + payroll: tots els tests OK');
