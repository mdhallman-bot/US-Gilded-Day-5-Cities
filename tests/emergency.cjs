const fs=require('fs'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync(__dirname+'/../index.html','utf8');
const start=s.indexOf('function emergencyPDF(){'),end=s.indexOf('function toggleHotspot(',start);
assert(start>0&&end>start);let printed=false;const meta={textContent:''};const fields=Array.from({length:28},(_,i)=>({value:i===0?'Typed response':'',after:p=>{}}));
const doc={title:'Lesson',querySelectorAll:()=>[],createElement:()=>({}),querySelector:q=>q==='#printmeta'?meta:{textContent:'1/28 responses · 4%'}};
const context={fields,document:doc,currentAlias:'audit',progress(){},persistLocal(){throw Error('cloud script failed')},window:{print(){printed=true;assert(doc.title.includes('EMERGENCY'));assert(meta.textContent.includes('1/28 responses · 4%'));assert(meta.textContent.includes('EMERGENCY PDF'))}}};
vm.createContext(context);vm.runInContext(s.slice(start,end),context);vm.runInContext('emergencyPDF()',context);assert(printed);assert.equal(doc.title,'Lesson');console.log('Emergency PDF prints local responses and completion even when saving throws; no server or grading call.');
