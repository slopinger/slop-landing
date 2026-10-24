import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const binary=await readFile(process.argv[2]||'site/arcade/bloons/engine.wasm');
const {instance:{exports:e}}=await WebAssembly.instantiate(binary,{});
const i=new Int32Array(e.memory.buffer),f=new Float32Array(e.memory.buffer);
const at=p=>i[p/4],si=(p,v)=>i[p/4]=v,sf=(p,v)=>f[p/4]=v;
const bp=n=>65536+n*64,tp=n=>12288+n*48;
const balloons=()=>{const a=[];for(let p=65536;p<e.pool_end();p+=64)if(at(p))a.push(p);return a;};
const shots=()=>{const a=[];for(let p=917504;p<e.projectile_end();p+=96)if(at(p))a.push(p);return a;};
const pos=(n,d)=>{sf(bp(n)+4,d);sf(bp(n)+8,e.position(d,0));sf(bp(n)+12,e.position(d,1));};
const ticks=n=>{for(let j=0;j<n;j++)e.step();};
const buy=(id,path,count=1)=>{for(let n=0;n<count;n++)assert.equal(e.upgrade(id,path),1);};
const setup=(type=0,paths=[],bloon=11,flags=0)=>{
  e.reset(1);const id=e.place(type,225,232);assert.ok(id>=0);
  for(const p of paths)buy(id,p);
  e.send_bloon(bloon,flags,1);pos(0,420);e.step();
  sf(tp(id)+20,100000);return {id,p:shots()[0]};
};
// The engine owns all three path choices, tier caps, economy and sale/reuse state.
for(let type=0;type<6;type++)for(let major=0;major<3;major++){
  e.reset(1);const id=e.place(type,225,185);
  const cap=type===0?3:2;buy(id,major,cap);
  assert.equal(e.tier(id,major),cap);assert.equal(e.upgrade(id,major),0);
  const secondary=(major+1)%3;buy(id,secondary,2);
  assert.equal(e.upgrade(id,(major+2)%3),0,'third path is locked');
  if(type===0)assert.equal(e.upgrade(id,secondary),0,'only one path can exceed tier two');
  const investment=at(tp(id)+36),refund=e.sell(id);assert.equal(refund,Math.floor(investment*7/10));
  const replacement=e.place(type,225,185);assert.equal(replacement,id);
  assert.deepEqual([0,1,2].map(p=>e.tier(id,p)),[0,0,0]);
}
for(const path of [-1,3,2147483647]){e.reset(1);e.place(0,225,185);assert.equal(e.upgrade(0,path),0);assert.equal(e.upgrade_cost(0,path),0);}
e.reset(1);let id=e.place(0,225,185);buy(id,0,2);buy(id,1,3);assert.equal(e.upgrade(id,0),0,'2-3-0 cannot become 3-3-0');
// A real shot takes time to arrive, pierces exactly two separate balloons, and
// cannot repeatedly hit the same blimp or its children across later ticks.
let {p}=setup(0,[],0);assert.ok(p);assert.equal(at(16),0);ticks(6);assert.equal(at(16),1);
({p}=setup());assert.ok(p);
for(let n=0;n<3;n++){if(n)e.send_bloon(0,0,1);si(bp(n)+20,0);si(bp(n)+16,1);si(bp(n)+52,1);pos(n,440+n*40);}
sf(p+4,190);sf(p+8,280);sf(p+12,200);sf(p+16,0);e.step();
assert.equal(at(16),2,'swept collision does not tunnel and obeys pierce');
assert.equal(balloons().length,1);
({p}=setup(0,[],12));ticks(1);assert.equal(at(16),1);
sf(p+12,0);sf(p+16,0);sf(p+4,f[(bp(0)+8)/4]);sf(p+8,280);
ticks(3);assert.equal(at(16),1,'one projectile hits a shell only once');
({p}=setup(0,[2,2,2],12));assert.equal(at(16),3);
si(bp(0)+16,1);sf(tp(0)+20,0);e.step();sf(tp(0)+20,100000);ticks(1);
const afterSplit=at(16);assert.equal(balloons().length,4);ticks(2);
assert.equal(at(16),afterSplit,'children inherit projectile hit history');
// Branching regrow ancestors cannot duplicate unpaid descendants' credits.
for(const type of [6,11]){
  e.reset(1);e.send_bloon(type,2,1);e.sandbox_strike(0,e.health(type,0),6,1);
  ticks(180);
  while(balloons().length){const b=balloons()[0];e.sandbox_strike((b-65536)/64,1,6,1);}
  assert.equal(at(16),e.rbe(type,0),'regrow splitting conserves original RBE');
  assert.equal(at(0),999999+(type===6?11:95),'regrow splitting conserves original cash');
}
for(const flags of [0,4]){
  e.reset(1);e.send_bloon(16,flags,1);
  while(balloons().length){const b=balloons()[0];e.sandbox_strike((b-65536)/64,99999,6,1);}
  assert.equal(at(16),e.rbe(16,flags),'mixed BAD child families conserve weighted pop budgets');
  assert.equal(at(0),999999+13346,'fortification changes HP, not shell cash');
}
// The three dart specializations really produce different attacks.
({p}=setup(0,[0,0,0],11));assert.equal(at(p+92),6);ticks(10);assert.equal(at(16),3,'spiked ball has ceramic bonus');
setup(0,[1,1,1]);assert.equal(shots().length,3,'triple shot launches a spread');
({p}=setup(0,[2,2,2]));ticks(8);assert.equal(at(16),3,'crossbow deals three damage');
// Radial tacks are physical shots with 8/10/12 directions, not an instant area hit.
for(const count of [0,1,2]){setup(1,Array(count).fill(2));assert.equal(shots().length,8+count*2);assert.equal(at(16),0);}
setup(1,[1,1]);assert.ok(shots().every(p=>at(p+24)===4),'super range adds tack pierce');
// Bomb impact and fragments preserve blast immunities and snapshot ownership.
({p}=setup(2,[2,2],5));ticks(8);assert.ok(at(16)>0,'frag bombs damage black balloons');
assert.ok(Array.from({length:(e.projectile_end()-917504)/96},(_,n)=>917504+n*96).some(p=>at(p+92)===11),'bomb releases sharp fragments');
setup(2,[],5);ticks(8);assert.equal(at(16),0,'basic bombs cannot pop black');
setup(2,[0,0],11);ticks(8);assert.equal(at(16),2,'heavy bombs deal two damage');
setup(0);const oldSerial=at(tp(0)+44);e.sell(0);id=e.place(0,225,232);assert.notEqual(at(tp(id)+44),oldSerial);sf(tp(id)+20,100000);
ticks(8);assert.ok(at(16)>0);assert.equal(at(tp(id)+32),0,'old shots do not credit replacement towers');
// Ice upgrades: camo/lead, lasting slow, longer freeze, child-layer soak and re-freeze.
setup(3,[0,0],8,1);assert.ok(at(16)>0,'Cold Snap damages camo lead');
setup(3,[],8,1);assert.equal(at(16),0);
setup(3,[0],11);const b=balloons()[0];assert.ok(at(b+24)>0);si(b+24,0);
const progress=f[(b+4)/4];e.step();assert.ok(Math.abs(f[(b+4)/4]-progress-1.3125)<.001,'permafrost slows after thaw');
setup(3,[1],11);assert.equal(at(bp(0)+24),132);
setup(3,[1,1],11);e.sandbox_strike(0,1,6,1);assert.ok(at(bp(0)+24)>0,'deep freeze survives a shell hit');
setup(3,[2,2],11);const hp=at(bp(0)+16);sf(tp(0)+20,0);e.step();assert.equal(at(bp(0)+16),hp-1,'Re-Freeze can hit frozen balloons');
// Damage types and camo coverage on the rapid-fire super path.
setup(4,[0],7);ticks(8);assert.equal(at(16),0,'laser cannot pop purple');
setup(4,[0,0],8);ticks(8);assert.ok(at(16)>0,'plasma pops lead');
setup(4,[2,2],11,1);ticks(8);assert.equal(at(16),3,'Ultravision adds camo damage');
setup(4,[2],12);ticks(2);const moab=balloons()[0],d=f[(moab+4)/4];e.step();
assert.ok(Math.abs(f[(moab+4)/4]-d-.735)<.001,'Knockback slows blimps');
setup(4,[2],16);ticks(2);const bad=balloons()[0],bd=f[(bad+4)/4];e.step();
assert.ok(Math.abs(f[(bad+4)/4]-bd-.189)<.001,'BAD resists knockback');
// Ninja homing, distraction, camo stripping (including immune DDT shells), and caltrops.
setup(5,[1,1],11,1);ticks(8);assert.ok(balloons().every(b=>!(at(b+32)&1)),'counter espionage strips camo');
setup(5,[1,1],15);ticks(8);assert.equal(at(bp(0)+32)&1,0,'DDT can be decamoed');
({p}=setup(5,[2]));const vx=f[(p+12)/4];pos(0,480);e.step();assert.notEqual(f[(p+12)/4],vx,'seeking shuriken turns');
setup(5,[1]);let distracted=false;
for(let n=0;n<100&&!distracted;n++){sf(tp(0)+20,0);e.step();distracted=balloons().some(b=>at(524288+(b-65536)/2+12)>0);}
assert.ok(distracted,'Distraction sends ordinary balloons backward');
setup(5,[2,2]);assert.ok(shots().some(p=>at(p+92)===10&&at(p+20)>300),'caltrops persist on the track');
// Pool pressure defers a whole volley; eight reserved slots permit bomb fragments.
({p}=setup(1));for(let q=917504;q<917504+2040*96;q+=96){si(q,1);si(q+20,500);si(q+24,1);sf(q+4,900);sf(q+8,450);sf(q+12,0);sf(q+16,0);}
si(44,2040);sf(tp(0)+20,0);e.step();assert.equal(at(48),1,'capacity pressure is visible');assert.equal(at(44),2040);
assert.equal(e.clear_bloons(),1);assert.equal(at(44),0);assert.equal(at(48),0);assert.equal(e.projectile_end(),917504);
console.log('Wasm: named upgrade paths, crosspaths, travel, swept collision, pierce, child hit histories, fragments, freeze, homing, caltrops and ownership passed.');
