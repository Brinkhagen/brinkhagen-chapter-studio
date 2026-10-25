'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const bridge=fs.readFileSync(path.join(__dirname,'..','src','editor-bridge.js'),'utf8');

function prepare(editors) {
  const listeners=new Map();
  const document={
    addEventListener(name,callback) {if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(callback);},
    dispatchEvent(event) {for(const callback of listeners.get(event.type)||[]) callback(event);}
  };
  class CustomEvent {
    constructor(type,options) {this.type=type;this.detail=options.detail;}
  }
  vm.runInNewContext(bridge,{window:{tinymce:{editors}},document,CustomEvent});
  return {document,CustomEvent};
}

test('TinyMCE bridge writes the chapter body and fires editor change hooks',()=>{
  let html='',dirty=false,changeCount=0,saveCount=0;
  const editor={
    initialized:true,
    getBody:()=>({innerText:html.replace(/<br\s*\/?\s*>/g,'\n').replace(/<\/p>/g,'\n\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')}),
    setContent(value) {html=value;},
    setDirty(value) {dirty=value;},
    fire(name) {if(name==='change')changeCount++;},
    save() {saveCount++;}
  };
  const {document,CustomEvent}=prepare([editor]);
  let result;
  document.addEventListener('brinkhagen:tinymce:result',e=>{result=JSON.parse(e.detail);});
  document.dispatchEvent(new CustomEvent('brinkhagen:tinymce:set',{
    detail:JSON.stringify({id:'test-1',text:'Hello & world.\nSecond line.\n\nNext paragraph.'})
  }));
  assert.deepEqual(result,{id:'test-1',ok:true});
  assert.equal(dirty,true);
  assert.equal(changeCount,1);
  assert.equal(saveCount,1);
  assert.match(html,/Hello &amp; world/);
});

test('TinyMCE bridge refuses ambiguous multiple editors',()=>{
  let changes=0;
  const editor={initialized:true,getBody:()=>({innerText:''}),setContent() {changes++;}};
  const {document,CustomEvent}=prepare([editor,editor]);
  let result;
  document.addEventListener('brinkhagen:tinymce:result',e=>{result=JSON.parse(e.detail);});
  document.dispatchEvent(new CustomEvent('brinkhagen:tinymce:set',{
    detail:JSON.stringify({id:'test-2',text:'Do not write'})
  }));
  assert.equal(result.id,'test-2');
  assert.equal(result.ok,false);
  assert.equal(changes,0);
});
