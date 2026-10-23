// Presentation only. The handwritten WAT module owns all simulation and rules.
const $ = (id) => document.getElementById(id);
const canvas = $('field'), ctx = canvas.getContext('2d');
const names = ['Dart monkey', 'Tack shooter', 'Bomb shooter', 'Ice monkey', 'Super monkey'];
const colors = ['#dcb37d', '#ed929e', '#a3afbe', '#a6e3ef', '#a6a2ef'];
const descriptions = ['Targets the furthest balloon in range. Upgrades improve range, damage and attack speed.',
  'Hits all balloons in its radius. Place near a bend to cover both sides.',
  'Explodes on contact, damaging a group. The only tower that can break lead shells.',
  'Damages and slows groups to 45% speed. Pair with a bomb shooter for lead waves.',
  'Rapidly fires darts at the furthest balloon. Its range covers several lanes.'];
const path = [[-24,110],[140,110],[140,280],[330,280],[330,100],[520,100],[520,370],[710,370],[710,215],[984,215]];
let engine, ints, floats, placing = -1, selected = -1, cursor = {x:225,y:185}, hovering = false;
let paused = false, speed = 1, previous = 0, accumulator = 0, oldPhase = 0, oldPops = 0;
let sound = false, audio, restartArmed = false, restartTimer;
let best = 0;
try { best = Number(localStorage.getItem('bloon-assembly-best-v1')) || 0; } catch {}
$('best').textContent = 'Best: round ' + best;
const money = (n) => '$' + n.toLocaleString('en-US');
const readI = (address) => ints[address / 4];
const readF = (address) => floats[address / 4];
const tower = (id) => 12288 + id * 48;
function announce(message) { $('message').textContent = message; }
function chirp() {
  if (!sound) return;
  try {
    audio ||= new AudioContext();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.setValueAtTime(460 + Math.random() * 180, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, audio.currentTime + .035);
    gain.gain.setValueAtTime(.025, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .045);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .05);
  } catch {}
}
function choose(type) {
  placing = type; selected = -1; hovering = true;
  announce('Place ' + names[type].toLowerCase() + ' on clear grass. Escape cancels.');
  update();
}
function cancel() { placing = -1; selected = -1; update(); }
function activate() {
  if (!engine || readI(12) >= 2) return;
  restartArmed = false;
  if (placing >= 0) {
    const id = engine.place(placing, cursor.x, cursor.y);
    if (id < 0) announce(readI(0) < engine.cost(placing) ? 'Not enough cash for that tower.' : 'Find clear grass away from the path and other towers.');
    else { selected = id; placing = -1; announce(names[readI(tower(id)+12)] + ' placed. Ready to pop.'); }
  } else {
    selected = -1;
    for (let id=0; id<48; id++) {
      const t=tower(id);
      if (readI(t) && Math.hypot(readF(t+4)-cursor.x,readF(t+8)-cursor.y)<28) { selected=id; break; }
    }
  }
  update();
}
function send() {
  if (!engine) return;
  if (engine.start()) { paused=false; announce('Round ' + readI(8) + ' incoming. You can keep building during a wave.'); update(); }
}
function togglePause() {
  if (!engine || readI(12)!==1) return;
  paused=!paused; accumulator=0; announce(paused?'Paused. Your defense can wait.':'Back to popping.'); update();
}
function reset() {
  engine.reset(); selected=-1; placing=-1; paused=false; oldPhase=0; oldPops=0; accumulator=0;
  restartArmed=false; clearTimeout(restartTimer); $('restart').textContent='Restart';
  announce('Start with a dart monkey near a bend. Send round 1 when ready.'); update();
}
function update() {
  if (!engine) return;
  const phase=readI(12), wave=readI(8);
  $('cash').textContent=money(readI(0)); $('lives').textContent=readI(4);
  $('round').innerHTML=wave+' <small>/ 30</small>'; $('pops').textContent=readI(16).toLocaleString();
  $('phase').textContent=paused?'BATTLEFIELD PAUSED':phase===1?'WAVE IN PROGRESS':phase===0?'PREPARE YOUR DEFENSE':phase===3?'CAMPAIGN COMPLETE':'DEFENSE BREACHED';
  $('remaining').textContent=phase===1?readI(20)+' on field · '+readI(24)+' incoming':'No balloons on the field';
  $('start').disabled=phase!==0; $('start').textContent='▶ Send round '+(wave+1);
  $('pause').disabled=phase!==1; $('pause').textContent=paused?'▶ Resume':'Ⅱ Pause';
  for (const b of document.querySelectorAll('[data-type]')) {
    b.setAttribute('aria-pressed',String(Number(b.dataset.type)===placing));
    b.disabled=phase>=2;
    b.classList.toggle('unaffordable',readI(0)<engine.cost(Number(b.dataset.type)));
  }
  $('tower-actions').hidden=selected<0;
  $('cancel').hidden=placing<0&&selected<0;
  if (placing>=0) {
    $('inspect-name').textContent=names[placing]+' · '+money(engine.cost(placing));
    $('inspect-detail').textContent=descriptions[placing];
  } else if (selected>=0&&readI(tower(selected))) {
    const t=tower(selected), type=readI(t+12), level=readI(t+16), price=engine.upgrade_cost(selected);
    $('inspect-name').textContent=names[type]+' · level '+(level+1);
    $('inspect-detail').textContent=readI(t+32)+' layers popped. '+descriptions[type];
    $('upgrade').textContent=price?'↑ Upgrade · '+money(price):'Fully upgraded';
    $('upgrade').disabled=!price||price>readI(0)||phase>=2;
    $('sell').textContent='Sell · '+money(Math.floor(readI(t+36)*.75)); $('sell').disabled=phase>=2;
  } else {
    $('inspect-name').textContent='Every corner counts.';
    $('inspect-detail').textContent='Cover several stretches of the track with one tower. Bombs become essential when lead balloons arrive on round 10.';
  }
  $('overlay').hidden=phase<2;
  if (phase>=2) {
    $('outcome-kicker').textContent=phase===3?'TEST CAMPAIGN COMPLETE':'THE BALLOONS GOT THROUGH';
    $('outcome').textContent=phase===3?'Clear skies.':'A hole in the defense.';
    $('outcome-detail').textContent='Round '+wave+' · '+readI(16).toLocaleString()+' layers popped'+(phase===3?' · '+readI(4)+' lives saved':'');
  }
  if (oldPhase===1&&phase===0) announce('Round '+wave+' cleared. Bonus collected. Upgrade your defense or send the next wave.');
  if (oldPhase===1&&phase!==1) {
    const completed=phase===2?wave-1:wave;
    if (completed>best) { best=completed; try { localStorage.setItem('bloon-assembly-best-v1',String(best)); } catch {} }
    $('best').textContent='Best: round '+best;
    if (phase===3) window.slop?.emit?.('game',{game:'bloons',score:readI(16)});
  }
  oldPhase=phase;
}
function circle(x,y,r,fill,stroke) {
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
const terrain=document.createElement('canvas');terrain.width=960;terrain.height=480;
const land=terrain.getContext('2d');
land.fillStyle='#3f654d';land.fillRect(0,0,960,480);
for(let y=0;y<480;y+=40)for(let x=0;x<960;x+=40){
  land.fillStyle=((x+y)/40)%2?'#446c5128':'#63825716';land.fillRect(x,y,40,40);
  const n=Math.sin(x*17+y*13)*.5+.5;
  land.strokeStyle='#b4c98c20';land.lineWidth=1;land.beginPath();
  land.moveTo(x+12+n*15,y+23);land.lineTo(x+14+n*15,y+19);land.lineTo(x+17+n*15,y+23);land.stroke();
}
land.lineJoin='round';land.lineCap='round';
for(const [width,color] of [[65,'#243b2d'],[57,'#788873'],[48,'#c3b790'],[35,'#c9bd97']]){
  land.beginPath();path.forEach(([x,y],i)=>i?land.lineTo(x,y):land.moveTo(x,y));land.lineWidth=width;land.strokeStyle=color;land.stroke();
}
land.setLineDash([3,18]);land.lineWidth=2;land.strokeStyle='#9f9373';land.stroke();land.setLineDash([]);
land.font='bold 10px ui-monospace,monospace';land.fillStyle='#ebf1ce';land.fillText('IN →',19,64);land.fillText('OUT →',880,170);
for(const [x,y,r] of [[51,397,25],[878,67,28],[904,393,33],[40,34,14],[405,425,18],[232,45,12]]){
  land.fillStyle='#2b493a';land.beginPath();land.ellipse(x+6,y+8,r,r*.7,0,0,7);land.fill();
  for(let i=0;i<4;i++){land.fillStyle=['#31583e','#527448','#60824f','#3d6342'][i];land.beginPath();land.arc(x+Math.sin(i*2)*r*.4,y+Math.cos(i*2)*r*.3,r*.7,0,7);land.fill();}
}
function drawTower(x,y,type,level,tx=x+1,ty=y,alpha=1) {
  ctx.save();ctx.globalAlpha=alpha;
  circle(x+2,y+5,21,'#172b3350');circle(x,y,20,'#293a3d','#233431');
  ctx.translate(x,y);
  if(type===0||type===4){
    const superMonkey=type===4;
    if(superMonkey){ctx.fillStyle='#c77694';ctx.beginPath();ctx.moveTo(-13,-10);ctx.lineTo(-24,22);ctx.lineTo(15,18);ctx.closePath();ctx.fill();}
    circle(0,0,16,superMonkey?'#6674c2':'#9e6c47','#65472f');
    circle(-13,-2,6,'#b88c61');circle(13,-2,6,'#b88c61');
    ctx.save();ctx.rotate(Math.atan2(ty-y,tx-x));
    ctx.fillStyle=superMonkey?'#ece2a3':'#c89761';ctx.fillRect(3,-5,24,10);
    ctx.fillStyle='#373f42';ctx.fillRect(19,-2,12,4);ctx.restore();
    circle(0,2,10,'#e1b480');circle(-4,-2,2,'#242b30');circle(4,-2,2,'#242b30');
    if(superMonkey){ctx.fillStyle='#b4d6ef';ctx.fillRect(-10,-5,20,5);}
  }else if(type===1){
    circle(0,0,16,'#b86478','#663d4f');circle(0,0,9,'#ef9caa');
    for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*Math.PI/4);ctx.fillStyle='#293941';ctx.fillRect(12,-3,10,6);ctx.restore();}
    circle(0,0,4,'#f5d1c3');
  }else if(type===2){
    circle(0,0,16,'#697681','#34414c');ctx.rotate(Math.atan2(ty-y,tx-x));ctx.fillStyle='#26313d';ctx.fillRect(0,-9,28,18);ctx.fillStyle='#94a5ae';ctx.fillRect(22,-10,5,20);circle(0,0,9,'#8b9da3');
  }else{
    circle(0,0,17,'#416e86','#b7e4e8');
    ctx.strokeStyle='#d0f2f5';ctx.lineWidth=3;
    for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-13);ctx.moveTo(0,-7);ctx.lineTo(-4,-11);ctx.moveTo(0,-7);ctx.lineTo(4,-11);ctx.stroke();ctx.restore();}
  }
  for(let i=0;i<level;i++)circle(-7+i*7,23,2.4,'#e2ef89');
  ctx.restore();
}
function draw() {
  ctx.clearRect(0,0,960,480);ctx.drawImage(terrain,0,0);
  if(!engine)return;
  if(selected>=0&&readI(tower(selected))){
    const t=tower(selected);
    circle(readF(t+4),readF(t+8),engine.range(readI(t+12),readI(t+16)),'#dbe5ff12','#dbe5ff60');
    circle(readF(t+4),readF(t+8),25,null,'#e2ef89');
  }
  for(let id=0;id<48;id++){
    const t=tower(id);if(readI(t))drawTower(readF(t+4),readF(t+8),readI(t+12),readI(t+16),readF(t+24)||readF(t+4)+1,readF(t+28)||readF(t+8));
  }
  for(let b=1024;b<9216;b+=32){
    if(!readI(b))continue;
    const x=readF(b+8),y=readF(b+12),hp=readI(b+16),type=readI(b+20);
    ctx.save();ctx.translate(x,y);
    if(type===8){
      ctx.fillStyle='#192c3444';ctx.beginPath();ctx.ellipse(3,8,36,22,0,0,7);ctx.fill();
      ctx.fillStyle='#789eae';ctx.strokeStyle='#c2d7dc';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,34,19,0,0,7);ctx.fill();ctx.stroke();
      ctx.fillStyle='#c8e0df';ctx.fillRect(-18,-17,5,34);ctx.fillRect(12,-17,5,34);
      ctx.fillStyle='#385167';ctx.fillRect(-8,-7,16,14);ctx.fillStyle='#f0f4d4';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(hp,0,3);
      ctx.fillStyle='#7597a4';ctx.beginPath();ctx.moveTo(-29,0);ctx.lineTo(-42,-17);ctx.lineTo(-42,17);ctx.closePath();ctx.fill();
    }else{
      const fill=type===6?'#87939f':type===7?'#b97447':['','#e47e89','#6eaaca','#83bd79','#ebcf75','#de9ccb'][Math.min(hp,5)];
      ctx.fillStyle='#18352b40';ctx.beginPath();ctx.ellipse(3,8,12,14,0,0,7);ctx.fill();
      ctx.fillStyle=fill;ctx.strokeStyle=type===6?'#c3cdd2':type===7?'#714735':'#293d3b66';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(0,0,12,15,0,0,7);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffff66';ctx.beginPath();ctx.ellipse(-4,-5,3,5,.3,0,7);ctx.fill();
      ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(0,14);ctx.lineTo(-3,18);ctx.lineTo(3,18);ctx.fill();
      if(type===7){ctx.strokeStyle='#e2b585';ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.moveTo(0,-14);ctx.lineTo(0,0);ctx.stroke();}
    }
    if(readI(b+24)>0)circle(0,0,type===8?38:18,null,'#ade9f3bb');
    if(readI(b+28)>0){ctx.strokeStyle='#fff4d6';ctx.lineWidth=2;for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*1.257);ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(22,0);ctx.stroke();ctx.restore();}}
    ctx.restore();
  }
  for(let e=24576;e<30720;e+=24){
    const ttl=readI(e+16);if(ttl<=0)continue;
    const type=readI(e+20),x=readF(e),y=readF(e+4),tx=readF(e+8),ty=readF(e+12),p=1-ttl/12;
    ctx.save();ctx.globalAlpha=ttl/12;
    if(type===0||type===4){ctx.strokeStyle='#f4e6be';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+(tx-x)*p,y+(ty-y)*p);ctx.lineTo(x+(tx-x)*Math.min(1,p+.35),y+(ty-y)*Math.min(1,p+.35));ctx.stroke();}
    else if(type===2){circle(tx,ty,12+p*45,'#f2c37d22','#f4c682');}
    else {circle(x,y,15+p*(type===3?78:65),null,type===3?'#bce9ef':'#efc1ba');if(type===1)for(let i=0;i<8;i++)circle(x+Math.cos(i*Math.PI/4)*p*85,y+Math.sin(i*Math.PI/4)*p*85,2,'#f9d9c9');}
    ctx.restore();
  }
  if(placing>=0&&hovering){
    const valid=engine.can_place(cursor.x,cursor.y)&&readI(0)>=engine.cost(placing);
    circle(cursor.x,cursor.y,engine.range(placing,0),valid?'#e2ef8920':'#f28c8825',valid?'#e2ef89aa':'#f28c88');
    drawTower(cursor.x,cursor.y,placing,0,cursor.x+1,cursor.y,.7);
    ctx.fillStyle=valid?'#eff4cb':'#ffc3bc';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText(valid?'CLICK TO BUILD':'CANNOT BUILD HERE',cursor.x,Math.max(16,cursor.y-35));
  }
  if(paused){ctx.fillStyle='#15263288';ctx.fillRect(0,0,960,480);ctx.font='bold 30px system-ui';ctx.textAlign='center';ctx.fillStyle='#f2f3df';ctx.fillText('Ⅱ PAUSED',480,240);}
}
function frame(time){
  const delta=previous?Math.min(time-previous,100):0;previous=time;
  if(engine&&!paused&&!document.hidden){
    accumulator+=delta*speed;
    let steps=0;
    while(accumulator>=1000/60&&steps<24){engine.step();accumulator-=1000/60;steps++;}
    if(readI(16)>oldPops){chirp();oldPops=readI(16);}
    update();
  }
  draw();requestAnimationFrame(frame);
}
document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.type))));
$('cancel').addEventListener('click',cancel);
$('start').addEventListener('click',send);
$('pause').addEventListener('click',togglePause);
$('speed').addEventListener('click',()=>{speed=speed===1?2:speed===2?3:1;$('speed').textContent=speed+'× speed';});
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));if(sound)chirp();});
$('restart').addEventListener('click',()=>{
  if(!engine)return;
  if(restartArmed||(!readI(8)&&readI(0)===650)||readI(12)>=2){reset();return;}
  restartArmed=true;$('restart').textContent='Confirm restart';announce('Press Confirm restart to clear this defense.');
  clearTimeout(restartTimer);restartTimer=setTimeout(()=>{restartArmed=false;$('restart').textContent='Restart';},5000);
});
$('play-again').addEventListener('click',()=>reset());
$('upgrade').addEventListener('click',()=>{if(selected>=0&&engine.upgrade(selected))announce('Tower upgraded. More range, more damage, faster shots.');update();});
$('sell').addEventListener('click',()=>{if(selected>=0){const value=engine.sell(selected);if(value){announce('Tower sold for '+money(value)+'.');selected=-1;}}update();});
function pointer(event){const r=canvas.getBoundingClientRect();cursor={x:(event.clientX-r.left)*960/r.width,y:(event.clientY-r.top)*480/r.height};hovering=true;}
canvas.addEventListener('pointermove',pointer);
canvas.addEventListener('pointerleave',()=>{hovering=false;});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer(e);canvas.focus({preventScroll:true});activate();});
window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key>='1'&&e.key<='5'&&engine){choose(Number(e.key)-1);return;}
  if(e.key==='Escape'){cancel();return;}
  if(e.code==='Space'&&!e.repeat&&!e.target.matches('button,a')){e.preventDefault();if(engine){readI(12)===0?send():togglePause();}return;}
  if(e.target===canvas){
    const moves={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};
    if(moves[e.key]){e.preventDefault();cursor.x=Math.max(24,Math.min(936,cursor.x+moves[e.key][0]));cursor.y=Math.max(26,Math.min(454,cursor.y+moves[e.key][1]));hovering=true;}
    if(e.key==='Enter'){e.preventDefault();activate();}
  }
});
document.addEventListener('visibilitychange',()=>{accumulator=0;previous=0;if(document.hidden&&engine&&readI(12)===1&&!paused){paused=true;announce('Paused while the tab is hidden. Resume when ready.');update();}});
try {
  const response=await fetch(new URL('./engine.wasm',import.meta.url));
  if(!response.ok)throw new Error('Engine HTTP '+response.status);
  const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});
  engine=instance.exports;ints=new Int32Array(engine.memory.buffer);floats=new Float32Array(engine.memory.buffer);
  reset();requestAnimationFrame(frame);
}catch(error){announce('The WebAssembly engine could not load. Reload to try again. '+error.message);$('start').textContent='Engine unavailable';}
