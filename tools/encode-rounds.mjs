// Build-time numeric data encoding only. Scheduling and game rules remain WAT.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('assembly/bloons.wat','utf8');
const {rounds}=JSON.parse(await readFile('assembly/rounds.json','utf8'));
const types=['Red','Blue','Green','Yellow','Pink','Black','White','Purple','Lead','Zebra','Rainbow','Ceramic','Moab','Bfb','Zomg','Ddt','Bad'];
assert.equal(rounds.length,40);
const groupCount=rounds.reduce((n,r)=>n+r.groups.length,0);
const bytes=new Uint8Array(512+groupCount*24),view=new DataView(bytes.buffer);
let groupIndex=0;
rounds.forEach((round,index)=>{
  assert.equal(round.round,index+1);
  assert.ok(round.groups.length<=128);
  view.setInt32(round.round*8,328192+groupIndex*24,true);
  view.setInt32(round.round*8+4,round.groups.length,true);
  for(const group of round.groups){
    const name=group.bloon.replace(/Regrow|Camo|Fortified/g,'');
    const type=types.indexOf(name);assert.ok(type>=0,name);
    const flags=(group.bloon.includes('Camo')?1:0)|(group.bloon.includes('Regrow')?2:0)|(group.bloon.includes('Fortified')?4:0);
    assert.ok(Number.isInteger(group.count)&&group.count>0&&group.count<=4096);
    const start=Math.round(group.start*60),end=Math.round(group.end*60);
    assert.ok(Number.isFinite(start)&&end>=start);
    [type,flags,group.count,start,end,0].forEach((n,c)=>view.setInt32(512+groupIndex*24+c*4,n,true));
    groupIndex++;
  }
});
const encoded=Array.from(bytes,b=>'\\'+b.toString(16).padStart(2,'0')).join('');
const marker='  ;; @ROUND_DATA';
assert.equal(source.split(marker).length,2);
await writeFile('site/arcade/bloons/engine.wat',source.replace(marker,'  (data (i32.const 327680) "'+encoded+'")'));
