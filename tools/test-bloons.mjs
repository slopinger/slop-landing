import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const binary=await readFile(process.argv[2]||'site/arcade/bloons/engine.wasm');
const rounds=JSON.parse(await readFile('assembly/rounds.json','utf8')).rounds;
const {instance}=await WebAssembly.instantiate(binary,{});
const e=instance.exports,i=new Int32Array(e.memory.buffer),f=new Float32Array(e.memory.buffer);
assert.deepEqual(WebAssembly.Module.imports(new WebAssembly.Module(binary)),[]);
const at=p=>i[p/4], setI=(p,v)=>{i[p/4]=v;},setF=(p,v)=>{f[p/4]=v;};
const bp=id=>65536+id*64,tp=id=>12288+id*48;
const active=()=>{const result=[];for(let p=65536;p<e.pool_end();p+=64)if(at(p))result.push({id:(p-65536)/64,type:at(p+20),hp:at(p+16),flags:at(p+32),p});return result;};
const advance=(limit=60000)=>{let ticks=0;while(at(12)===1&&ticks++<limit)e.step();assert.notEqual(at(12),1,'round terminates');return ticks;};
const strike=(id,damage=1,kind=6,detect=1)=>e.sandbox_strike(id,damage,kind,detect);
const lab=(type,flags=0)=>{e.reset(1);assert.equal(e.send_bloon(type,flags,1),1);return active()[0];};
const position=(id,d)=>{setF(bp(id)+4,d);setF(bp(id)+8,e.position(d,0));setF(bp(id)+12,e.position(d,1));};
e.reset();assert.equal(at(0),650);assert.equal(at(4),150);
assert.equal(e.can_place(140,110),0);assert.equal(e.can_place(10,450),0);
assert.equal(e.can_place(NaN,200),0);assert.equal(e.place(99,225,185),-1);
assert.equal(e.place(-1,225,185),-1);assert.equal(e.place(0,NaN,185),-1);
const dart=e.place(0,225,185);assert.equal(dart,0);assert.equal(at(0),450);
assert.equal(e.place(0,225,185),-1);assert.equal(e.upgrade_cost(dart,0),140);
assert.equal(e.upgrade(dart,0),1);assert.equal(at(0),310);assert.equal(e.upgrade(dart,0),1);assert.equal(e.upgrade(dart,0),0);
assert.equal(e.sell(dart),378);assert.equal(e.sell(dart),0);
for(const id of [-1,48,0x7fffffff]){assert.equal(e.upgrade(id),0);assert.equal(e.sell(id),0);assert.equal(e.targeting(id,0),0);}
assert.equal(e.targeting(0,4),0);assert.equal(e.send_bloon(0,0,1),0,'campaign cannot inject sandbox balloons');
for(const [d,x,y] of [[0,-24,110],[164,140,110],[334,140,280],[524,330,280],[704,330,100],[894,520,100],[1164,520,370],[1354,710,370],[1509,710,215],[1783,984,215]]){
  assert.equal(e.position(d,0),x);assert.equal(e.position(d,1),y);
}
const expectedRbe=[1,2,3,4,5,11,11,11,23,23,47,104,616,3164,16656,816,55760];
expectedRbe.forEach((rbe,type)=>assert.equal(e.rbe(type,0),rbe,'normal RBE '+type));
for(const [type,hp,rbe] of [[8,4,26],[11,20,114],[12,400,856],[13,1400,4824],[14,8000,27296],[15,800,1256],[16,40000,98360]]){
  assert.equal(e.health(type,4),hp);assert.equal(e.rbe(type,4),rbe);
}
assert.equal(e.health(17,0),0);assert.equal(e.rbe(-1,0),0);
lab(1);strike(0);assert.deepEqual(active().map(b=>b.type),[0]);assert.equal(at(16),1);
for(const [type,children] of [[5,[4,4]],[6,[4,4]],[7,[4,4]],[8,[5,5]],[9,[5,6]],[10,[9,9]],[11,[10,10]],[12,[11,11,11,11]],[13,[12,12,12,12]],[14,[13,13,13,13]],[15,[11,11,11,11]],[16,[14,14,15,15,15]]]){
  lab(type);strike(0,e.health(type,0));
  assert.deepEqual(active().map(b=>b.type).sort((a,b)=>a-b),children,'children of '+type);
}
lab(15,4);strike(0,800);assert.ok(active().every(b=>b.flags===7),'DDT children inherit camo, regrow, fortified');
lab(11,4);strike(0,20);assert.ok(active().every(b=>b.flags===0),'ceramic loses fortification below shell');
lab(5);strike(0,3);assert.ok(active().every(b=>b.type===2),'ordinary overkill penetrates child layers');
lab(12);strike(0,99999);assert.ok(active().every(b=>b.hp===10),'MOAB shell absorbs overkill');
// RBE, pop accounting and cash are independent: ceramic takes 104 damage, pays 95.
lab(11);while(active().length){const b=active()[0];strike(b.id,1);}
assert.equal(at(16),104);assert.equal(at(0),999999+95);
// Immunity matrix, including frozen sharp/cold, DDT combination, and normal damage.
for(const [type,kind] of [[5,1],[9,1],[6,2],[9,2],[8,0],[8,2],[8,3],[7,3],[7,4],[7,5],[15,0],[15,1],[15,2],[15,3],[16,2]]){
  assert.equal(e.can_damage(type,0,0,kind,1),0,'immunity '+type+'/'+kind);
}
for(const duration of [1,2,90]){assert.equal(e.can_damage(0,0,duration,0,1),0);assert.equal(e.can_damage(0,0,duration,2,1),0);}
assert.equal(e.can_damage(0,1,0,6,0),0,'normal damage still needs camo detection');
assert.equal(e.can_damage(15,0,0,5,0),0);assert.equal(e.can_damage(15,0,0,5,1),1);
assert.equal(e.can_damage(7,0,0,6,1),1);assert.equal(e.can_damage(16,0,0,6,1),1);
// Regrow follows the actual ancestry (white cannot regrow into black), with no cash/pop farming.
lab(6,2);strike(0);
assert.ok(active().every(b=>b.type===4));for(let n=0;n<180;n++)e.step();
assert.ok(active().every(b=>b.type===6));const cash=at(0),pops=at(16);
for(const b of active())strike(b.id);
assert.equal(at(0),cash);assert.equal(at(16),pops);
lab(11,6);strike(0,20);for(let n=0;n<180;n++)e.step();
assert.ok(active().every(b=>b.type===11&&b.flags===2&&b.hp===10),'regrown ceramic does not restore fortification');
// Target priorities are exercised through real tower attacks.
for(const [priority,expected] of [[0,500],[1,380],[2,460],[3,420]]){
  e.reset(1);const id=e.place(0,260,200);e.upgrade(id,2);e.upgrade(id,2);assert.equal(e.targeting(id,priority),1);
  e.send_bloon(0,0,4);
  [380,420,460,500].forEach((d,n)=>position(n,d));
  setI(bp(1)+20,11);setI(bp(1)+16,10);setI(bp(1)+52,10);
  e.step();
  const tx=f[(tp(id)+24)/4];
  assert.ok(Math.abs(tx-e.position(expected+1.05*(expected===420?2.5:1),0))<.01,'priority '+priority);
}
for(const type of [1,3]){e.reset(1);const id=e.place(type,225,200);assert.equal(e.targeting(id,3),0,'radial attacks have no targeting selector');}
// Camo is ignored by a dart, but visible to a ninja; ice freezes rather than slowing blimps.
e.reset(1);e.place(0,225,200);e.send_bloon(0,1,1);position(0,420);e.step();assert.equal(at(16),0);
e.reset(1);e.place(5,225,200);e.send_bloon(0,1,1);position(0,420);for(let n=0;n<12;n++)e.step();assert.equal(at(16),1);
e.reset(1);e.place(3,225,232);e.send_bloon(4,0,1);position(0,420);e.step();
const frozen=active()[0];assert.ok(at(frozen.p+24)>0);const distance=f[(frozen.p+4)/4];e.step();assert.equal(f[(frozen.p+4)/4],distance);
lab(16);strike(0,1,2);assert.equal(at(bp(0)+24),0,'BAD cannot be frozen');
// Pool exhaustion must reject whole batches and preserve every child on a blocked split.
e.reset(1);for(let n=0;n<40;n++)assert.equal(e.send_bloon(5,0,100),100);
assert.equal(e.send_bloon(5,0,96),96);assert.equal(at(20),4096);
assert.equal(e.send_bloon(0,0,1),0);strike(0);assert.equal(at(20),4096);assert.equal(at(bp(0)+20),5);
assert.equal(at(36),1,'pool pressure is reported, not hidden');
e.clear_bloons();assert.equal(at(20),0);assert.equal(e.pool_end(),65536);assert.equal(at(36),0);
e.send_bloon(10,0,1);for(let n=0;n<40;n++)e.send_bloon(0,0,100);e.send_bloon(0,0,94);
assert.equal(at(20),4095);const beforeCash=at(0);strike(0,99999);
assert.equal(at(20),4096);assert.equal(active().filter(b=>b.type===9).length,2,'nested splits reserve slots for sibling children');
assert.equal(at(0),beforeCash+1,'capacity pressure must not corrupt the header');
e.clear_bloons();const id=e.place(0,225,200);e.send_bloon(0,0,3);e.clear_bloons();assert.equal(at(tp(id)),1,'clearing preserves towers');
e.reset();assert.equal(e.clear_bloons(),0,'campaign cannot clear threats');
// Validate every scheduled spawn, including overlapping groups and exact 60 Hz timestamps.
const types=['Red','Blue','Green','Yellow','Pink','Black','White','Purple','Lead','Zebra','Rainbow','Ceramic','Moab','Bfb','Zomg','Ddt','Bad'];
for(const round of rounds){
  e.reset();setI(4,1000000);setI(8,round.round-1);e.start();
  const observed=[],expected=[];
  for(const g of round.groups)for(let n=0;n<g.count;n++){
    const start=Math.round(g.start*60),end=Math.round(g.end*60);
    expected.push([start+(g.count===1?0:Math.floor((end-start)*n/(g.count-1)))+1,types.indexOf(g.bloon.replace(/Regrow|Camo|Fortified/g,'')),
      (g.bloon.includes('Camo')?1:0)|(g.bloon.includes('Regrow')?2:0)|(g.bloon.includes('Fortified')?4:0)]);
  }
  while(at(24)>0){e.step();for(const b of active())if(at(b.p+48)===at(28))observed.push([at(28),b.type,b.flags]);}
  const order=(a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
  assert.deepEqual(observed.sort(order),expected.sort(order),'spawn schedule round '+round.round);
}
// Loss and final-round victory are terminal.
e.reset();e.start();assert.equal(e.start(),0);advance();assert.equal(at(4),130);
for(let r=0;r<6&&at(12)===0;r++){e.start();advance();}
assert.equal(at(12),2);assert.equal(e.place(0,225,185),-1);
e.reset();setI(8,39);e.start();setI(24,0);e.step();assert.equal(at(12),3);
const snapshot=Array.from(i);e.step();assert.deepEqual(Array.from(i),snapshot);
// Campaign uses the fixed round table and earned income only; tower stats remain provisional.
e.reset();
const plans=[
  [0,225,185,[2,2,1]], [5,650,275,[0,0,2,2]], [0,225,185,[1,2]],
  [2,420,290,[2,2]], [4,420,185,[0,0]], [4,225,232,[0,0]]
];
const built=[];let planIndex=0,planBought=0;
for(let round=1;round<=40;round++){
  while(planIndex<plans.length){
    const [type,x,y,paths]=plans[planIndex];
    let t=built.find(t=>t.x===x&&t.y===y);
    if(!t){
      if(at(0)<e.cost(type))break;
      const id=e.place(type,x,y);assert.ok(id>=0,'campaign placement '+planIndex);
      t={id,type,x,y};built.push(t);
    }
    while(planBought<paths.length){
      const path=paths[planBought],price=e.upgrade_cost(t.id,path);
      assert.ok(price>0,'campaign upgrade remains legal');
      if(at(0)<price)break;
      assert.equal(e.upgrade(t.id,path),1);planBought++;
    }
    if(planBought<paths.length)break;
    planIndex++;planBought=0;
  }
  assert.equal(e.start(),1);advance();assert.notEqual(at(12),2,'earned-income strategy survives round '+round);
}
assert.equal(at(12),3);assert.equal(at(4),150,'earned-income campaign loses no lives');
assert.equal(at(16),rounds.reduce((n,r)=>n+r.rbe,0),'campaign deals the complete source-table RBE');
const investment=built.reduce((n,t)=>n+at(tp(t.id)+36),0);
assert.equal(at(0)+investment,650+rounds.reduce((n,r)=>n+r.income,0),'campaign income matches source table');
console.log('Wasm: 17 balloon types, child trees, RBE, immunities, modifiers, regrow accounting, targeting, capacity, economy and 40-round campaign passed.');
console.log(JSON.stringify({cash:at(0),lives:at(4),pops:at(16),towers:built.length}));
