/* Local-first autosave. The exact alias is the only student retrieval credential. */
const BACKEND_URL='https://script.google.com/macros/s/AKfycbwgJhqVyonFcNRqvbgSeg6l_nuffgviq2B58w0HWcLVXtLvq-sDOA4RBKKTxgPA9-MEdQ/exec';
let cloud=null,cloudTimer=null,activeRequest=null,openingAlias=false;
const cloudLabel=document.getElementById('cloudState');
function cloudReport(text,state='pending') {cloudLabel.textContent=text;cloudLabel.dataset.state=state;}
function randomCode(bytes=16){return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
async function aliasAccessKey(a){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('lucia-day5-v1:alias-retrieval-v2:'+a));
  return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
function contentStamp(s){return JSON.stringify({page:Number.isInteger(s.page)?s.page:0,answers:Object.fromEntries(fields.map(f=>[f.id,typeof s.answers?.[f.id]==='string'?s.answers[f.id]:'']))});}
function hasWork(s){return Object.values(s.answers||{}).some(v=>String(v).trim());}
function cloudData(){return cloud?{aliasLookupVersion:2,accessKey:cloud.accessKey,legacyAccessKey:cloud.legacyAccessKey||null,revision:cloud.revision,confirmedStamp:cloud.confirmedStamp}:{};}
function persistLocal(){
  progress();
  if(!currentAlias){statusEl.textContent='Local: choose an alias';statusEl.dataset.state='waiting';return false;}
  try{localStorage.setItem(key(currentAlias),JSON.stringify({...snapshot(),cloud:cloudData()}));statusEl.textContent='Saved locally';statusEl.dataset.state='saved';statusEl.title='Saved in this browser at '+new Date().toLocaleTimeString();return true;}
  catch(e){statusEl.textContent='Local save unavailable';statusEl.dataset.state='error';report('Browser saving is unavailable. Keep this page open; use Emergency PDF if online saving or HTML export also fails.');return false;}
}
function queueCloud(delay=2000){clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>flushCloud(),delay);}
function save(){
  persistLocal();
  if(cloud&&!cloud.blocked){cloudReport('Online save pending…');queueCloud();}
}
function requestBase(c,action){return {action,lesson:'lucia-day5-v1',alias:c.alias,accessKey:c.accessKey,requestId:randomCode(),clientOrigin:location.origin};}
function retryLater(c,error){
  if(cloud!==c)return;
  cloudReport('Online unavailable · retrying','error');
  report((error?.message||'Online saving is unavailable.')+' Your local copy is retained. Automatic retries will continue. Use Emergency PDF only if you need a fallback.');
  queueCloud(15000);
}
function displayConflict(c,response){
  c.blocked=true;c.remote=response;clearTimeout(cloudTimer);
  cloudReport('Online: choose saved copy','error');
  document.getElementById('resolveCloud').hidden=false;
  report('This browser and the online copy differ. Choose which to keep; neither will be silently replaced.');
}
async function connectCloud(c){
  cloudReport('Checking online copy…');
  try{
    let response=await rpc(requestBase(c,'load'));
    if(cloud!==c)return;
    if(!response.ok)throw Error(response.message||'Online load failed.');
    // Carry older random-code records forward using the key already stored in this browser.
    // Never erase old records or silently choose between different versions.
    if(!response.found&&c.legacyAccessKey){
      const legacy=await rpc({...requestBase(c,'load'),accessKey:c.legacyAccessKey});
      if(cloud!==c)return;
      if(!legacy.ok)throw Error(legacy.message||'Earlier online work could not be checked.');
      if(legacy.found){response={...legacy,revision:0,migrate:true};}
    }
    c.ready=true;c.revision=response.revision;
    if(response.found&&response.alias!==c.alias){c.ready=false;throw Error('Use the exact same alias, including capitals, to retrieve your work.');}
    const local=snapshot();
    if(response.found){
      const online={...response.snapshot,alias:c.alias};
      if(contentStamp(local)===contentStamp(online)){
        c.confirmedStamp=response.migrate?'':contentStamp(local);persistLocal();
        if(response.migrate)await flushCloud();else cloudReport('Saved online','saved');
      }else if(!hasWork(local)&&!c.edited){
        apply(online);c.confirmedStamp=response.migrate?'':contentStamp(snapshot());persistLocal();
        if(response.migrate)await flushCloud();else {cloudReport('Saved online','saved');report('Your online responses were restored.');}
      }else if(c.confirmedStamp&&contentStamp(online)===c.confirmedStamp){
        c.blocked=false;if(response.migrate)c.confirmedStamp='';persistLocal();await flushCloud();
      }else {displayConflict(c,response);persistLocal();}
    }else{
      c.confirmedStamp='';persistLocal();await flushCloud();
    }
  }catch(err){if(cloud===c){c.ready=false;retryLater(c,err);}}
}
async function changeAlias(){
  const a=alias.value.trim();
  if(!/^[A-Za-z0-9-]{3,24}$/.test(a)){report('Use a unique 3–24 character alias with letters, numbers, or hyphens. Do not use a real name or school ID.');return;}
  if(openingAlias||activeRequest){report('An online check is finishing. Please try Open / resume again in a moment.');return;}
  openingAlias=true;clearTimeout(cloudTimer);
  if(currentAlias)persistLocal();
  let stored=null;
  try{stored=JSON.parse(localStorage.getItem(key(a))||'null');localStorage.setItem('lucia-last-alias',a);}catch(e){}
  const previousWork=!currentAlias&&fields.some(f=>f.value.trim())?snapshot():null;
  try{
    const derived=await aliasAccessKey(a);
    const old=stored?.cloud;
    const legacy=old?.aliasLookupVersion===2?old.legacyAccessKey:(old?.accessKey&&old.accessKey!==derived?old.accessKey:null);
    currentAlias=a;alias.value=a;
    cloud={alias:a,accessKey:derived,legacyAccessKey:legacy||null,revision:0,confirmedStamp:old?.confirmedStamp||'',ready:false,blocked:false,edited:false,pending:null};
    document.getElementById('resolveCloud').hidden=true;report('');
    if(stored)apply(stored);else if(!previousWork){fields.forEach(f=>f.value='');show(0);}
    persistLocal();openingAlias=false;await connectCloud(cloud);
  }catch(err){openingAlias=false;report('Could not open online saving: '+err.message+'. Use Emergency PDF if needed.');}
}
async function flushCloud(){
  clearTimeout(cloudTimer);const c=cloud;if(!c||c.blocked)return;
  if(activeRequest){queueCloud();return;}
  if(!c.ready)return connectCloud(c);
  const s=snapshot();
  if(!c.pending&&contentStamp(s)===c.confirmedStamp){cloudReport('Saved online','saved');return;}
  if(!c.pending)c.pending={...requestBase(c,'save'),baseRevision:c.revision,snapshot:{page:s.page,answers:s.answers}};
  const payload=c.pending;cloudReport('Saving online…');
  try{
    const response=await rpc(payload);if(cloud!==c)return;
    if(!response.ok){
      if(response.code==='conflict'){c.pending=null;c.ready=false;await connectCloud(c);return;}
      c.pending=null;throw Error(response.message||'Online save failed.');
    }
    c.revision=response.revision;c.confirmedStamp=contentStamp(payload.snapshot);c.pending=null;c.legacyAccessKey=null;
    persistLocal();cloudReport('Saved online','saved');cloudLabel.title='Confirmed at '+new Date().toLocaleTimeString();
    if(contentStamp(snapshot())!==c.confirmedStamp){cloudReport('Online save pending…');queueCloud();}
  }catch(err){retryLater(c,err);}
}
function openConflict(){if(cloud?.remote)document.getElementById('conflictDialog').showModal();}
function chooseCopy(which){
  if(!cloud?.remote)return;const c=cloud,r=c.remote;
  if(which==='online'){
    if(!confirm('Replace the responses shown here with the online copy? Save an Emergency PDF first if you need this copy.'))return;
    apply({...r.snapshot,alias:c.alias});c.confirmedStamp=r.migrate?'':contentStamp(snapshot());
  }else{
    if(!confirm('Use this browser’s responses to replace the online copy?'))return;
    c.confirmedStamp=r.migrate?'':contentStamp(r.snapshot);
  }
  c.revision=r.revision;c.blocked=false;c.ready=true;c.pending=null;c.remote=null;
  document.getElementById('resolveCloud').hidden=true;document.getElementById('conflictDialog').close();report('');persistLocal();
  if(which==='local'||r.migrate)flushCloud();else cloudReport('Saved online','saved');
}
fields.forEach(f=>f.addEventListener('input',()=>{if(cloud)cloud.edited=true;}));
alias.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();changeAlias();}});
window.addEventListener('online',()=>{if(cloud&&!cloud.blocked)queueCloud(100);});
window.addEventListener('pagehide',()=>persistLocal());
window.addEventListener('storage',e=>{
  if(currentAlias&&e.key===key(currentAlias)){
    if(cloud)cloud.blocked=true;clearTimeout(cloudTimer);cloudReport('Online: another tab changed','error');
    report('Another tab changed this alias. Keep one lesson tab open. Reopen the alias to check the saved copies; use Emergency PDF first if needed.');
  }
});
function rpc(payload) {
  if (activeRequest) return Promise.reject(Error('A request is already running. Try again shortly.'));
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    frame.name='day5-'+payload.requestId;frame.hidden=true;frame.title='Save lesson responses';
    const form=document.createElement('form');form.method='POST';form.action=BACKEND_URL;
    form.target=frame.name;form.hidden=true;
    const input=document.createElement('input');input.type='hidden';input.name='payload';
    input.value=JSON.stringify(payload);form.append(input);
    document.body.append(frame,form);
    let timer;
    function finish(err,data) {
      clearTimeout(timer);window.removeEventListener('message',receive);
      frame.remove();form.remove();activeRequest=null;
      if(err)reject(err);else resolve(data);
    }
    function receive(event) {
      const validOrigin=event.origin==='https://script.google.com' ||
        /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin);
      const data=event.data;
      // HtmlService runs in a nested frame, so its source differs from frame.contentWindow.
      // Both the trusted origin and this cryptographically random request ID must match.
      if(!validOrigin || !data || data.type!=='lucia-day5-response' || data.requestId!==payload.requestId)return;
      finish(null,data);
    }
    activeRequest={payload};window.addEventListener('message',receive);
    timer=setTimeout(()=>finish(Error('No confirmation received. Work is still saved in this browser.')),25000);
    form.submit();
  });
}
async function exportHTML() {
  progress();persistLocal();
  report('Preparing answered HTML…');
  try {
    const copy=document.documentElement.cloneNode(true);
    copy.querySelectorAll('script,dialog,nav,footer,.printanswer,#saveBanner').forEach(n=>n.remove());
    const head=copy.querySelector('head');
    const style=document.createElement('style');
    style.textContent='section{display:block!important;margin-bottom:24px}header{position:static!important;display:block!important}section{break-before:page}.saved-response{white-space:pre-wrap;border:1px solid #a0aaa1;padding:14px;background:white;overflow-wrap:anywhere}summary{cursor:default}';
    head.append(style);
    const title=copy.querySelector('title');if(title)title.textContent='Day 5 — Completed responses — '+(currentAlias||'unsaved');
    const summary=document.createElement('header');
    const name=document.createElement('h2');name.textContent='Day 5 — Lucia’s Diary · Student responses';
    const meta=document.createElement('p');
    meta.textContent='Alias: '+(currentAlias||'not set')+' · Completion: '+document.getElementById('completion').textContent+' · Exported: '+new Date().toLocaleString();
    const note=document.createElement('p');note.textContent='Completion counts response boxes containing text; it does not measure correctness. The ungraded opening response is included. This file is a read-only copy for review.';
    summary.append(name,meta,note);copy.querySelector('header').replaceWith(summary);
    copy.querySelector('#printmeta')?.remove();
    copy.querySelectorAll('textarea[data-answer]').forEach(t=>{
      const response=document.createElement('div');response.className='saved-response';
      response.textContent=document.getElementById(t.id).value||'[No response]';t.replaceWith(response);
    });
    copy.querySelectorAll('details').forEach(d=>d.setAttribute('open',''));
    for(const button of copy.querySelectorAll('button.imagebutton'))button.replaceWith(button.querySelector('img'));
    copy.querySelectorAll('button.hotspot').forEach(button=>{const number=document.createElement('span');number.className='hotspot static-hotspot';number.setAttribute('style',button.getAttribute('style')||'');number.textContent=button.querySelector('span').textContent;button.replaceWith(number)});
    copy.querySelectorAll('button,input,select,#ellisWhole,.image-instructions').forEach(n=>n.remove());
    copy.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes])if(/^on/i.test(a.name))n.removeAttribute(a.name);});
    // Embed image bytes so the downloaded file remains complete without an assets folder.
    for(const img of copy.querySelectorAll('img')) {
      const response=await fetch(new URL(img.getAttribute('src'),location.href));
      if(!response.ok)throw Error('An image could not be included. Try again or use Emergency PDF.');
      const blob=await response.blob();
      img.src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    }
    const blob=new Blob(['<!doctype html>\n'+copy.outerHTML],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
    a.download='Day5-'+(currentAlias||'responses')+'-answered.html';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);report('Answered HTML downloaded with responses, images, and completion percentage.');
  }catch(err){report('HTML export failed: '+(err.message||'Please retry or use Emergency PDF.'));}
}
