/* Day 5 cloud save/resume. Local work remains available during network failures. */
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbwgJhqVyonFcNRqvbgSeg6l_nuffgviq2B58w0HWcLVXtLvq-sDOA4RBKKTxgPA9-MEdQ/exec';
let cloud = null, cloudTimer = null, activeRequest = null;
const cloudLabel = document.getElementById('cloudState');
const cloudReport = text => cloudLabel.textContent = text;
function randomCode(bytes=32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), n=>n.toString(16).padStart(2,'0')).join('');
}
function contentStamp(s) { return JSON.stringify({page:s.page,answers:s.answers}); }
function hasWork(s) { return Object.values(s.answers||{}).some(v=>String(v).trim()); }
function cloudData() {
  if (!cloud) return {};
  return {accessKey:cloud.accessKey,revision:cloud.revision,confirmedStamp:cloud.confirmedStamp};
}
function persistLocal() {
  progress();
  if (!currentAlias) {report('Choose an alias to save your work');return false;}
  try {
    localStorage.setItem(key(currentAlias),JSON.stringify({...snapshot(),cloud:cloudData()}));
    report('Saved in this browser · '+new Date().toLocaleTimeString());return true;
  } catch(e) {report('Browser save unavailable — download a recovery file now');return false;}
}
function save() {
  persistLocal();
  clearTimeout(cloudTimer);
  if (cloud?.ready && !cloud.blocked) {cloudReport('Changes saved in this browser; online save pending…');cloudTimer=setTimeout(()=>flushCloud(),2200);}
}
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
function requestBase(c,action) {
  return {action,lesson:'lucia-day5-v1',alias:c.alias,accessKey:c.accessKey,
    requestId:randomCode(16),clientOrigin:location.origin};
}
function displayConflict(c,remote) {
  c.blocked=true;c.remote=remote;
  cloudReport('Online and browser copies differ — choose a copy before syncing.');
  document.getElementById('resolveCloud').hidden=false;
}
async function connectCloud(c) {
  cloudReport('Checking online copy…');
  try {
    const response=await rpc(requestBase(c,'load'));
    if(cloud!==c)return;
    if(!response.ok)throw Error(response.message||'Online load failed.');
    c.ready=true;c.revision=response.revision;
    if(response.found && response.alias!==c.alias) {
      c.blocked=true;cloudReport('This resume code belongs to alias '+response.alias+'. Open that alias to continue.');return;
    }
    if(response.found) {
      const online={...response.snapshot,alias:c.alias};
      const local=snapshot();
      if(contentStamp(local)===contentStamp(online)) {
        c.confirmedStamp=contentStamp(local);persistLocal();cloudReport('Online copy confirmed.');
      } else if(!hasWork(local) && !c.edited) {
        apply(online);c.confirmedStamp=contentStamp(snapshot());persistLocal();cloudReport('Online responses restored.');
      } else if(c.confirmedStamp && contentStamp(online)===c.confirmedStamp) {
        c.blocked=false;persistLocal();await flushCloud();
      } else { displayConflict(c,response);persistLocal(); }
    } else {
      c.confirmedStamp='';persistLocal();cloudReport('Ready for online saving.');
      if(hasWork(snapshot()))await flushCloud();
    }
  } catch(err) {if(cloud===c){cloudReport(err.message+' Use Save online to retry.');c.ready=false;}}
}
async function changeAlias() {
  const a=alias.value.trim();
  if(!/^[A-Za-z0-9-]{3,24}$/.test(a)){report('Use a 3–24 character alias; no real name or school ID');return;}
  if(activeRequest){report('Please wait for the current online request before switching aliases.');return;}
  clearTimeout(cloudTimer);
  if(currentAlias)persistLocal();
  let stored=null;
  try {stored=JSON.parse(localStorage.getItem(key(a))||'null');localStorage.setItem('lucia-last-alias',a);}catch(e){}
  // Never erase unsaved work if an alias is being opened for the first time.
  const previousWork=!currentAlias && fields.some(f=>f.value.trim()) ? snapshot() : null;
  currentAlias=a;
  cloud={alias:a,accessKey:stored?.cloud?.accessKey||randomCode(),revision:stored?.cloud?.revision||0,
    confirmedStamp:stored?.cloud?.confirmedStamp||'',ready:false,blocked:false,edited:false,pending:null};
  document.getElementById('resolveCloud').hidden=true;
  if(stored)apply(stored);else if(!previousWork){fields.forEach(f=>f.value='');show(0);}
  persistLocal();await connectCloud(cloud);
}
async function flushCloud() {
  clearTimeout(cloudTimer);
  const c=cloud;if(!c)return report('Choose an alias first.');
  if(activeRequest){cloudReport('Online request in progress…');return;}
  if(c.blocked)return document.getElementById('resolveCloud').hidden ? cloudReport('Check your alias and resume code.') : openConflict();
  if(!c.ready)return connectCloud(c);
  const s=snapshot(),stamp=contentStamp(s);
  if(!c.pending && stamp===c.confirmedStamp){cloudReport('Online copy is up to date.');return;}
  // Retrying a timed-out request keeps the exact requestId, data and base revision.
  if(!c.pending)c.pending={...requestBase(c,'save'),baseRevision:c.revision,snapshot:{page:s.page,answers:s.answers}};
  const payload=c.pending;
  cloudReport('Saving online…');
  try {
    const response=await rpc(payload);
    if(cloud!==c)return;
    if(!response.ok) {
      if(response.code==='conflict') {
        c.pending=null;c.ready=false;
        await connectCloud(c);return;
      }
      c.pending=null;throw Error(response.message||'Online save failed.');
    }
    c.revision=response.revision;c.confirmedStamp=contentStamp(payload.snapshot);c.pending=null;
    persistLocal();cloudReport('Saved online · '+new Date().toLocaleTimeString());
    if(contentStamp(snapshot())!==c.confirmedStamp)cloudTimer=setTimeout(()=>flushCloud(),2200);
  } catch(err) {if(cloud===c)cloudReport(err.message+' Click Save online to retry.');}
}
function openResumeCode() {
  if(!cloud)return report('Choose an alias first.');
  document.getElementById('resumeCodeValue').value=cloud.accessKey;
  document.getElementById('codeDialog').showModal();
}
async function resumeElsewhere() {
  if(activeRequest)return report('Wait for the online request to finish.');
  const a=alias.value.trim(),code=document.getElementById('resumeCodeInput').value.trim();
  if(!/^[A-Za-z0-9-]{3,24}$/.test(a)||!/^[a-f0-9]{32,128}$/i.test(code)) {
    document.getElementById('resumeError').textContent='Enter your alias above and paste the full private resume code.';return;
  }
  if(currentAlias)persistLocal();
  if(fields.some(f=>f.value.trim())&&!confirm('Download a recovery file first if you need this browser’s current work. Continue to check the other online copy?'))return;
  clearTimeout(cloudTimer);currentAlias=a;
  cloud={alias:a,accessKey:code,revision:0,confirmedStamp:'',ready:false,blocked:false,edited:false,pending:null};
  document.getElementById('resumeDialog').close();
  document.getElementById('resolveCloud').hidden=true;
  // Keep existing answers until a successful load and explicit conflict choice.
  try{localStorage.setItem('lucia-last-alias',a);}catch(e){}
  persistLocal();await connectCloud(cloud);
}
function openConflict() {
  if(!cloud?.remote)return;
  document.getElementById('conflictDialog').showModal();
}
function chooseCopy(which) {
  if(!cloud?.remote)return;
  const c=cloud,r=c.remote;
  if(which==='online') {
    if(!confirm('Replace the responses shown here with the online copy? Download recovery first if needed.'))return;
    apply({...r.snapshot,alias:c.alias});c.confirmedStamp=contentStamp(snapshot());
  } else {
    if(!confirm('Use this browser’s responses to replace the online copy?'))return;
    c.confirmedStamp=contentStamp(r.snapshot);
  }
  c.revision=r.revision;c.blocked=false;c.ready=true;c.pending=null;c.remote=null;
  document.getElementById('resolveCloud').hidden=true;
  document.getElementById('conflictDialog').close();persistLocal();
  if(which==='local')flushCloud();else cloudReport('Online responses restored.');
}
function download() {
  const data={...snapshot(),cloud:cloudData()},blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;
  a.download='Day5-'+(currentAlias||'unsaved')+'-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
}
document.getElementById('recover').onchange=async e=>{
  try {
    if(activeRequest)throw Error('Wait for the online request to finish before importing.');
    const f=e.target.files[0];if(!f)return;
    if(f.size>100000)throw Error('Recovery file is too large.');
    const d=JSON.parse(await f.text());
    if(d.lesson!=='lucia-day5-v1'||!d.answers||typeof d.answers!=='object')throw Error('Wrong lesson or invalid recovery.');
    for(const v of Object.values(d.answers))if(typeof v!=='string'||v.length>10000)throw Error('Invalid response in recovery.');
    if(fields.some(f=>f.value.trim())&&!confirm('Replace responses with this recovery file? Download the current copy first if needed.'))return;
    clearTimeout(cloudTimer);
    if(currentAlias)persistLocal();
    const a=/^[A-Za-z0-9-]{3,24}$/.test(d.alias||'')?d.alias:'restore-01';
    currentAlias=a;alias.value=a;
    cloud={alias:a,accessKey:/^[a-f0-9]{32,128}$/i.test(d.cloud?.accessKey||'')?d.cloud.accessKey:randomCode(),
      revision:0,confirmedStamp:d.cloud?.confirmedStamp||'',ready:false,blocked:false,edited:true,pending:null};
    document.getElementById('resolveCloud').hidden=true;apply(d);
    try{localStorage.setItem('lucia-last-alias',a);}catch(e){}
    persistLocal();await connectCloud(cloud);
  }catch(err){report('Import failed: '+err.message);}finally{e.target.value='';}
};
fields.forEach(f=>f.addEventListener('input',()=>{if(cloud)cloud.edited=true;}));
window.addEventListener('online',()=>{if(cloud&&!cloud.blocked)flushCloud();});
window.addEventListener('pagehide',()=>{persistLocal();});
window.addEventListener('storage',e=>{
  if(currentAlias&&e.key===key(currentAlias)){
    if(cloud)cloud.blocked=true;clearTimeout(cloudTimer);
    cloudReport('Another tab changed this alias. Download recovery, then reopen the alias before syncing.');
  }
});

async function exportHTML() {
  progress();persistLocal();
  report('Preparing answered HTML…');
  try {
    const copy=document.documentElement.cloneNode(true);
    copy.querySelectorAll('script,dialog,nav,footer,.printanswer').forEach(n=>n.remove());
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
    copy.querySelectorAll('button,input,select').forEach(n=>n.remove());
    copy.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes])if(/^on/i.test(a.name))n.removeAttribute(a.name);});
    // Embed image bytes so the downloaded file remains complete without an assets folder.
    for(const img of copy.querySelectorAll('img')) {
      const response=await fetch(new URL(img.getAttribute('src'),location.href));
      if(!response.ok)throw Error('An image could not be included. Try again or use Print / PDF.');
      const blob=await response.blob();
      img.src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    }
    const blob=new Blob(['<!doctype html>\n'+copy.outerHTML],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
    a.download='Day5-'+(currentAlias||'responses')+'-answered.html';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);report('Answered HTML downloaded with responses, images, and completion percentage.');
  }catch(err){report('HTML export failed: '+(err.message||'Please retry or use Print / PDF.'));}
}
