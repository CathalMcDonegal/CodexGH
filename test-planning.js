// node test-planning.js — regressió de solapaments en serveis planificats
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const state={
  torns:[
    {id:'cs_nit',nom:'Nit cap de setmana',inici:'19:00',fi:'07:00',hores:12},
    {id:'early',nom:'Servei matinal',inici:'06:00',fi:'14:00',hores:8},
    {id:'mati',nom:'Matí',inici:'07:00',fi:'15:00',hores:7.5}
  ],
  shiftProfiles:[],activeShiftProfileId:'',
  planOverrides:{'2026-03-02':'cs_nit'},
  planExtras:{}
};
const document={
  getElementById(){return null},
  querySelectorAll(){return []},
  createElement(){return {style:{},classList:{add(){},remove(){}},setAttribute(){}}},
  head:{appendChild(){}}
};
const ctx={state,document,console,Date,Math,Set,toast(){},save(){},renderAll(){},renderCalendar(){},renderWeek(){},renderMore(){},addEventListener(){}};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/shift-profiles.js','utf8'),ctx,{filename:'shift-profiles.js'});
const P=ctx.CodexShiftPlanTest;
assert.ok(P.hasPlanOverlap('2026-03-03','early','extra'),'el servei del dia següent se solapa amb el torn nocturn anterior');
assert.strictEqual(P.hasPlanOverlap('2026-03-02','early','extra'),false,'el servei matinal del mateix dia acaba abans que comenci el torn nocturn');
assert.strictEqual(P.hasPlanOverlap('2026-03-02','mati','override'),false,'un canvi de torn substitueix el torn base del mateix dia');
state.planExtras['2026-03-02']=['early'];
assert.ok(P.hasPlanOverlap('2026-03-02','early','extra'),'no es pot duplicar un servei addicional');
console.log('planning: tots els tests OK');
