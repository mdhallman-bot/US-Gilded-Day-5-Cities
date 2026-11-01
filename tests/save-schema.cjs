// Regression checks for the expanded response schema and export guards.
const vm=require('vm'),fs=require('fs'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const ids=[...html.matchAll(/textarea id="([^"]+)"/g)].map(m=>m[1]);
const elements={};const el=()=>({textContent:'',hidden:false,value:'',showModal(){},close(){},addEventListener(){}});
const fields=ids.map(id=>({id,value:'',addEventListener(){}}));
const values={warmup:'Older response',arrival:'A hope'};fields.forEach(f=>f.value=values[f.id]||'');
const ctx={console,fields,crypto:require('crypto').webcrypto,Uint8Array,URL,Blob,location:{origin:'https://mdhallman-bot.github.io'},document:{getElementById:id=>elements[id]??=el()},window:{addEventListener(){}},localStorage:{setItem(){},getItem(){return null}},currentAlias:'audit-test',alias:el(),key:a=>a,progress(){},report(){},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,snapshot:()=>({page:0,answers:Object.fromEntries(fields.map(f=>[f.id,f.value]))}),apply:d=>fields.forEach(f=>f.value=d.answers[f.id]||'')};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../cloud.js','utf8'),ctx);
const run=js=>vm.runInContext(js,ctx);
assert.equal(ids.length,28);assert.equal(new Set(ids).size,28);
ctx.old={page:0,answers:values};ctx.expanded=ctx.snapshot();assert.equal(run('contentStamp(old)'),run('contentStamp(expanded)'));
(async()=>{
 run("cloud={alias:'audit-test',accessKey:'a'.repeat(64),revision:0,confirmedStamp:'',ready:true,blocked:false,pending:null}");
 ctx.sent=[];run('rpc=async p=>{sent.push(p);return {ok:true,revision:1}}');await run('flushCloud()');
 assert.equal(Object.keys(ctx.sent[0].snapshot.answers).length,28);assert.equal(run('cloud.revision'),1);
 fields[0].value='New response';run("rpc=async p=>{sent.push(p);throw Error('offline')}");await run('flushCloud()');const pending=run('cloud.pending.requestId');assert(pending);assert.equal(fields[0].value,'New response');
 run('rpc=async p=>{sent.push(p);return {ok:true,revision:2}}');await run('flushCloud()');assert.equal(ctx.sent.at(-1).requestId,pending);
 run("rpc=async p=>({ok:true,found:true,alias:'audit-test',revision:3,snapshot:{page:0,answers:{warmup:'Other device'}}})");await run('connectCloud(cloud)');assert.equal(run('cloud.blocked'),true);assert.equal(fields[0].value,'New response');
 assert(html.includes('cloud.js?v=20261101-independent2'));
 assert(!html.includes('Barge Office'));assert.equal((html.match(/Dear Diary,/g)||[]).length,6);
 assert.equal((html.match(/class="hotspot"/g)||[]).length,4);
 assert(!/Talk with a partner|Tell a partner|Switch roles/.test(html));
 console.log('Passed: 28 fields, old-save normalization, full-schema save, exact retry, conflict protection, six diary entries, four hotspots, independent directions.');
})().catch(e=>{console.error(e);process.exit(1)});
