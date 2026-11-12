/* WAHALA Original Sound System — generative composition, no recorded/sampled commercial music. */
(function(g){
'use strict';
const AC=g.AudioContext||g.webkitAudioContext;
let ctx=null,master=null,noise=null,enabled=false,phase='home',scheduler=null,nextTime=0,step=0,level=.30;
const duration=.153; // 98 BPM, four steps / beat
const themeMap={home:'lounge',setup:'lounge',handoff:'suspense',dossier:'suspense',turn:'investigation',receipt:'suspense',twist:'danger',vote:'danger',result:'release'};
const notes={
 lounge:[0,3,7,10,7,3,5,7,0,3,7,12,10,7,5,3],
 suspense:[0,null,3,null,7,null,6,null,0,null,8,null,7,null,3,null],
 investigation:[0,3,7,null,10,7,3,null,0,5,8,null,7,5,3,null],
 danger:[0,null,1,null,6,null,1,null,0,null,6,null,8,null,1,null],
 release:[0,4,7,12,11,7,4,7,0,7,9,12,11,9,7,4]
};
function create(){
 if(!AC)return false;
 if(ctx)return true;
 try {
  ctx=new AC({latencyHint:'interactive'});
  master=ctx.createGain(); master.gain.value=0.0001;master.connect(ctx.destination);
  noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.22),ctx.sampleRate);
  const data=noise.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  return true;
 }catch(e){ctx=null;return false}
}
function f(n){return 440*Math.pow(2,(n-69)/12)}
function tone(midi,start,length=.18,gain=.2,type='triangle'){
 if(!ctx||!master)return;
 let o=ctx.createOscillator(),a=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f(midi),start);
 a.gain.setValueAtTime(.0001,start);a.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+.012);
 a.gain.exponentialRampToValueAtTime(.0001,start+Math.max(.055,length));
 o.connect(a);a.connect(master);o.start(start);o.stop(start+Math.max(.08,length)+.02);
}
function kick(t,amount=.27){
 if(!ctx)return;const osc=ctx.createOscillator(),a=ctx.createGain();
 osc.type='sine';osc.frequency.setValueAtTime(165,t);osc.frequency.exponentialRampToValueAtTime(45,t+.15);
 a.gain.setValueAtTime(amount,t);a.gain.exponentialRampToValueAtTime(.0001,t+.18);
 osc.connect(a);a.connect(master);osc.start(t);osc.stop(t+.2);
}
function hat(t,amount=.075,decay=.055){
 if(!ctx||!noise)return;const b=ctx.createBufferSource(),high=ctx.createBiquadFilter(),a=ctx.createGain();
 b.buffer=noise;high.type='highpass';high.frequency.value=6200;
 a.gain.setValueAtTime(amount,t);a.gain.exponentialRampToValueAtTime(.0001,t+decay);
 b.connect(high);high.connect(a);a.connect(master);b.start(t);b.stop(t+Math.min(decay+.02,.2));
}
function rim(t,amount=.17){
 if(!ctx)return;hat(t,amount,.12);tone(78,t,.045,amount*.34,'square');
}
function phrase(t,index){
 const mode=themeMap[phase]||'lounge',seq=notes[mode],i=index%16;
 let root=48,bass=36;
 if(mode==='lounge'){root=60;bass=[36,36,44,43][Math.floor((index%64)/16)]}
 if(mode==='suspense'){root=57;bass=[33,33,38,32][Math.floor((index%64)/16)]}
 if(mode==='investigation'){root=60;bass=[36,41,43,34][Math.floor((index%64)/16)]}
 if(mode==='danger'){root=59;bass=[35,36,38,32][Math.floor((index%64)/16)]}
 if(mode==='release'){root=60;bass=[36,41,43,36][Math.floor((index%64)/16)]}
 if(i===0||i===8){kick(t,mode==='danger'?.42:.29);tone(bass,t,.42,.20,'sine')}
 if(mode!=='suspense'&&i===4||mode!=='suspense'&&i===12)rim(t,.1);
 if(i%2===0)hat(t,mode==='danger'?.1:.063,mode==='suspense'?.04:.07);
 if((i===3||i===11)&&mode!=='suspense')hat(t,.065,.035);
 if(i===0){ // original three-note harmonic pad
  const chord=mode==='danger'?[0,1,7]:mode==='suspense'?[0,3,7]:mode==='release'?[0,4,7]:[0,3,7];
  chord.forEach((v,j)=>tone(root-12+v,t,1.85,.027,'sine'));
 }
 if(seq[i]!=null)tone(root+seq[i],t,mode==='danger'?.11:mode==='suspense'?.18:.19,mode==='danger'?.14:.088,mode==='danger'?'sawtooth':'triangle');
}
function schedule(){
 if(!enabled||!ctx||ctx.state!=='running'||document.hidden)return;
 const horizon=ctx.currentTime+.22;
 if(nextTime<ctx.currentTime-.2){nextTime=ctx.currentTime+.04;step=0}
 let j=0;
 while(nextTime<horizon&&j++<12){phrase(nextTime,step);step++;nextTime+=duration}
}
function start(){
 if(!create())return false;
 enabled=true;
 master.gain.setTargetAtTime(level*.23,ctx.currentTime,.12);
 if(ctx.state==='suspended'){ctx.resume().catch(()=>{})}
 if(!scheduler){nextTime=ctx.currentTime+.06;step=0;scheduler=setInterval(schedule,85)}
 return true;
}
function stop(){
 enabled=false;
 if(scheduler){clearInterval(scheduler);scheduler=null}
 if(master&&ctx)master.gain.setTargetAtTime(.0001,ctx.currentTime,.07);
}
function sfx(which='tap'){
 if(!enabled||!create()||ctx.state!=='running')return;
 const t=ctx.currentTime+.01;
 if(which==='tap'){tone(79,t,.065,.16,'triangle');return}
 if(which==='success'){tone(76,t,.13,.15);tone(83,t+.09,.23,.16);return}
 if(which==='discovery'){tone(64,t,.1,.18);tone(69,t+.1,.13,.18);tone(76,t+.19,.34,.18);return}
 if(which==='seal'){tone(48,t,.13,.23,'sine');rim(t+.05,.15);return}
 if(which==='danger'||which==='twist'){
  kick(t,.43);tone(47,t,.6,.28,'sawtooth');tone(46,t+.13,.48,.14,'triangle');hat(t+.3,.16,.18);return;
 }
 if(which==='reveal'){tone(60,t,.15,.15);tone(64,t+.12,.2,.17);tone(67,t+.25,.2,.16);tone(72,t+.41,.6,.20);return}
}
function sync(newPhase,on){
 const changed=phase!==newPhase,wasEnabled=enabled;phase=newPhase||'home';
 if(!on){stop();return}
 if(!enabled)start();
 if(changed&&wasEnabled){
  const cue=phase==='twist'?'twist':phase==='receipt'?'discovery':phase==='vote'?'seal':phase==='result'?'reveal':null;
  if(cue)sfx(cue);
 }
}
function volume(amount){
 const v=Math.max(0,Math.min(100,Number(amount)));level=v/100;
 if(ctx&&master)master.gain.setTargetAtTime(enabled?level*.23:.0001,ctx.currentTime,.05);
 try{localStorage.setItem('wahala_volume',String(v))}catch{}
}
try{const v=Number(localStorage.getItem('wahala_volume'));if(Number.isFinite(v)&&v>=0&&v<=100&&localStorage.getItem('wahala_volume')!==null)level=v/100}catch{}
document.addEventListener('visibilitychange',()=>{
 if(!ctx)return;
 if(document.hidden){if(ctx.state==='running')ctx.suspend().catch(()=>{})}
 else if(enabled)ctx.resume().catch(()=>{});
});
document.addEventListener('pointerdown',()=>{if(enabled&&ctx?.state==='suspended')ctx.resume().catch(()=>{})},{passive:true});
g.WahalaAudio={sync,sfx,volume,get enabled(){return enabled},get volumePercent(){return Math.round(level*100)},get available(){return !!AC}};
})(window);