/* WAHALA: THE AFTER-DARK FILES. All stories and characters are fictional. */
(function(g){
const P=(id,name,title,memory,ability,abilityBody,mission)=>({id,name,title,memory,ability,abilityBody,mission});
const C=(id,label)=>[id,label];
const L=(title,hint,type,body)=>({title,hint,type,body});
const episodes=[
{
 id:'double_bride',number:'01',title:'The Bride Was at Two Weddings',
 subtitle:'Lagos altar. Abeokuta livestream. Same bride. Same minute. Or so everybody thinks.',
 genre:'DOUBLE-LIFE THRILLER',time:'12–16 MIN',scene:'THE WEDDING WAR',accent:'#ffd28a',
 intro:'1:07 PM. Guests watch Zara stand at her Lagos wedding altar. On a phone, a verified livestream appears to show her marrying another man in Abeokuta at that exact minute. Then her number sends a voice note: “I am not the woman you are looking at.” The groom says Zara is a fraud. Neither camera tells the whole truth.',
 people:[
 P('zara','Zara','The missing bride','You found a registry entry connected to Dami shortly before the ceremony. You left quietly to verify it. Your cousin promised to hold the guests for ten minutes.','Recover your registry request','A certified record shows Dami previously registered a marriage. It does not establish whether that marriage was later dissolved.','Get the group to investigate the registry record without accusing an innocent stand-in.'),
 P('chika','Chika','The veiled cousin','You wore Zara’s veil and stood with your back to the guests when she left to check something urgent. You never walked down the aisle or made vows.','Check the dressing-room footage','The footage shows Chika borrowing Zara’s veil at 12:57 while Zara walks out with a folder.','Stop the group from blaming the cousin for a second wedding.'),
 P('dami','Dami','The groom','You knew Zara was asking questions about an old registry record. You had access to the streaming dashboard and made a frantic last-minute change.','Inspect your dashboard activity','A 12:54 account login from Dami’s tablet changed the stream source to an older promotional clip.','Avoid a majority of direct blame votes.'),
 P('bolu','Bolu','The videographer','Four days ago you filmed a staged wedding advertisement with a paid lookalike, matching dress and fake Abeokuta backdrop. Today your team was meant to stream the Lagos event.','Recover the studio call sheet','The supposed Abeokuta bride was a lookalike actor; that “other wedding” was shot in a Lagos studio four days ago.','Get the promotional-footage receipt published.'),
 P('halima','Halima','The event investigator','You noticed the Abeokuta video showed a wedding banner that was replaced last week. You also saw a girl under Zara’s veil refusing close-up photographs.','Compare the venue signage','The second wedding video shows an old venue sign removed four days ago. It cannot be a live video today.','Identify who switched the stream source.')
 ],
 causes:[C('staged_stream','An old staged wedding clip was deliberately broadcast as a live ceremony'),C('real_second_wedding','Zara secretly married another person simultaneously'),C('ai_clone','A synthetic deepfake manufactured a second bride')],
 resolutions:[C('halt_and_verify','Pause the ceremony, verify the footage and registry status privately, then correct the accusation'),C('publicly_accuse_zara','Accuse Zara of two marriages on the public livestream'),C('continue_ceremony','Continue the wedding without checking identities or records')],
 rounds:[
 [
 L('The streaming thumbnail','Why are both videos exactly the same length?','STREAM RECEIPT','Verified: the “LIVE ABEOKUTA” feed repeated the same six-second confetti movement twice. The footage is looping; the livestream label does not prove it was filmed now.'),
 L('The necklace everybody recognises','The second bride wears Zara’s distinctive necklace.','FALSE LEAD','Verified: the necklace appears in both scenes. However, the jewellery receipt lists two matching pieces hired for the promotional shoot. Similar appearance does not prove identity.'),
 L('The bride in the veil','Who can actually see her face in Lagos?','CAMERA FRAME','Verified: the Lagos altar camera never showed the veiled woman’s face. A veil is evidence of a costume, not a verified identity.')
 ],
 [
 L('Production dashboard login','Who selected what the guests watched?','DECISIVE STREAM LOG','Verified: at 12:54, Dami’s tablet account replaced the Lagos live camera with a four-day-old clip. The production log identifies the account, not a remote attacker.'),
 L('The wardrobe call sheet','Who was the woman filmed in Abeokuta?','STUDIO CONTRACT','Verified: Bolu hired a lookalike for a Lagos studio promo four days earlier. The fake Abeokuta banner, dress and duplicate necklace were listed props.'),
 L('That strange voice note','The bride says she is not the bride. Which one?','VOICE METADATA','Verified: the voice note was sent from Zara’s phone at 1:09 PM and states she is not the person at the Lagos altar. The note says nothing about being in Abeokuta.')
 ],
 [
 L('The dressing-room exit','Where was Zara when the vows began?','DECISIVE CCTV','Verified: Zara left the dressing room at 12:52 carrying a registry envelope. Chika borrowed the veil at 12:57 and stood at the altar only to delay proceedings.'),
 L('The registry receipt','Why did Zara disappear?','OFFICIAL RECORD','Verified: Zara requested confirmation of Dami’s earlier civil marriage registration. The record shows registration; it does not, by itself, prove the marriage remains legally active.'),
 L('The stream source fingerprint','Was the broadcast a hack or a switch?','SYSTEM AUDIT','Verified: Dami’s authenticated dashboard session selected the prerecorded promo file and enabled a false “LIVE” badge minutes before the scandal.')
 ],
 ],
 twist:{title:'Wait. The other bride is wearing Zara’s necklace.',body:'The crowd zooms in. Same dress. Same jewellery. Somebody shouts, “SHE HAS TWO HUSBANDS!” But the video keeps repeating one tiny movement in the background. Is this a wedding—or a loop?'},
 secondTwist:{title:'THE BRIDE AT THE LAGOS ALTAR ISN’T ZARA EITHER.',body:'A dressing-room still shows Chika borrowing the veil. So the supposed bride in Abeokuta is a lookalike, the bride in Lagos is a cousin, and the real Zara is nowhere on either screen. Somebody built a very convincing lie. Why?'},
 gists:[
 ['“She is in Lagos and Abeokuta at once? Is this a Nollywood audition?” — Chika','“Everybody should stop sharing unverified videos!” — Halima','“If she has two husbands, whose wedding am I even attending?” — Dami'],
 ['“Why is that confetti falling twice in the exact same way?” — Bolu','“So the live video has a replay button now?” — Halima','“A wedding is not a police interrogation!” — Chika'],
 ['“Find me the person who changed that stream.” — Zara','“The camera cannot lie, but an editor definitely can.” — Bolu','“If I see another voice note before we check the logs, I am leaving.” — Halima']
 ],
 truth:{
 actor:'dami',cause:'staged_stream',resolution:'halt_and_verify',
 summary:'Dami deliberately switched the public wedding livestream to an old studio promo to make Zara look unfaithful after she began checking his previously registered marriage. The so-called second bride was a hired lookalike filmed days earlier. Chika only wore Zara’s veil to buy time. Two screens showed two stand-ins. The real Zara was checking the registry.',
 chain:[['FOUR DAYS EARLIER','Bolu filmed a promotional wedding in a Lagos studio, using a lookalike, two matching necklaces and a fake Abeokuta backdrop.'],['12:52','Zara left the dressing room to verify a record related to Dami’s earlier civil marriage.'],['12:54','Dami’s authenticated streaming account selected the old promo video and labelled it “LIVE ABEOKUTA”.'],['12:57','Chika borrowed Zara’s veil and stood near the Lagos altar to delay the ceremony.'],['13:07','Guests saw two supposed Zaras on separate screens and assumed a double wedding.'],['13:09','Zara sent a voice note saying she was not the person under the veil.'],['AFTERMATH','The fabricated second wedding collapsed. The older marriage registration needed independent verification before any legal or public conclusion.']]
 }
},
{
 id:'dead_founder',number:'02',title:'The Dead Man Joined the Meeting',
 subtitle:'They announced his death at 9:14. At 10:05, he logged into the board meeting.',
 genre:'CORPORATE GHOST STORY',time:'12–16 MIN',scene:'BOARDROOM FROM HELL',accent:'#8ad7fa',
 intro:'At 9:14 AM, a fast-growing Lagos company announces that founder Malik died after a night-time crash. At 10:05, Malik appears on the company’s live emergency board call and says: “Nobody is selling my company.” The deputy CEO calls it a deepfake. The board receives a transfer order signed in Malik’s name. The dead man has entered the chat.',
 people:[
 P('malik','Malik','The declared-dead founder','You survived the crash, left the clinic, and lost your phone. You have not joined any video call today.','Check your actual location trail','Verified location data places Malik alive at a pharmacy during the disputed board call.','Keep a false death report from determining the company’s ownership.'),
 P('amaka','Amaka','The executive assistant','You had an old rehearsal recording of Malik. When an unverified death announcement triggered a takeover, you queued that clip to stop a board vote. You did not tell the board it was old.','Recover the media console log','The board “live camera” was a recorded rehearsal file loaded by Amaka at 9:59 AM.','Persuade the board to freeze all transfers and verify independently.'),
 P('kemi','Kemi','The deputy CEO','You drafted emergency takeover papers before the hospital confirmed anything. The transfer would put control under your investment vehicle.','Inspect the emergency transfer','The transfer draft names a company associated with Kemi. It was prepared before the death announcement.','Avoid being named as the main culprit in the fake meeting.'),
 P('segun','Segun','The video engineer','You filmed Malik rehearsing his annual meeting speech last Friday. The camera angle, coffee mug and background look just like today’s office.','Check the video render metadata','The footage streamed at 10:05 was created last Friday; its audio was not generated live.','Get the old-recording timestamp onto the public board.'),
 P('ife','Ife','The chief financial officer','The bank asked for two live signatories before any ownership change. Kemi told you the death notice removed that restriction.','Read the bank authorisation rule','An unverified death announcement does not satisfy the bank’s requirement for two live authorised signatories.','Keep the company assets from transferring on an unverified report.')
 ],
 causes:[C('old_video_on_call','A prerecorded founder video was deliberately presented as a live board appearance'),C('founder_ai_clone','A generative AI clone of Malik joined and spoke in real time'),C('malik_live_call','Malik personally joined the live meeting from a hidden location')],
 resolutions:[C('freeze_independent_check','Pause the transfer; independently verify Malik’s status and authenticate the video and signatures'),C('approve_transfer','Accept the death announcement and approve the deputy’s emergency transfer'),C('arrest_assistant','Publicly blame the assistant before examining the records')],
 rounds:[
 [
 L('The hospital wristband','The clinic says Malik died. How certain is that?','TRIAGE RECORD','Verified: a preliminary crash log marked a patient bearing Malik’s company visitor badge as deceased. The log does not contain a biometric identification.'),
 L('The live meeting photo','Everybody can see his face. Surely he is there?','VIDEO FRAME','Verified: Malik’s image, voice and office background are clear on the board video. A clear recording does not prove a real-time connection.'),
 L('The emergency takeover notice','Who stood to gain from the announcement?','BOARD MEMO','Verified: Kemi circulated a transfer proposal before the hospital confirmed Malik’s identity.')
 ],
 [
 L('The old coffee mug','Why is it broken in the same place?','VIDEO TIMECODE','Verified: Malik’s mug has the same chip, finger position and spilled coffee pattern in Friday’s rehearsal and today’s “live” call.'),
 L('The audiovisual fingerprint','Was the board call generated on the spot?','DECISIVE MEDIA LOG','Verified: the 10:05 video stream matches a recording exported last Friday, frame for frame. It was not a live camera or generative real-time avatar.'),
 L('The bank rule nobody read','Could the board even transfer shares today?','SIGNED POLICY','Verified: the transfer needed two current authorised signatories. A newsroom death announcement does not waive that condition.')
 ],
 [
 L('The pharmacy CCTV','Where was the real Malik at 10:05?','DECISIVE LOCATION RECORD','Verified: Malik, alive and injured, appeared on a pharmacy camera at 10:04. He was not using a laptop or on a meeting call.'),
 L('The assistant’s playback queue','Who put an old video on the call?','PLAYBACK AUDIT','Verified: Amaka loaded the archived rehearsal at 9:59 and routed it to the board-call video input at 10:05 to interrupt the vote.'),
 L('The hospital correction','Was the founder actually declared dead?','IDENTITY REVIEW','Verified: the deceased crash victim carried Malik’s lost visitor badge. The clinic’s preliminary identity entry was corrected after a second identification check.')
 ],
 ],
 twist:{title:'The hospital identifies the “dead” patient by Malik’s badge.',body:'An official-looking crash record circulates. It says the body carried Malik’s badge. Kemi announces that any video of him must be an AI fake. Yet nobody has seen a biometric identification.'},
 secondTwist:{title:'THE VIDEO IS OLD. THE FOUNDER IS ALIVE.',body:'The 10:05 meeting video matches a rehearsal filmed on Friday, down to a spilled coffee drop. At the same minute, pharmacy CCTV shows Malik alive. So someone staged a ghost appearance to stop a takeover. But who pressed play—and who wanted the transfer?'},
 gists:[
 ['“I just watched a dead man reject his own takeover. What kind of company is this?” — Ife','“That is a deepfake. We should proceed with the transfer.” — Kemi','“The call was crystal clear. That is not proof it was live.” — Segun'],
 ['“Why is his mug spilling the exact same way?” — Segun','“Freeze the paperwork until someone confirms the body.” — Ife','“The shareholders are already panicking.” — Amaka'],
 ['“If Malik is alive, why was the transfer drafted yesterday?” — Ife','“I admit the video was old. I needed to stop them voting.” — Amaka','“Please let us compare the signatory records before anybody signs anything else.” — Segun']
 ],
 truth:{
 actor:'amaka',cause:'old_video_on_call',resolution:'freeze_independent_check',
 summary:'Amaka made a prerecorded Malik appear live to interrupt a rushed takeover. Malik was alive: the clinic had mistakenly associated his lost company badge with another patient. Meanwhile Kemi had prepared an emergency transfer to an associated investment vehicle before confirmation. The “ghost” was a recording, the death was a mistake, and the takeover attempt was very real.',
 chain:[['LAST FRIDAY','Segun recorded Malik rehearsing his board presentation, with a distinctive chipped mug.'],['BEFORE 09:14','Kemi prepared a company-transfer document benefiting an associated entity.'],['09:14','A mistaken crash identification led to a premature death announcement.'],['09:59','Amaka queued the old rehearsal to delay the emergency board vote.'],['10:04','Pharmacy CCTV captured Malik alive, seeking treatment.'],['10:05','The prerecorded video appeared on the board call as if live.'],['AFTERMATH','Independent checks exposed the error and blocked any transfer without proper authorisation.']]
 }
},
{
 id:'five_confessions',number:'03',title:'One Voice Note. Five Confessions.',
 subtitle:'Everybody received a 37-second note. Each person heard a different criminal.',
 genre:'PSYCHOLOGICAL AUDIO MYSTERY',time:'12–16 MIN',scene:'THE VOICE NOTE FILES',accent:'#c9a0ff',
 intro:'At 2:17 AM, five committee members receive a WhatsApp voice note from the same admin account. Each message is 37 seconds long, with an identical-looking waveform. Yet every recipient hears a DIFFERENT person confessing to stealing ₦12 million from the charity fund. At sunrise, somebody has leaked all five confessions. A community has turned on itself.',
 people:[
 P('nosa','Nosa','The group administrator','You lent the event laptop to the sound producer to export donor thank-you videos. Your WhatsApp Web session was still signed in. You did not send the 2:17 notes.','Audit your linked devices','The event laptop retained the admin session and sent five separate files while Nosa’s own phone was offline.','Clear your account without blaming someone on the strength of a forwarded audio clip.'),
 P('teni','Teni','The sound producer','You were editing audio from the fundraiser on the event laptop. You made five different confession edits to bait a suspected leak of internal messages. You had no proof a donation had been stolen.','Inspect your audio project','Five separate 37-second exported files, each naming a different person, were created in Teni’s editing session.','Avoid a majority of blame votes.'),
 P('amaka','Amaka','The treasurer','The donor promised ₦12 million but said payment depended on a signed agreement. You never received the money. Your voice was one of the supposed confessions.','Check the bank statement','The account never received a ₦12m deposit from the donor. The supposed missing sum was a pledge, not transferred funds.','Get the fund-status receipt published to prevent false theft accusations.'),
 P('kayode','Kayode','The gossip blogger','Someone forwarded you a confession allegedly from the admin. You posted it without asking for the original audio file. Then four different confessions surfaced.','Compare your forwarded file','Kayode’s forwarded audio has a different content hash from the other four notes despite an identical-looking chat thumbnail.','Correct the public accusation before the fundraiser loses support.'),
 P('rita','Rita','The donor liaison','You handled the promised donation and knew it was conditional. A voice note using your name accused you of diverting money you had never received.','Read the donor’s signed pledge','The ₦12m was a conditional pledge awaiting paperwork; no transfer had been made.','Show that the missing-money story cannot be true.')
 ],
 causes:[C('five_edited_notes','Five different edited recordings were sent from a still-linked admin account'),C('single_real_confession','One authentic confession was sent and everyone simply misheard it'),C('phone_account_takeover','An outside hacker stole the admin’s phone account and broadcast an AI confession')],
 resolutions:[C('audit_correct_and_protect','Audit source files and donation records, retract the accusations and protect the affected people'),C('publish_every_clip','Post all five recordings publicly as proof of five thieves'),C('ban_admin_immediately','Expel the administrator without checking devices or files')],
 rounds:[
 [
 L('Five identical-looking bubbles','Does the chat screenshot prove the audio is one file?','WAVEFORM IMAGE','Verified: the five WhatsApp bubbles all show 0:37 and similar waveform thumbnails. A thumbnail is not a cryptographic file hash.'),
 L('The leaked confession montage','Everybody seems to confess. How many original files are there?','VIRAL REPOST','Verified: the montage contains five distinct accusations, each naming a different person. It does not establish which, if any, is authentic.'),
 L('The admin phone’s last connection','Was Nosa online at 2:17?','PHONE RECORD','Verified: Nosa’s phone last connected hours earlier. A linked desktop session could still send messages.')
 ],
 [
 L('The attachment hash test','Were the clips actually identical?','DECISIVE FILE HASH','Verified: all five attachments have different hashes even though each runs for 37 seconds. They are different audio files, not one recording heard five ways.'),
 L('The laptop access log','Who had the sending device?','DEVICE RECEIPT','Verified: Nosa’s WhatsApp Web session stayed signed in on the fundraiser laptop, which Teni was using to export audio.'),
 L('The public accusation','Did the screenshot preserve source evidence?','FORWARD TRAIL','Verified: Kayode shared only a forwarded copy without the original attachment metadata. His repost amplified suspicion, not proof.')
 ],
 [
 L('The original editing timeline','Who made the five versions?','DECISIVE AUDIO PROJECT','Verified: Teni’s editing project contains five separately exported 37-second confession edits, each with a different named speaker.'),
 L('The actual charity account','Was ₦12m ever stolen?','BANK RECORD','Verified: no ₦12m was deposited into the fundraiser account. The donor had pledged it conditionally, pending signed paperwork.'),
 L('The donor agreement','Did the fundraiser have the money?','PLEDGE AGREEMENT','Verified: Rita’s signed donor agreement makes the ₦12m conditional. The full amount was never received, so it could not have disappeared from that account.')
 ],
 ],
 twist:{title:'THE FIVE VOICE NOTES ARE NOT THE SAME FILE.',body:'An audio hash check gives five different results, even though every forwarded bubble shows the same duration and near-identical waveform. Somebody deliberately made these recordings look like one note. That is not how an authentic confession works.'},
 secondTwist:{title:'THE ₦12 MILLION WAS NEVER IN THE ACCOUNT.',body:'The bank history has no ₦12m deposit. The donor’s signed agreement says it was a conditional pledge. No one stole those funds from that account—so why were five people made to confess to a theft that never happened?'},
 gists:[
 ['“If all of us confess, who is the actual thief? Everybody should return their own ₦12m.” — Kayode','“Please stop forwarding me my own confession. I never recorded it.” — Rita','“A voice note is not a bank statement.” — Amaka'],
 ['“Same 37 seconds, five different files. Who is editing reality?” — Nosa','“I said somebody leaked confidential messages. I did not say those recordings were authentic.” — Teni','“Kayode, remove that post before somebody sues everybody.” — Rita'],
 ['“A missing donation that never entered the account. Brilliant detective work, everyone.” — Amaka','“Why did you export five confession files, Teni?” — Nosa','“I was trying to catch a leaker. I went too far.” — Teni']
 ],
 truth:{
 actor:'teni',cause:'five_edited_notes',resolution:'audit_correct_and_protect',
 summary:'Teni created five different confession edits, each exactly 37 seconds long, and used Nosa’s still-linked WhatsApp Web session to send them separately. The identical-looking chat bubbles tricked recipients into thinking the audio was the same. Kayode spread an unverified clip. The explosive final fact: the ₦12 million was a conditional donation that had not arrived. There was no demonstrated theft of those funds.',
 chain:[['BEFORE THE EVENT','The donor promised ₦12m subject to signed conditions. The funds were not transferred.'],['EVENING','Nosa left his admin web session open on the production laptop.'],['01:48','Teni exported five different confession edits, each with the same duration but different names.'],['02:17','Five recordings were sent from the still-linked admin session, one to each recipient.'],['MORNING','Kayode circulated a copy without verifying its source.'],['AFTER AUDIT','The editing project, attachment hashes and donor agreement established the actual chain.']]
 }
}
];
for(const [i,e] of episodes.entries()){
 if(e.people.length!==5||e.rounds.length!==3||e.rounds.some(r=>r.length!==3)||e.gists.length!==3||e.chain||!e.truth||!e.secondTwist)throw Error('Bad episode '+i);
 if(!e.people.find(p=>p.id===e.truth.actor)||!e.causes.find(c=>c[0]===e.truth.cause)||!e.resolutions.find(c=>c[0]===e.truth.resolution))throw Error('Invalid solution '+e.id);
 for(const round of e.rounds)for(const lead of round)if(!lead.body.startsWith('Verified:'))throw Error('Unverified label '+e.id);
}
g.WAHALA_NEW_EPISODES=episodes;
g.WAHALA_NEW_CASTS=episodes.map(e=>e.people.map(p=>({id:p.id,name:p.name,title:p.title,quote:e.gists[0].find(t=>t.endsWith(' — '+p.name))?.split(' — ')[0] || 'Everybody has a secret.'})));
g.WAHALA_NEW_SCENES=episodes.map(e=>[e.scene,e.title,e.intro]);
})(window);
