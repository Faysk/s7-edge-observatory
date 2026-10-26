'use strict';
// Runs against synthetic, local HTTP fixtures only — never the Galaxy S7 or live APIs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),os=require('node:os');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
if(!chrome)throw Error('Chromium/Chrome not available for browser regression');
const data=fs.readFileSync(path.join(root,'js/data.js'),'utf8');
const ctx={window:{},Date,Math,JSON};vm.createContext(ctx);vm.runInContext(data,ctx);
const fixture=ctx.window.S7DemoData.demoSnapshot(0);fixture.quality='ok';
fixture.cpu.usagePercent=23;
fixture.timestamp=new Date().toISOString();
fixture.details={metrics:{}};
for(let i=0;i<127;i++)fixture.details.metrics['synthetic.sensor'+i]={value:i%3===0?0:i,status:'ok',unit:'count',source:'fixture'};
let advance=false,sevenDayCpuCalls=0;
const requests={snapshot:0,history:0};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const json=(data,status=200)=>{const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});res.end(req.method==='HEAD'?undefined:body);};
  if(url.pathname==='/tests/advance-fixture'){advance=true;json({ok:true});return;}
  if(url.pathname==='/api/host/snapshot'){
    requests.snapshot++;
    const snap=JSON.parse(JSON.stringify(fixture));if(advance)snap.cpu.usagePercent=81;
    json(snap);return;
  }
  if(url.pathname==='/api/host/history'){
    requests.history++;
    const metric=url.searchParams.get('metric'),range=url.searchParams.get('range');
    if(metric==='cpu'&&range==='7d'&&++sevenDayCpuCalls===1){json({error:'Synthetic 500'},500);return;}
    const now=Date.now(),rows=Array.from({length:90},(_,i)=>({time:new Date(now-(90-i)*60000).toISOString(),value:i%17===0?null:metric==='cpu'?0:metric==='memory'?55:2.5}));
    json(rows);return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end('Not found');return;
  }
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
});
server.listen(0,'127.0.0.1',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'s7-observatory-smoke-'));
 const target='http://127.0.0.1:'+server.address().port+'/tests/browser_fixture.html';
 const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run',
   '--user-data-dir='+dir,'--virtual-time-budget=18000','--dump-dom',target];
 const child=spawn(chrome,args);let stdout='',stderr='';
 child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
 const timeout=setTimeout(()=>child.kill('SIGKILL'),42000);
 try{
   const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
   const result=stdout.match(/<div id="smoke" data-status="([^"]+)">([^<]*)<\/div>/);
   console.log('Browser smoke',result?.[1],result?.[2],'requests',requests);
   assert.equal(code,0,'Chromium exit code: '+stderr.slice(-1200));
   assert.equal(result?.[1],'pass','Browser scenario did not pass. '+stderr.slice(-1200));
 }catch(err){console.error(err);process.exitCode=1;}
 finally{clearTimeout(timeout);server.close();fs.rmSync(dir,{recursive:true,force:true});}
});