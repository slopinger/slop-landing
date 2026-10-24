// Presentation only. The handwritten WAT module owns all simulation and rules.
const $ = (id) => document.getElementById(id);
const canvas = $('field'), ctx = canvas.getContext('2d');
const names = ['Dart monkey', 'Tack shooter', 'Bomb shooter', 'Ice monkey', 'Super monkey', 'Ninja monkey'];
const bloonNames=['Red','Blue','Green','Yellow','Pink','Black','White','Purple','Lead','Zebra','Rainbow','Ceramic','MOAB','BFB','ZOMG','DDT','BAD'];
const descriptions = ['Darts travel through balloons until their pierce runs out.',
  'Fires eight tacks outward. Range and pierce upgrades help cover bends.',
  'Bombs explode on impact. Black and zebra resist basic explosions.',
  'Freezes nearby ordinary balloons. Cold Snap adds lead and camo coverage.',
  'Rapid darts, with laser and plasma paths for different damage types.',
  'Detects camo. Upgrade for seeking shurikens, caltrops or camo removal.'];
let catalog;
const targets=['First','Last','Close','Strong'];
const path = [[-24,110],[140,110],[140,280],[330,280],[330,100],[520,100],[520,370],[710,370],[710,215],[984,215]];
let engine, ints, floats, placing = -1, selected = -1, cursor = {x:225,y:185}, hovering = false;
let paused = false, speed = 1, previous = 0, accumulator = 0, oldPhase = 0, oldPops = 0;
let lastUi = 0;
let sound = false, audio, restartArmed = false, restartTimer;
try { sound = Boolean(window.slop?.store?.get('sound', false)); } catch {}
let best = 0;
try { best = Number(localStorage.getItem('bloon-assembly-best-v2')) || 0; } catch {}
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
  if (readI(32)) {
    const type=Number($('spawn-type').value),count=Number($('spawn-count').value);
    const flags=($('spawn-camo').checked?1:0)|($('spawn-regrow').checked?2:0)|($('spawn-fortified').checked?4:0);
    if(Number.isInteger(count)&&count>=1&&count<=100&&engine.send_bloon(type,flags,count)){paused=false;announce('Sent '+count+' '+bloonNames[type]+' balloons.');}else announce('Could not send balloons. Use a count from 1 to 100 and leave room on the field.');
    update();return;
  }
  if (engine.start()) { paused=false; announce('Round ' + readI(8) + ' incoming. You can keep building during a wave.'); update(); }
}
function togglePause() {
  if (!engine || readI(12)!==1) return;
  paused=!paused; accumulator=0; announce(paused?'Paused. Your defense can wait.':'Back to popping.'); update();
}
function reset() {
  engine.reset(Number($('mode').value)); selected=-1; placing=-1; paused=false; oldPhase=0; oldPops=0; accumulator=0;
  restartArmed=false; clearTimeout(restartTimer); $('restart').textContent='Restart';
  announce(readI(32)?'Sandbox ready. Build a defense and choose balloons to send.':'Cover bends with dart monkeys. Add a ninja before camo round 24 and bombs before lead round 28.'); update();
}
function update() {
  if (!engine) return;
  const phase=readI(12), wave=readI(8);
  $('cash').textContent=money(readI(0)); $('lives').textContent=readI(4);
  $('round').innerHTML=readI(32)?'LAB':wave+' <small>/ 40</small>'; $('pops').textContent=readI(16).toLocaleString();
  $('phase').textContent=paused?'BATTLEFIELD PAUSED':phase===1?'WAVE IN PROGRESS':phase===0?'PREPARE YOUR DEFENSE':phase===3?'CAMPAIGN COMPLETE':'DEFENSE BREACHED';
  $('remaining').textContent=phase===1?readI(20)+' on field · '+readI(24)+' incoming':'No balloons on the field';
  $('sandbox-controls').hidden=!readI(32);
  $('start').disabled=readI(32)?phase>=2:phase!==0; $('start').textContent=readI(32)?'▶ Send balloons':'▶ Send round '+(wave+1);
  $('pause').disabled=phase!==1; $('pause').textContent=paused?'▶ Resume':'Ⅱ Pause';
  for (const b of document.querySelectorAll('[data-type]')) {
    b.setAttribute('aria-pressed',String(Number(b.dataset.type)===placing));
    b.querySelector('strong').textContent=money(engine.cost(Number(b.dataset.type)));
    b.disabled=phase>=2;
    b.classList.toggle('unaffordable',readI(0)<engine.cost(Number(b.dataset.type)));
  }
  $('tower-actions').hidden=selected<0;
  $('targeting-wrap').hidden=selected<0||[1,3].includes(readI(tower(selected)+12));
  $('cancel').hidden=placing<0&&selected<0;
  if (placing>=0) {
    $('inspect-name').textContent=names[placing]+' · '+money(engine.cost(placing));
    $('inspect-detail').textContent=descriptions[placing];
  } else if (selected>=0&&readI(tower(selected))) {
    const t=tower(selected), type=readI(t+12), tiers=[0,1,2].map(p=>engine.tier(selected,p));
    $('targeting').value=String(readI(t+40)); $('targeting').disabled=phase>=2;
    $('inspect-name').textContent=names[type]+' · '+tiers.join('–');
    $('inspect-detail').textContent=readI(t+32)+' damage'+([1,3].includes(type)?' · radial attack. ':' · targeting '+targets[readI(t+40)]+'. ')+descriptions[type];
    for(const button of document.querySelectorAll('[data-path]')){
      const p=Number(button.dataset.path), next=catalog.towers[type].paths[p][tiers[p]], price=engine.upgrade_cost(selected,p);
      button.querySelector('b').textContent=next?next.name:'Available tiers purchased';
      button.querySelector('span').textContent=!next?'Higher tiers are in development':price?money(price)+' · '+next.description:'Locked by crosspath choice';
      button.disabled=!price||price>readI(0)||phase>=2;
    }
    $('sell').textContent='Sell · '+money(Math.floor(readI(t+36)*7/10)); $('sell').disabled=phase>=2;
  } else {
    $('inspect-name').textContent='Every corner counts.';
    $('inspect-detail').textContent='Camo round 24 needs a ninja. Lead round 28 needs bombs. The MOAB on round 40 releases four ceramics.';
  }
  $('overlay').hidden=phase<2;
  if (phase>=2) {
    $('outcome-kicker').textContent=phase===3?'40 ROUNDS CLEAR':'THE BALLOONS GOT THROUGH';
    $('outcome').textContent=phase===3?'Clear skies.':'A hole in the defense.';
    $('outcome-detail').textContent='Round '+wave+' · '+readI(16).toLocaleString()+' layers popped'+(phase===3?' · '+readI(4)+' lives saved':'');
  }
  if (oldPhase===1&&phase===0&&!readI(32)) announce('Round '+wave+' cleared. Bonus collected. Upgrade your defense or send the next wave.');
  if (oldPhase===1&&phase!==1&&!readI(32)) {
    const completed=phase===2?wave-1:wave;
    if (completed>best) { best=completed; try { localStorage.setItem('bloon-assembly-best-v2',String(best)); } catch {} }
    $('best').textContent='Best: round '+best;
    if (phase===3) window.slop?.emit?.('game',{game:'bloons',score:readI(16)});
  }
  if(readI(48))announce('Projectile capacity reached. Towers wait until shots expire; clear the sandbox to reset.');
  if(readI(36))announce('The field is full. New balloons wait for space; clear the sandbox to reset.');
  oldPhase=phase;
}
function circle(x,y,r,fill,stroke) {
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
const terrain=document.createElement('canvas');terrain.width=960;terrain.height=480;
const land=terrain.getContext('2d');
land.fillStyle='#5fae3a';land.fillRect(0,0,960,480);
for(let y=0;y<480;y+=40)for(let x=0;x<960;x+=40){
  land.fillStyle=((x+y)/40)%2?'rgba(74,143,44,.25)':'rgba(125,212,58,.18)';land.fillRect(x,y,40,40);
  const n=Math.sin(x*17+y*13)*.5+.5;
  land.strokeStyle='#387020';land.lineWidth=2;land.beginPath();
  land.moveTo(x+12+n*15,y+23);land.lineTo(x+14+n*15,y+18);land.lineTo(x+17+n*15,y+23);land.stroke();
  if(n>.82){
    land.fillStyle=n>.91?'#ffd700':'#ffffff';
    land.beginPath();land.arc(x+14+n*15,y+16,2,0,Math.PI*2);land.fill();
  }
}
land.lineJoin='round';land.lineCap='round';
for(const [width,color] of [[68,'#16152a'],[60,'#a37130'],[50,'#d49b4d'],[38,'#e6b56c']]){
  land.beginPath();path.forEach(([x,y],i)=>(i?land.lineTo(x,y):land.moveTo(x,y)));land.lineWidth=width;land.strokeStyle=color;land.stroke();
}
land.setLineDash([4,16]);land.lineWidth=3;land.strokeStyle='#8f5c1d';land.stroke();land.setLineDash([]);
function drawBadge(bx,by,text){
  land.font='700 11px "Comic Neue","Comic Sans MS",cursive';
  const tw=land.measureText(text).width;
  land.fillStyle='#fff58a';land.strokeStyle='#16152a';land.lineWidth=2;
  land.beginPath();land.roundRect(bx-6,by-12,tw+12,20,5);land.fill();land.stroke();
  land.fillStyle='#16152a';land.fillText(text,bx,by+2);
}
drawBadge(16,64,'IN →');
drawBadge(880,170,'OUT →');
for(const [x,y,r] of [[51,397,25],[878,67,28],[904,393,33],[40,34,14],[405,425,18],[232,45,12]]){
  land.fillStyle='rgba(22,21,42,.3)';
  land.beginPath();land.ellipse(x+5,y+7,r*1.1,r*.65,0,0,Math.PI*2);land.fill();
  for(let i=0;i<5;i++){
    const angle=i*1.25;
    const px=x+Math.cos(angle)*r*.4;
    const py=y+Math.sin(angle)*r*.35;
    land.fillStyle=['#468729','#579f32','#6ab83b','#7fc74d','#579f32'][i];
    land.strokeStyle='#16152a';land.lineWidth=2;
    land.beginPath();land.arc(px,py,r*.65,0,Math.PI*2);land.fill();land.stroke();
  }
  land.fillStyle='#b7a4ce';
  land.beginPath();
  land.arc(x-r*.2,y-r*.1,3,0,Math.PI*2);
  land.arc(x+r*.3,y+r*.15,2.5,0,Math.PI*2);
  land.fill();
}
function drawTower(x,y,type,level,tx=x+1,ty=y,alpha=1) {
  ctx.save();ctx.globalAlpha=alpha;
  circle(x+2,y+5,21,'#172b3350');circle(x,y,20,'#293a3d','#233431');
  ctx.translate(x,y);
  if(type===0||type===4||type===5){
    const superMonkey=type===4;
    if(superMonkey){ctx.fillStyle='#c77694';ctx.beginPath();ctx.moveTo(-13,-10);ctx.lineTo(-24,22);ctx.lineTo(15,18);ctx.closePath();ctx.fill();}
    circle(0,0,16,superMonkey?'#6674c2':'#9e6c47','#65472f');
    circle(-13,-2,6,'#b88c61');circle(13,-2,6,'#b88c61');
    ctx.save();ctx.rotate(Math.atan2(ty-y,tx-x));
    ctx.fillStyle=superMonkey?'#ece2a3':'#c89761';ctx.fillRect(3,-5,24,10);
    ctx.fillStyle='#373f42';ctx.fillRect(19,-2,12,4);ctx.restore();
    circle(0,2,10,'#e1b480');
    if(type===5){ctx.fillStyle='#493f5d';ctx.fillRect(-14,-12,28,13);ctx.fillRect(-14,3,28,10);ctx.fillStyle='#bc7d99';ctx.fillRect(-14,-3,28,5);}circle(-4,-2,2,'#242b30');circle(4,-2,2,'#242b30');
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
    circle(readF(t+4),readF(t+8),engine.tower_range(selected),'#dbe5ff12','#dbe5ff60');
    circle(readF(t+4),readF(t+8),25,null,'#e2ef89');
  }
  for(let id=0;id<48;id++){
    const t=tower(id);if(readI(t))drawTower(readF(t+4),readF(t+8),readI(t+12),readI(t+16),readF(t+24)||readF(t+4)+1,readF(t+28)||readF(t+8));
  }
  for(let b=65536;b<engine.pool_end();b+=64){
    if(!readI(b))continue;
    const x=readF(b+8),y=readF(b+12),hp=readI(b+16),type=readI(b+20),flags=readI(b+32);
    const palette=['#e47e89','#6eaaca','#83bd79','#ebcf75','#de9ccb','#2b303a','#eceee5','#a782cf','#87939f','#e7e7d7','#f6af8e','#b97447'];
    ctx.save();ctx.translate(x,y);
    if(type>=12){
      const radius=[28,36,42,28,52][type-12],color=['#789eae','#bf697b','#6e9366','#53616d','#a16db6'][type-12];
      ctx.fillStyle='#192c3444';ctx.beginPath();ctx.ellipse(3,8,radius*1.3,radius*.75,0,0,7);ctx.fill();
      ctx.fillStyle=color;ctx.strokeStyle='#c2d7dc';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,radius*1.25,radius*.68,0,0,7);ctx.fill();ctx.stroke();
      ctx.fillStyle=type===14?'#293a35':'#c8e0df';ctx.fillRect(-radius*.65,-radius*.58,5,radius*1.16);ctx.fillRect(radius*.4,-radius*.58,5,radius*1.16);
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-radius,0);ctx.lineTo(-radius*1.65,-radius*.75);ctx.lineTo(-radius*1.65,radius*.75);ctx.closePath();ctx.fill();
      if(flags&1){ctx.strokeStyle='#1d3027';ctx.lineWidth=5;for(let n=-1;n<2;n++){ctx.beginPath();ctx.moveTo(n*15-8,-12);ctx.lineTo(n*15+8,12);ctx.stroke();}}
      if(flags&4){ctx.strokeStyle='#b78c58';ctx.lineWidth=5;for(const dx of [-.8,.8]){ctx.beginPath();ctx.moveTo(radius*dx,-radius*.5);ctx.lineTo(radius*dx,radius*.5);ctx.stroke();}}
      if(hp<engine.health(type,flags)*.6){ctx.strokeStyle='#253343';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,-15);ctx.lineTo(0,-6);ctx.lineTo(-5,0);ctx.lineTo(8,8);ctx.stroke();}
      ctx.fillStyle='#162c3c';ctx.fillRect(-19,-7,38,15);ctx.fillStyle='#f0f4d4';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(bloonNames[type],0,4);
      ctx.fillStyle='#20323c';ctx.fillRect(-24,radius*.82,48,4);ctx.fillStyle='#e2ef89';ctx.fillRect(-24,radius*.82,48*hp/engine.health(type,flags),4);
    }else{
      const fill=palette[type],r=type===11?15:(type===5||type===6)?10:12;
      ctx.fillStyle='#18352b40';ctx.beginPath();ctx.ellipse(3,8,r,r+2,0,0,7);ctx.fill();
      ctx.beginPath();
      if(flags&2){ctx.moveTo(0,16);ctx.bezierCurveTo(-29,-3,-10,-23,0,-10);ctx.bezierCurveTo(10,-23,29,-3,0,16);}
      else ctx.ellipse(0,0,r,r+3,0,0,7);
      ctx.fillStyle=fill;ctx.fill();ctx.save();ctx.clip();
      if(type===9){ctx.strokeStyle='#323c42';ctx.lineWidth=5;for(let n=-2;n<=2;n++){ctx.beginPath();ctx.moveTo(-18,n*10-10);ctx.lineTo(18,n*10+10);ctx.stroke();}}
      if(type===10){for(let n=0;n<5;n++){ctx.fillStyle=['#e47e89','#ebcf75','#83bd79','#6eaaca','#a782cf'][n];ctx.fillRect(-15,-16+n*7,30,7);}}
      if(flags&1){ctx.fillStyle='#264d39aa';for(let n=0;n<4;n++){ctx.beginPath();ctx.ellipse(-10+n*7,-9+n%2*14,8,4,.7,0,7);ctx.fill();}}
      ctx.restore();ctx.strokeStyle=type===8?'#c3cdd2':type===11?'#714735':'#293d3b88';ctx.lineWidth=2;ctx.stroke();
      if(flags&4){ctx.strokeStyle='#d3a06a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r,-5);ctx.lineTo(r,-5);ctx.moveTo(-r,5);ctx.lineTo(r,5);ctx.stroke();}
      ctx.fillStyle='#ffffff66';ctx.beginPath();ctx.ellipse(-4,-5,3,5,.3,0,7);ctx.fill();
      ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(0,14);ctx.lineTo(-3,18);ctx.lineTo(3,18);ctx.fill();
      if(type===11){ctx.strokeStyle='#e2b585';ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.moveTo(0,-14);ctx.lineTo(0,0);ctx.stroke();}
    }
    if(readI(b+24)>0)circle(0,0,18,null,'#ade9f3bb');
    if(readI(b+28)>0){ctx.strokeStyle='#fff4d6';ctx.lineWidth=2;for(let n=0;n<5;n++){ctx.save();ctx.rotate(n*1.257);ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(22,0);ctx.stroke();ctx.restore();}}
    ctx.restore();
  }
  for(let e=24576;e<30720;e+=24){
    const ttl=readI(e+16);if(ttl<=0)continue;
    const type=readI(e+20),x=readF(e),y=readF(e+4),tx=readF(e+8),ty=readF(e+12),p=1-ttl/12;
    ctx.save();ctx.globalAlpha=ttl/12;
    circle(x,y,Math.max(2,tx)*(0.5+p*0.5),type===2?'#f2c37d22':null,type===3?'#bce9ef':'#f4c682');
    ctx.restore();
  }
  for(let p=917504;p<engine.projectile_end();p+=96){
    if(readI(p)!==1)continue;
    const x=readF(p+4),y=readF(p+8),kind=readI(p+92),vx=readF(p+12),vy=readF(p+16);
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(vy,vx));
    if(kind===6||kind===10){circle(0,0,kind===6?8:5,'#77818d','#d4dce1');for(let n=0;n<4;n++){ctx.rotate(Math.PI/2);ctx.fillStyle='#d4dce1';ctx.fillRect(0,-1,kind===6?11:7,2);}}
    else if(kind===2)circle(0,0,5,'#29343e','#f6c783');
    else if(kind===5){ctx.rotate(readI(28)*.3);ctx.strokeStyle='#d6dfed';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(5,0);ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.stroke();}
    else {ctx.strokeStyle=kind===8?'#f48286':kind===9?'#b7a4ff':'#f4e6be';ctx.lineWidth=kind===9?4:2;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(4,0);ctx.stroke();}
    ctx.restore();
  }
  if(placing>=0&&hovering){
    const valid=engine.can_place(cursor.x,cursor.y)&&readI(0)>=engine.cost(placing);
    circle(cursor.x,cursor.y,engine.range(placing,0),valid?'rgba(184,255,122,.22)':'rgba(255,93,93,.25)',valid?'#5865f2':'#ff5d5d');
    circle(cursor.x,cursor.y,20,null,valid?'#16152a':'#ff5d5d');
    drawTower(cursor.x,cursor.y,placing,0,cursor.x+1,cursor.y,.8);
    const msg=valid?'CLICK TO BUILD':'CANNOT BUILD HERE';
    ctx.font='700 12px "Comic Neue","Comic Sans MS",cursive';
    ctx.textAlign='center';
    ctx.lineWidth=3;ctx.strokeStyle='#16152a';
    const textY=Math.max(18,cursor.y-32);
    ctx.strokeText(msg,cursor.x,textY);
    ctx.fillStyle=valid?'#fff58a':'#ff7a7a';
    ctx.fillText(msg,cursor.x,textY);
  }
  if(paused){
    ctx.fillStyle='rgba(22,21,42,.6)';ctx.fillRect(0,0,960,480);
    ctx.font='400 48px "Rubik Wet Paint","Comic Neue",cursive';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=6;ctx.strokeStyle='#16152a';
    ctx.strokeText('Ⅱ PAUSED',480,240);
    ctx.fillStyle='#fff58a';ctx.fillText('Ⅱ PAUSED',480,240);
  }
}
function frame(time){
  const delta=previous?Math.min(time-previous,100):0;previous=time;
  if(engine&&!paused&&!document.hidden){
    accumulator+=delta*speed;
    let steps=0;
    while(accumulator>=1000/60&&steps<24){engine.step();accumulator-=1000/60;steps++;}
    if(readI(16)>oldPops){chirp();oldPops=readI(16);}
    if(time-lastUi>=100){update();lastUi=time;}
  }
  draw();requestAnimationFrame(frame);
}
document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.type))));
$('cancel').addEventListener('click',cancel);
$('targeting').addEventListener('change',()=>{if(selected>=0&&engine.targeting(selected,Number($('targeting').value)))announce('Targeting '+targets[Number($('targeting').value)].toLowerCase()+'.');update();});
$('clear-field').addEventListener('click',()=>{if(engine?.clear_bloons()){paused=false;announce('Sandbox balloons cleared. Your towers remain.');update();}});
$('mode').addEventListener('change',()=>announce('Press Restart to start the selected mode. Your current defense stays until you confirm.'));
$('start').addEventListener('click',send);
$('pause').addEventListener('click',togglePause);
$('speed').addEventListener('click',()=>{speed=speed===1?2:speed===2?3:1;$('speed').textContent=speed+'× speed';});
function syncGameSound(){
  const btn=$('game-sound');
  if(!btn)return;
  btn.textContent=sound?'🔊 Sound on':'🔇 Sound off';
  btn.setAttribute('aria-pressed',String(sound));
}
syncGameSound();
$('game-sound')?.addEventListener('click',()=>{
  sound=!sound;
  try{window.slop?.store?.set('sound',sound);}catch{}
  syncGameSound();
  const slopBtn=$('sound');
  if(slopBtn){
    slopBtn.textContent=sound?'🔊 sound':'🔇 sound';
    slopBtn.setAttribute('aria-pressed',String(sound));
  }
  if(sound)chirp();
});
$('sound')?.addEventListener('click',()=>{
  setTimeout(()=>{
    sound=Boolean(window.slop?.store?.get('sound',false));
    syncGameSound();
  },50);
});
$('restart').addEventListener('click',()=>{
  if(!engine)return;
  if(restartArmed||(!readI(8)&&readI(0)===650)||readI(12)>=2){reset();return;}
  restartArmed=true;$('restart').textContent='Confirm restart';announce('Press Confirm restart to clear this defense.');
  clearTimeout(restartTimer);restartTimer=setTimeout(()=>{restartArmed=false;$('restart').textContent='Restart';},5000);
});
$('play-again').addEventListener('click',()=>reset());
document.querySelectorAll('[data-path]').forEach(button=>button.addEventListener('click',()=>{if(selected<0)return;const p=Number(button.dataset.path),type=readI(tower(selected)+12),next=catalog.towers[type].paths[p][engine.tier(selected,p)];if(engine.upgrade(selected,p))announce(next.name+' purchased. '+next.description);update();}));
$('sell').addEventListener('click',()=>{if(selected>=0){const value=engine.sell(selected);if(value){announce('Tower sold for '+money(value)+'.');selected=-1;}}update();});
function pointer(event){const r=canvas.getBoundingClientRect();cursor={x:(event.clientX-r.left)*960/r.width,y:(event.clientY-r.top)*480/r.height};hovering=true;}
canvas.addEventListener('pointermove',pointer);
canvas.addEventListener('pointerleave',()=>{hovering=false;});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();pointer(e);canvas.focus({preventScroll:true});activate();});
window.addEventListener('keydown',e=>{
  if(e.target?.closest?.('input,textarea,select,dialog,[contenteditable]')||document.querySelector('dialog[open]'))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key>='1'&&e.key<='6'&&engine){choose(Number(e.key)-1);return;}
  if(e.key==='Escape'){cancel();return;}
  if(e.code==='Space'&&!e.repeat&&!e.target?.matches?.('button,a')){e.preventDefault();if(engine){readI(12)===0?send():togglePause();}return;}
  if(e.target===canvas){
    const moves={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};
    if(moves[e.key]){e.preventDefault();cursor.x=Math.max(24,Math.min(936,cursor.x+moves[e.key][0]));cursor.y=Math.max(26,Math.min(454,cursor.y+moves[e.key][1]));hovering=true;}
    if(e.key==='Enter'){e.preventDefault();activate();}
  }
});
document.addEventListener('visibilitychange',()=>{accumulator=0;previous=0;if(document.hidden&&engine&&readI(12)===1&&!paused){paused=true;announce('Paused while the tab is hidden. Resume when ready.');update();}});
try {
  const catalogResponse=await fetch(new URL('./upgrades.json?v=3',import.meta.url));
  if(!catalogResponse.ok)throw new Error('Upgrade catalog HTTP '+catalogResponse.status);
  catalog=await catalogResponse.json();
  const response=await fetch(new URL('./engine.wasm?v=3',import.meta.url));
  if(!response.ok)throw new Error('Engine HTTP '+response.status);
  const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});
  engine=instance.exports;ints=new Int32Array(engine.memory.buffer);floats=new Float32Array(engine.memory.buffer);
  reset();requestAnimationFrame(frame);
}catch(error){announce('The WebAssembly engine could not load. Reload to try again. '+error.message);$('start').textContent='Engine unavailable';}
