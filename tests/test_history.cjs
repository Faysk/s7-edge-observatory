'use strict';
// Every fixture here is artificial. The real S7, database and LAN endpoints are never accessed.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const mockElement=()=>({
  _writes:0,_html:'',
  get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this._writes++;},
  textContent:'',dataset:{},className:'',
  classList:{add(){},remove(){},toggle(){}},
  querySelector(){return null},querySelectorAll(){return []},
  setAttribute(){},addEventListener(){},focus(){},appendChild(){},
});
const nodes=new Map();
const doc={
  hidden:false,body:{dataset:{}},
  querySelector(selector){if(!nodes.has(selector))nodes.set(selector,mockElement());return nodes.get(selector)},
  addEventListener(){},
};
const context={window:{},document:doc,
  localStorage:{getItem(){return null},setItem(){}},
  location:{protocol:'http:',host:'127.0.0.1:8767'},
  navigator:{},console,Date,Map,Set,Math,Number,String,JSON,Object,Array,Promise,
  AbortController,AbortSignal,DOMException,setTimeout,clearTimeout,setInterval(){},URL,Blob};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('js/data.js','utf8'),context);
let source=fs.readFileSync('js/app.js','utf8').replace(/\r\n/g,'\n');
source=source.replace('setTheme(state.theme);render();updateClock();',
  'window.testS7={state,render,historyFlights,requestHistory,loadHistory,cancelUnusedHistory,cancelAllHistory,historyState,checkAPI,chart,explorerResults,emptySnapshot,route,updateMain};setTheme(state.theme);render();updateClock();');
