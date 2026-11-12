/* Wahala — Drama Room enhancement. Progressive UI: original game rules remain authoritative. */
(function(){
'use strict';
const cast=[...(window.WAHALA_NEW_CASTS||[]), ...[
 [{id:'tobi',name:'Tobi',title:'The file guy',quote:'Omo, no be like that.'},{id:'ada',name:'Ada',title:'The organiser',quote:'Who carried my chat outside?!'},{id:'zainab',name:'Zainab',title:'Receipts keeper',quote:'I have actual timestamps.'},{id:'emeka',name:'Emeka',title:'The peacemaker',quote:'Can everybody calm down?'},{id:'feyi',name:'Feyi',title:'The comedian',quote:'I WAS JOKING! 😭'}],
 [{id:'bisi',name:'Bisi',title:'The treasurer',quote:'I paid the invoice they sent.'},{id:'sade',name:'Sade',title:'The bride’s cousin',quote:'Nobody should spoil this wedding.'},{id:'kunle',name:'Kunle',title:'The planner',quote:'The deadline was real, abeg!'},{id:'tunde',name:'Tunde',title:'The tech volunteer',quote:'Who had folder access?'},{id:'nene',name:'Nene',title:'The bride’s sister',quote:'₦2.4 million and no venue?!'}],
 [{id:'jide',name:'Jide',title:'Generator keeper',quote:'That machine was overheating.'},{id:'amara',name:'Amara',title:'Hostel rep',quote:'Nobody is evicting anybody.'},{id:'samu',name:'Samu',title:'Football fan',quote:'During Champions League?!'},{id:'peace',name:'Peace',title:'Night porter',quote:'I heard the alarm first.'},{id:'deji',name:'Deji',title:'The chairman',quote:'Somebody must explain!'}]
]];
const palettes=[['#a16b53','#ffc76b','#271b28'],['#e0a783','#8fe5c0','#261d2b'],['#82533d','#b8a4ef','#241b26'],['#f0b894','#f187a2','#332530'],['#c88a64','#84bbe6','#281e28']];
const icons=['👰','🕯️','🎙️','📱','💍','⚡'];
const scenes=[...(window.WAHALA_NEW_SCENES||[]), ...[
 ['THE GROUP CHAT','The group chat was normal. Until it wasn’t.','A private screenshot has escaped the chat. Five people have an explanation. Not all of them add up.'],
 ['THE WEDDING COMMITTEE','A wedding. A missing payment. Pure chaos.','₦2.4 million has gone somewhere it should not. Everybody has a reason to panic.'],
 ['THE HOSTEL','NEPA took light. The allegations stayed on.','The generator is off. The rumour mill is very much on.']
]];
const escaped=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=document.getElementById('app');
if(!app)return;
let decorateQueued=false,stagePeek=0,opening=null,openingStep=0,bypassBegin=false;
let lastManualPeek=Date.now();
function episodeIndex(){
 const selected=app.querySelector('.episode.selected');
 if(selected){const all=[...app.querySelectorAll('.episode')],i=all.indexOf(selected);if(i>=0)return i;}
 try{return Math.max(0,Math.min(cast.length-1,Number(JSON.parse(localStorage.getItem('wahala_play_state')||'{}').episode)||0))}catch{return 0;}
}
function drawing(i,extra=''){
 const [skin,shirt,hair]=palettes[i];
 const hairs=[
 '<path d="M44 81Q35 20 87 23Q142 24 136 79Q112 59 78 47L52 74Z" fill="'+hair+'"/>',
 '<path d="M40 79Q31 34 73 26Q108 21 139 51L138 81Q120 56 51 72Z" fill="'+hair+'"/><circle cx="135" cy="30" r="22" fill="'+hair+'"/>',
 '<path d="M44 78Q32 25 90 23Q148 25 137 80L124 55H55Z" fill="'+hair+'"/>',
 '<path d="M41 78Q35 38 83 27Q139 22 141 84Q125 55 53 62Z" fill="'+hair+'"/><path d="M50 84Q37 105 50 131M133 84Q145 104 134 131" stroke="'+hair+'" stroke-width="14" stroke-linecap="round" fill="none"/>',
 '<path d="M43 80Q36 30 86 27Q140 26 136 78L125 58Q88 64 55 53Z" fill="'+hair+'"/>'
 ];
 const accessory=[
 '<rect x="59" y="91" width="24" height="17" rx="7" fill="none" stroke="#2c2029" stroke-width="4"/><rect x="98" y="91" width="24" height="17" rx="7" fill="none" stroke="#2c2029" stroke-width="4"/><path d="M83 97H98" stroke="#2c2029" stroke-width="4"/>',
 '<circle cx="47" cy="123" r="7" fill="#ffe4a4"/><circle cx="134" cy="123" r="7" fill="#ffe4a4"/>',
 '<path d="M47 60Q92 30 133 60" stroke="#9c86bb" stroke-width="9" fill="none" stroke-linecap="round"/>',
 '<path d="M69 139Q90 150 111 138" stroke="#ffeed4" stroke-width="3" fill="none"/>',
 '<path d="M121 91Q141 88 142 109" stroke="#ffdf97" stroke-width="7" fill="none" stroke-linecap="round"/>'
 ];
 return '<span class="arc-drawing '+extra+'" aria-hidden="true"><svg viewBox="0 0 180 210" xmlns="http://www.w3.org/2000/svg"><ellipse cx="91" cy="203" rx="56" ry="7" fill="#09071066"/><path d="M24 203Q26 165 62 155L78 148H101L127 157Q159 167 160 203Z" fill="'+shirt+'" stroke="#261e28" stroke-width="5"/><path d="M62 155L90 180L120 154" stroke="#ffffff75" stroke-width="5" fill="none"/><rect x="77" y="132" width="28" height="29" rx="9" fill="'+skin+'"/><ellipse cx="91" cy="92" rx="47" ry="55" fill="'+skin+'" stroke="#291e2b" stroke-width="4"/><ellipse cx="44" cy="107" rx="9" ry="14" fill="'+skin+'"/><ellipse cx="136" cy="107" rx="9" ry="14" fill="'+skin+'"/>'+hairs[i]+'<path d="M64 86q11-5 19-2M100 84q10-4 19 2" stroke="'+hair+'" stroke-width="4" fill="none" stroke-linecap="round"/><g class="arc-eyes"><ellipse cx="73" cy="102" rx="4" ry="6" fill="#1a1020"/><ellipse cx="109" cy="102" rx="4" ry="6" fill="#1a1020"/></g><path d="M90 109l-3 14h8" stroke="#8d5749" stroke-width="3" fill="none"/><path d="M78 133q13 9 27 0" stroke="#633b35" stroke-width="3" fill="none" stroke-linecap="round"/>'+accessory[i]+'</svg></span>';
}
function stageMarkup(ep,kind='home'){
 const people=cast[ep];
 return '<div class="arc-stage '+kind+'" style="--accent:'+['#ffd28a','#8ad7fa','#c9a0ff','#f7c36a','#e5a6c0','#a0e1c2'][ep]+'"><div class="arc-grid"></div><div class="arc-lights"><i></i><i></i></div><div class="arc-stage-bar"><span class="arc-live-dot"></span> THE DRAMA ROOM <span class="arc-stage-place">· '+scenes[ep][0]+'</span></div><div class="arc-pop arc-pop-one">WHO CAUSE AM? 👀</div><div class="arc-pop arc-pop-two">HOT GIST 🔥</div><div class="arc-cast">'+people.map((p,i)=>'<button type="button" class="arc-character '+(i===stagePeek?'arc-active':'')+'" data-arcade="peek" data-index="'+i+'" aria-label="Meet '+escaped(p.name)+'" aria-pressed="'+(i===stagePeek)+'"><span class="arc-aura"></span>'+drawing(i,'arc-figure-'+i)+'<span class="arc-name">'+escaped(p.name)+'</span></button>').join('')+'</div><div class="arc-floor"></div>'+(kind==='home'?'<div class="arc-dialogue"><span class="arc-reaction">👀</span><div><small>MEET '+escaped(people[stagePeek].name.toUpperCase())+' · '+escaped(people[stagePeek].title)+'</small><strong>'+escaped(people[stagePeek].quote)+'</strong></div><em>TAP THE CAST TO<br>HEAR THE GIST ↗</em></div>':'')+'</div>';
}
function miniStage(ep,roleName){
 return '<div class="arc-mini-stage"><div class="arc-mini-header"><span><i class="arc-live-dot"></i> THE CAST IS WATCHING</span><strong>5 CHARACTERS · 1 MYSTERY</strong></div><div class="arc-mini-cast">'+cast[ep].map((p,i)=>'<div class="arc-mini-seat '+(roleName===p.name?'is-player':'')+'">'+drawing(i,'arc-mini-drawing')+'<small>'+escaped(p.name)+(roleName===p.name?' ★':'')+'</small></div>').join('')+'</div><div class="arc-mini-footer">🔥 GROUP CHAT HEAT <span class="arc-heat"><i></i></span> FOLLOW THE RECEIPTS</div></div>';
}
function decorate(){
 const wide=app.querySelector('.wide');if(!wide)return;
 const audioControls=app.querySelector('.topline-actions');
 if(audioControls&&window.WahalaAudio?.available&&!audioControls.querySelector('.audio-volume')){
  audioControls.insertAdjacentHTML('beforeend','<label class="audio-volume">VOL <input type="range" min="0" max="100" step="5" value="'+window.WahalaAudio.volumePercent+'" data-wahala-volume aria-label="Soundtrack and sound effects volume"><output>'+window.WahalaAudio.volumePercent+'%</output></label>');
 }
 const ep=episodeIndex();
 if(app.querySelector('.hero-card')){
  const hero=app.querySelector('.hero');hero.classList.add('arc-hero');
  const title=hero.querySelector('h1');if(title)title.innerHTML='NO GREE<br>FOR <span>ANYBODY.</span>';
  const sub=hero.querySelector('.hero-sub');if(sub)sub.innerHTML='Five characters. Five different stories. <strong style="color:white">One wahala you must settle.</strong> Follow the receipts, not the noise.';
  const heroButton=hero.querySelector('button[data-action="setup"]');if(heroButton)heroButton.innerHTML='▶ PLAY WAHALA NOW';
  const old=hero.querySelector('.hero-card');const container=document.createElement('div');container.className='arc-stage-holder';container.innerHTML=stageMarkup(ep,'home');old.replaceWith(container);
  if(!wide.querySelector('.arc-ticker')){const ticker=document.createElement('div');ticker.className='arc-ticker';ticker.innerHTML='<div>🔥 EVERYBODY KNOWS SOMETHING &nbsp; ✳ &nbsp; NOBODY KNOWS EVERYTHING &nbsp; 👀 &nbsp; FOLLOW THE RECEIPTS &nbsp; 🔥 EVERYBODY KNOWS SOMETHING &nbsp; ✳ &nbsp; NOBODY KNOWS EVERYTHING &nbsp; 👀 &nbsp; FOLLOW THE RECEIPTS &nbsp;</div>';wide.prepend(ticker);}
  app.querySelectorAll('.episode').forEach((card,i)=>{const emoji=document.createElement('span');emoji.className='arc-episode-icon';emoji.textContent=icons[i];card.prepend(emoji);card.style.setProperty('--accent',['#ffd28a','#8ad7fa','#c9a0ff','#f7c36a','#e5a6c0','#a0e1c2'][i])});
 }
 const dossier=app.querySelector('.persona-hero');
 if(dossier&&!dossier.querySelector('.arc-portrait')){
  const name=dossier.querySelector('h2')?.textContent?.trim()||'';
  const i=Math.max(0,cast[ep].findIndex(p=>p.name===name));
  const initial=dossier.querySelector('.big-initial');if(initial){const art=document.createElement('div');art.className='arc-portrait';art.innerHTML=drawing(i);initial.replaceWith(art);}
  dossier.classList.add('arc-dossier');
 }
 if(app.querySelector('.case-layout')&&app.querySelector('.action-grid')&&!app.querySelector('.arc-mini-stage')){
  const current=app.querySelector('.case-head .pill')?.textContent||'';
  const who=cast[ep].find(p=>current.includes(p.name))?.name;
  const progress=app.querySelector('.progress');if(progress)progress.insertAdjacentHTML('afterend',miniStage(ep,who));
  app.querySelectorAll('.action-card').forEach((b,i)=>{b.classList.add('arc-move');if(i<3)b.style.setProperty('--accent',['#ffd67d','#bbf0d1','#e2b8ff'][i])});
 }
 if(app.querySelector('.receipt')&&!app.querySelector('.arc-sealed')){
  const receipt=app.querySelector('.receipt');
  const wrapper=document.createElement('div');wrapper.className='arc-sealed';
  wrapper.innerHTML='<div class="arc-sealed-title"><span class="pill red">🚨 NEW EVIDENCE FOUND</span><h2>One hot receipt<br>just landed.</h2><p>Tap the confidential envelope to break the seal.</p></div><button class="arc-envelope" data-arcade="open-envelope" type="button" aria-label="Open your evidence"><span class="arc-fold"></span><b>✳</b><strong>CONFIDENTIAL · OPEN ME ↗</strong></button>';
  receipt.before(wrapper);receipt.classList.add('arc-paper');
  const actions=app.querySelector('.receipt-actions'),message=app.querySelector('.receipt-actions + .notebox');
  receipt.hidden=true;if(actions)actions.hidden=true;if(message)message.hidden=true;
 }
 if(app.querySelector('.twist-burst')&&!app.querySelector('.arc-siren')){
  app.querySelector('.twist-burst').classList.add('arc-alert');
  app.querySelector('.twist-burst').insertAdjacentHTML('afterbegin','<div class="arc-siren">🚨</div><span class="arc-alert-strip">BREAKING WAHALA · EVERYBODY DEY SHOUT</span>');
 }
 if(app.querySelector('#actor')&&!app.querySelector('.arc-ballot-cast')){
  const select=app.querySelector('#actor'),line=document.createElement('div');line.className='arc-ballot-cast';
  line.innerHTML=cast[ep].map((p,i)=>'<button type="button" data-arcade="suspect" data-id="'+escaped(p.id)+'" class="arc-ballot-person" aria-pressed="false">'+drawing(i)+'<strong>'+escaped(p.name)+'</strong></button>').join('');
  select.before(line);
  const headline=app.querySelector('.page-title');if(headline)headline.insertAdjacentHTML('beforebegin','<div class="arc-vote-banner">⚖️ EVERYBODY MUST PICK A SIDE.</div>');
 }
 if(app.querySelector('.final-score')&&!app.querySelector('.arc-victory')){
  const headline=app.querySelector('.page-title');if(headline)headline.insertAdjacentHTML('beforebegin','<div class="arc-victory">'+(headline.textContent.includes('caught')?'🎉 👑 🎉':'🤯 👀 📜')+'</div>');
  const score=app.querySelector('.score-summary')?.parentElement;
  if(score)score.insertAdjacentHTML('beforeend','<div class="after-share"><div><strong>Somebody will argue about this ending.</strong><p>Challenge your group. Share your score without spoiling the story.</p></div><button type="button" class="button outline small" data-arcade="share-result">↗ CHALLENGE A FRIEND</button></div>');
 }
}
function queueDecorate(){if(decorateQueued)return;decorateQueued=true;queueMicrotask(()=>{decorateQueued=false;decorate()})}
const observer=new MutationObserver(queueDecorate);observer.observe(app,{childList:true});
decorate();
function introduction(){
 openingStep=0;
 opening=document.createElement('div');opening.className='arc-opening';opening.setAttribute('role','dialog');opening.setAttribute('aria-modal','true');opening.setAttribute('aria-label','Case introduction');
 document.body.appendChild(opening);updateIntroduction();
}
function updateIntroduction(){
 if(!opening)return;
 const ep=episodeIndex(),n=openingStep;
 const parts=[
 ['EVERYBODY GET SECRET.','Welcome to the drama room.','Five suspects. Everybody has a story. Somebody is hiding something.'],
 ['THE WAHALA HAS STARTED.',scenes[ep][1],scenes[ep][2]],
 ['NOW NA YOUR TURN.','Can you settle this?', 'Three rounds. Secret identities. Dangerous receipts. One final verdict.']
 ];
 const p=parts[n];opening.innerHTML='<div class="arc-cutscene"><div class="arc-intro-progress">'+[0,1,2].map(i=>'<i class="'+(i<=n?'filled':'')+'"></i>').join('')+'</div><div class="small-top">'+escaped(p[0])+' · ACT '+(n+1)+'/3</div>'+stageMarkup(ep,'cinema')+'<div class="arc-scene-copy"><h2>'+escaped(p[1])+'</h2><p>'+escaped(p[2])+'</p></div><div class="arc-scene-actions"><button type="button" data-arcade="intro-next" class="button primary">'+(n===2?'🎭 REVEAL MY ROLE →':'CONTINUE THE STORY →')+'</button><button type="button" data-arcade="intro-skip" class="button secondary">SKIP INTRO</button><button type="button" data-arcade="intro-cancel" class="arc-cancel">BACK TO SETUP</button></div></div>';
 opening.querySelector('[data-arcade="intro-next"]')?.focus();
}
function leaveIntroduction(startGame){
 opening?.remove();opening=null;
 if(startGame){const button=app.querySelector('[data-action="begin"]');if(button){bypassBegin=true;button.click();bypassBegin=false}}
}
document.addEventListener('click',function(event){
 const target=event.target.closest('[data-arcade]');if(target){
  const action=target.dataset.arcade;
  if(action==='peek'){if(event.isTrusted){lastManualPeek=Date.now();window.WahalaAudio?.sfx?.('tap')}stagePeek=Number(target.dataset.index)||0;const ep=episodeIndex(),root=target.closest('.arc-stage');if(root){root.querySelectorAll('.arc-character').forEach(b=>{const active=b===target;b.classList.toggle('arc-active',active);b.setAttribute('aria-pressed',String(active))});const d=root.querySelector('.arc-dialogue');if(d)d.innerHTML='<span class="arc-reaction">👀</span><div><small>MEET '+escaped(cast[ep][stagePeek].name.toUpperCase())+' · '+escaped(cast[ep][stagePeek].title)+'</small><strong>'+escaped(cast[ep][stagePeek].quote)+'</strong></div><em>TAP THE CAST TO<br>HEAR THE GIST ↗</em>'}}
  if(action==='intro-next'){window.WahalaAudio?.sfx?.('tap');openingStep++;if(openingStep>2)leaveIntroduction(true);else updateIntroduction()}
  if(action==='intro-skip')leaveIntroduction(true);
  if(action==='intro-cancel')leaveIntroduction(false);
  if(action==='open-envelope'){window.WahalaAudio?.sfx?.('discovery');const wrapper=target.closest('.arc-sealed');wrapper?.remove();const receipt=app.querySelector('.receipt'),actions=app.querySelector('.receipt-actions'),note=app.querySelector('.receipt-actions + .notebox');if(receipt)receipt.hidden=false;if(actions)actions.hidden=false;if(note)note.hidden=false;receipt?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
  if(action==='share-result'){
   window.WahalaAudio?.sfx?.('success');
   const ep=episodeIndex(),saved=JSON.parse(localStorage.getItem('wahala_play_state')||'{}'),scores=saved.results?.personal?.map(p=>p.score)||[];
   const best=scores.length?Math.max(...scores):0;
   const title='WAHALA! — '+(scenes[ep]?.[1]||'The Drama Room');
   const message='I just played '+title+' and scored '+best+' points. This plot is actually WILD. Think you can solve it? Do not ask me for spoilers. 🎭🔥';
   const url='https://wahala-game-eight.vercel.app';
   if(navigator.share){navigator.share({title:'WAHALA!',text:message,url}).catch(()=>{})}
   else if(navigator.clipboard?.writeText){navigator.clipboard.writeText(message+' '+url).then(()=>{target.textContent='✓ LINK & CHALLENGE COPIED'}).catch(()=>{window.prompt('Copy your challenge',message+' '+url)})}
   else window.prompt('Copy your challenge',message+' '+url);
  }
  if(action==='suspect'){window.WahalaAudio?.sfx?.('seal');const sel=app.querySelector('#actor');if(sel){sel.value=target.dataset.id;sel.dispatchEvent(new Event('change',{bubbles:true}));app.querySelectorAll('.arc-ballot-person').forEach(b=>{let chosen=b===target;b.classList.toggle('chosen',chosen);b.setAttribute('aria-pressed',String(chosen))})}}
  return;
 }
 const gameButton=event.target.closest('[data-action="begin"]');
 if(gameButton&&!bypassBegin){event.preventDefault();event.stopImmediatePropagation();introduction()}
},true);
document.addEventListener('input',e=>{
 const el=e.target;if(!el||!el.matches?.('[data-wahala-volume]'))return;
 window.WahalaAudio?.volume?.(el.value);
 const out=el.parentElement?.querySelector('output');if(out)out.textContent=el.value+'%';
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opening){e.preventDefault();leaveIntroduction(false)}});
/* A gentle, automatically changing cast spotlight catches attention without sound. */
setInterval(()=>{
 if(opening||document.hidden||Date.now()-lastManualPeek<9000)return;
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const home=app.querySelector('.arc-stage.home');
 if(!home)return;
 const choices=[...home.querySelectorAll('[data-arcade="peek"]')];
 if(choices.length){const next=(stagePeek+1)%choices.length;choices[next].click()}
},4400);
})();
