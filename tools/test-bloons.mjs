import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const binary=await readFile(process.argv[2]||'site/arcade/bloons/engine.wasm');
const {instance}=await WebAssembly.instantiate(binary,{});
const e=instance.exports, i=new Int32Array(e.memory.buffer),f=new Float32Array(e.memory.buffer);
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(binary)),[], 'simulation has no host imports');
const at=(address)=>i[address/4];
const setI=(address,value)=>{i[address/4]=value;};
const setF=(address,value)=>{f[address/4]=value;};
const advance=(limit=20000)=>{let ticks=0;while(at(12)===1&&ticks++<limit)e.step();assert.notEqual(at(12),1,'round terminates');return ticks;};
e.reset();assert.equal(at(0),650);assert.equal(at(4),100);
assert.equal(e.can_place(140,110),0,'track is blocked');
assert.equal(e.can_place(10,450),0,'map border is blocked');
assert.equal(e.can_place(NaN,200),0,'nonfinite coordinates are rejected');
assert.equal(e.place(99,225,185),-1,'invalid tower type');
assert.equal(e.place(-1,225,185),-1,'negative tower type');
assert.equal(e.place(0,NaN,185),-1);
const dart=e.place(0,225,185);assert.equal(dart,0);assert.equal(at(0),470);
assert.equal(e.place(0,225,185),-1,'overlapping tower rejected');
assert.equal(e.upgrade_cost(dart),180);assert.equal(e.upgrade(dart),1);assert.equal(at(0),290);
assert.equal(e.upgrade(dart),0,'cannot overspend');
assert.equal(e.sell(dart),270,'75 percent of total investment refunded');
assert.equal(e.sell(dart),0,'cannot sell twice');assert.equal(e.upgrade(-1),0);
assert.equal(e.upgrade(48),0);assert.equal(e.sell(48),0);
for(const [distance,x,y] of [[0,-24,110],[164,140,110],[334,140,280],[524,330,280],[704,330,100],[894,520,100],[1164,520,370],[1354,710,370],[1509,710,215],[1783,984,215]]){
  assert.equal(e.position(distance,0),x);assert.equal(e.position(distance,1),y);
}
e.reset();e.place(0,225,185);e.start();assert.equal(e.start(),0,'cannot overlap waves');advance();
assert.equal(at(12),0);assert.ok(at(16)>0);assert.ok(at(0)>470);
e.reset();e.start();advance();assert.equal(at(4),84,'16 red balloons cost 16 lives');
for(let r=0;r<6&&at(12)===0;r++){e.start();advance();}
assert.equal(at(12),2,'undefended run loses');
assert.equal(e.place(0,225,185),-1,'game over prevents purchases');assert.equal(e.start(),0);
// Controlled fixtures exercise real tower attacks without relying on generated waves.
function fixture(type,balloonType,hp=12){
  e.reset();setI(0,20000);const id=e.place(type,225,200);
  e.start();setI(24,0);setI(1024,1);setF(1028,400);setF(1032,206);setF(1036,280);setI(1040,hp);setI(1044,balloonType);
  return id;
}
fixture(0,6);for(let tick=0;tick<50;tick++)e.step();assert.equal(at(1040),12,'lead resists darts');
fixture(2,6);e.step();assert.equal(at(1040),9,'bomb strips lead layers');
fixture(3,0,5);setF(1028,420);e.step();assert.ok(at(1048)>0,'ice applies slow');assert.equal(at(1040),4);
fixture(4,0,5);e.step();assert.equal(at(1040),4,'super monkey fires');
// Upgrade limits, final-round victory, and terminal state immutability.
e.reset();setI(0,20000);const id=e.place(0,225,185);
assert.equal(e.upgrade(id),1);assert.equal(e.upgrade(id),1);assert.equal(e.upgrade(id),1);
assert.equal(e.upgrade_cost(id),0);assert.equal(e.upgrade(id),0);
setI(8,29);e.start();setI(24,0);e.step();assert.equal(at(12),3);
const snapshot=Array.from(i);e.step();assert.deepEqual(Array.from(i),snapshot);
// Real-income campaign: build, upgrade and buy new towers only with earned cash.
e.reset();
const sites=[[0,225,185],[1,245,350],[2,420,185],[3,425,290],[4,610,275],[2,620,175],[4,785,295],[1,600,435],[2,420,40],[4,65,220],[0,790,130],[2,850,295],[1,245,420],[2,610,40]];
let built=[];
for(let round=1;round<=30;round++){
  // Establish coverage first, then improve existing towers.
  for(const [type,x,y] of sites){
    if(built.length>=4&&built.some(t=>at(12288+t.id*48+16)<2))break;
    if(built.some(t=>t.x===x&&t.y===y))continue;
    if(at(0)>=e.cost(type)){const id=e.place(type,x,y);if(id>=0)built.push({id,x,y,type});}
    else break; // Save for the next planned tower instead of spending on cheaper ones.
  }
  for(let pass=0;pass<3&&built.length>=4;pass++)for(const t of built){
    const price=e.upgrade_cost(t.id);if(price&&price<=at(0))e.upgrade(t.id);
  }
  assert.equal(e.start(),1,'campaign starts round '+round);
  advance();
  assert.notEqual(at(12),2,'real-income strategy survives round '+round);
}
assert.equal(at(12),3);
console.log('Wasm engine: placement, economy, targeting, lead, ice, upgrades, loss, victory and 30-round earned-income campaign passed.');
console.log(JSON.stringify({cash:at(0),lives:at(4),pops:at(16),towers:built.length}));