source=source.replace('checkAPI(false);\n})();','})();');
vm.runInContext(source,context);
const t=context.testS7;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fakeSnapshot=()=>{
  const s=context.S7DemoData.demoSnapshot(0);
  s.quality='ok';s.timestamp=new Date().toISOString();
  return JSON.parse(JSON.stringify(s));
};
let calls=[],failure=new Set(),empty=new Set(),delays={};
let snapshot=fakeSnapshot();
const series=(metric,range)=>Array.from({length:60},(_,i)=>({
  time:new Date(Date.now()-60000*(60-i)).toISOString(),value:i%11===0?null:metric==='cpu'?0:42
}));
function installFetch(){
  context.fetch=(url,options={})=>{
    const addr=String(url),query=new URL(addr,'http://localhost'),metric=query.searchParams.get('metric'),range=query.searchParams.get('range');
    const key=metric+':'+range;
    calls.push({url:addr,key,bytes:0,started:performance.now()});
    const delay=metric?(delays[key]??8):1;
    return new Promise((resolve,reject)=>{
      const signal=options.signal;
      if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
      let timer;
      const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>{
        signal?.removeEventListener('abort',abort);
        if(failure.has(key)){resolve({ok:false,status:500,json:async()=>({})});return;}
        const data=metric?(empty.has(key)?[]:series(metric,range)):snapshot;
        calls.at(-1).bytes+=Buffer.byteLength(JSON.stringify(data));
        resolve({ok:true,status:200,json:async()=>data});
      },delay);
    });
  };
}
installFetch();
const onlyHistory=()=>calls.filter(x=>x.url.includes('/history?'));
(async()=>{
  t.state.mode='real';t.state.page='overview';t.state.range='6h';
  const started=performance.now();
  const a=t.loadHistory(),b=t.loadHistory(),c=t.loadHistory(),d=t.loadHistory();
  for(const name of ['cpu','memory','rx','tx'])assert.equal(t.historyState(name),'loading');
  await Promise.all([a,b,c,d]);
  assert.equal(onlyHistory().length,4,'Four simultaneous consumers must share only four metric requests');
  assert.equal(t.historyFlights.size,0,'Every flight must clear after settling');
  assert.equal(t.historyState('cpu'),'success');
  assert.equal(t.state.history['cpu:6h'][0].value,null,'Null gap must stay null');
  assert.equal(t.state.history['cpu:6h'][1].value,0,'Zero must not disappear');
  await t.loadHistory();
  assert.equal(onlyHistory().length,4,'Unexpired history should hit the TTL cache');
  console.log('Shared flights: 4 requests (instead of 16); elapsed '+(performance.now()-started).toFixed(1)+'ms; bytes '+onlyHistory().reduce((s,x)=>s+x.bytes,0));

  // Errors with a previous series are stale and never replace that period's known samples.
  failure.add('cpu:6h');await t.requestHistory('cpu','6h',{force:true});
  assert.equal(t.historyState('cpu'),'stale');
  assert.equal(t.state.history['cpu:6h'][1].value,0);
  failure.delete('cpu:6h');
  await t.requestHistory('cpu','6h',{force:true});
  assert.equal(t.historyState('cpu'),'success','Retry must perform another fetch, not use a poisoned promise');

  t.state.page='battery';t.state.range='7d';
  failure.add('battery:7d');
  const attempts=onlyHistory().length;
  await t.loadHistory();
  assert.equal(t.historyState('battery'),'error','Without any previous data HTTP 500 means error');
  assert(onlyHistory().length>attempts);
  failure.delete('battery:7d');
  empty.add('battery:7d');await t.requestHistory('battery','7d',{force:true});
  assert.equal(t.historyState('battery'),'empty','Valid [] is not a network error');
  assert.deepEqual(Array.from(t.state.history['battery:7d']),[]);
  empty.delete('battery:7d');
  await t.requestHistory('battery','7d',{force:true});
  assert.equal(t.historyState('battery'),'success');

  // Rapid period changes cancel now-unneeded requests, never display the old period.
  t.state.page='overview';t.state.range='12h';delays['cpu:12h']=300;
  const old=t.loadHistory();
  await sleep(3);
  t.state.range='24h';t.cancelUnusedHistory();
  await t.loadHistory();
  await old;
  assert(!t.state.history['cpu:12h'],'Aborted old period must not populate state');
  assert(t.state.history['cpu:24h']);
  assert.equal(t.historyState('cpu'),'success');
  assert.equal(t.historyFlights.size,0);
  const saved=t.state.history['cpu:24h'];
  assert(saved.length===60);
  console.log('Range cancellation, stale/empty/error/retry and valid null/zero passed');

  t.state.paused=true;const before=onlyHistory().length;await t.loadHistory();
  assert.equal(onlyHistory().length,before,'Paused dashboard must not start history requests');
  t.state.paused=false;doc.hidden=true;await t.loadHistory();
  assert.equal(onlyHistory().length,before,'Hidden tab must not start history requests');
  doc.hidden=false;

  // An identical snapshot must not rewrite main HTML in the Node compatibility renderer.
  t.state.page='overview';t.state.range='24h';
  snapshot=fakeSnapshot();
  await t.checkAPI();
  const main=nodes.get('#main-content'),baseline=main._writes;
  await t.checkAPI();
  assert.equal(main._writes,baseline,'Identical snapshot should not repaint main');
  snapshot={...snapshot,cpu:{...snapshot.cpu,usagePercent:51}};
  await t.checkAPI();
  assert(main._writes>baseline,'Changed snapshot should be rendered');
  console.log('Identical snapshot avoids DOM refresh; changed snapshot still updates');

  t.state.page='activity';t.state.mode='real';t.state.snapshot=fakeSnapshot();
  t.state.snapshot.details={metrics:{}};
  for(let i=0;i<127;i++)t.state.snapshot.details.metrics['sensor.synthetic'+i]={status:'ok',value:i,source:'synthetic',unit:'count'};
  t.state.explorerLimit=48;
  const first=t.explorerResults();
  assert.equal((first.match(/class="source-card"/g)||[]).length,48);
  assert(first.includes('data-explorer-more'));
  t.state.explorerLimit=96;
  assert.equal((t.explorerResults().match(/class="source-card"/g)||[]).length,96);
  console.log('127-item explorer paginates 48 cards at a time');

  // Larger fixture, no private sensor identifiers or production topology.
  t.state.snapshot.details.metrics={};
  for(let i=0;i<1000;i++)t.state.snapshot.details.metrics['synthetic.key'+i]={status:'ok',value:i%5===0?0:i,source:'fixture'};
  t.state.explorerLimit=48;
  const t0=performance.now(),html=t.explorerResults();
  assert.equal((html.match(/class="source-card"/g)||[]).length,48);
  console.log('1000 synthetic readings: JS '+(performance.now()-t0).toFixed(1)+'ms, first page 48 cards');
  // Real negative battery temperature is not zero, missing, or clipped to 0°C.
  t.state.mode='real';t.state.range='24h';
  const now=Date.now();
  t.state.history['temp:24h']=[{time:now-60000,value:-7},
                                {time:now,value:-1}];
  const temperatureSvg=t.chart('temp');
  const ticks=[...temperatureSvg.matchAll(/text-anchor="end"[^>]*>([^<]+)<\/text>/g)]
    .map(hit=>Number.parseFloat(hit[1].replace(',','.')));
  assert(ticks.some(tick=>tick<0),'Negative battery Celsius must appear on chart axis');
  console.log('Negative battery temperatures remain within visible chart domain');

  console.log('S7 history/polling synthetic regressions passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
