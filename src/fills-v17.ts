// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type {Settings,MusicEvent} from './music';
import {arrangementAt} from './arrangement';
import {keyPcs,tonicPc} from './harmony-v17';
import {hash,random} from './seed';
import {gridTime} from './timing';

// Generator v17 fills follow the direction of each section change:
// lift (intro → groove) and build (open → return) announce more energy,
// turn/drop (into the breakdown or the next intro) stay small or leave a gap,
// and an occasional soft pickup breathes in the middle of an eight-bar phrase.
export type FillKind='lift'|'build'|'turn'|'drop'|'pickup';
/** Tom level 0 is the highest drum, 3 the floor tom; all four are tuned to the key. */
interface Hit {step:number;voice:'snare'|'hat'|'rim'|'tom';accent:number;tom?:number;flam?:boolean;open?:boolean}
export interface FillPlanV17 {index:number;kind:FillKind;hits:readonly Hit[];break:boolean}
const h=(step:number,voice:Hit['voice'],accent:number,extra:Partial<Hit>={}):Hit=>({step,voice,accent,...extra});
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
const pc=(n:number)=>((n%12)+12)%12;

const LIFTS:readonly (readonly Hit[])[]=[
  [h(12,'snare',.55),h(13,'snare',.65),h(14,'snare',.8),h(15,'snare',1,{flam:true})],
  [h(12,'tom',.7,{tom:0}),h(13,'tom',.8,{tom:1}),h(14,'tom',.9,{tom:2}),h(15,'snare',1)],
  [h(10,'rim',.6),h(12,'rim',.7),h(14,'snare',.85),h(15,'snare',1,{flam:true})],
  [h(11,'snare',.5),h(12,'snare',.6),h(14,'tom',.85,{tom:1}),h(15,'tom',1,{tom:2})],
  [h(12,'snare',.6),h(13,'hat',.5),h(14,'snare',.8,{flam:true}),h(15,'tom',1,{tom:3})],
  [h(10,'snare',.65),h(11,'snare',.5),h(14,'snare',.9),h(15,'snare',.65)], // chopped edit
];
const TURNS:readonly (readonly Hit[])[]=[
  [h(14,'snare',.55),h(15,'snare',.8)],
  [h(13,'rim',.7),h(15,'rim',1)],
  [h(15,'tom',.85,{tom:3})],
  [h(14.5,'snare',.45),h(15,'snare',.7)],
];
const PICKUPS:readonly (readonly Hit[])[]=[
  [h(14.5,'snare',.35),h(15,'snare',.45)],
  [h(15,'rim',.5)],
  [h(14,'hat',.55,{open:true})],
];
const ramp=(steps:number[],voice:Hit['voice'],lo:number,hi:number)=>steps.map((step,i)=>h(step,voice,lo+(hi-lo)*i/Math.max(1,steps.length-1)));
/** Build-ups grow with energy: longer rolls, more strokes and a stronger crescendo. */
function build(recipe:number,density:number):Hit[]{
  if(recipe===0){
    const steps=density>.6?[4,6,8,10,12,13,14,15]:density>.3?[8,10,12,13,14,15]:[8,10,12,14,15];
    const roll=ramp(steps,'snare',.3,1);roll[roll.length-1].flam=true;return roll;
  }
  if(recipe===1)return [...ramp(density>.5?[8,10,12,13]:[8,10,12],'rim',.45,.65),h(14,'snare',.85),h(15,'snare',1,{flam:true})];
  if(recipe===2)return [...(density>.6?[h(8,'snare',.5),h(10,'snare',.55),h(11,'snare',.6)]:[h(8,'snare',.5),h(10,'snare',.6)]),
    h(12,'tom',.7,{tom:0}),h(13,'tom',.75,{tom:0}),h(14,'tom',.85,{tom:1}),h(15,'tom',1,{tom:2})];
  if(recipe===3)return [...ramp(Array.from({length:density>.5?7:5},(_,i)=>(density>.5?8:10)+i),'hat',.3,.9),h(15,'snare',1,{flam:true})];
  return ramp(Array.from({length:density>.5?8:4},(_,i)=>(density>.5?8:12)+i),'snare',.3,1); // D&B 16th roll
}
const BUILDS={lofi:[0,1,2],house:[0,2,3],dnb:[4,0,2]} as const;

const plans=new Map<string,FillPlanV17|null>();
export function fillPlanV17(s:Settings,bar:number):FillPlanV17|null{
  const key=[s.profile,s.seed,s.groove,s.energy,s.evolution,bar].join(':');
  if(plans.has(key))return plans.get(key)!;
  const plan=compute(s,bar);
  if(plans.size>=512)plans.delete(plans.keys().next().value!);
  plans.set(key,plan);
  return plan;
}
function compute(s:Settings,bar:number):FillPlanV17|null{
  if(s.profile==='ambient'||s.energy<20||bar<0)return null;
  const a=arrangementAt(s,bar),next=arrangementAt(s,bar+1),position=bar%8;
  const r=(label:string)=>random(s.seed,`fill17:${s.profile}:${s.groove}:${a.localBar}:${a.variant}:${label}`);
  const pick=(kind:FillKind,size:number)=>(hash(`${s.seed}:fill17:${kind}:${s.profile}:${s.groove}`)+Math.floor(a.localBar/8)+a.variant*3)%size;
  const density=clamp((s.energy-20)/60,0,1),energy=s.energy;
  if(position===3){
    if((a.section!=='groove'&&a.section!=='return')||a.beatless||r('pickup')>=.12+energy*.002)return null;
    const pool=s.profile==='dub'&&s.groove!=='dnb'?PICKUPS:PICKUPS.slice(0,2),index=pick('pickup',pool.length);
    return {index:30+index,kind:'pickup',hits:pool[index],break:false};
  }
  if(position!==7||a.beatless)return null;
  if(a.section==='open'&&next.section==='return'){
    if(r('build')>=.55+energy*.004)return null;
    const pool=BUILDS[s.groove==='dnb'?'dnb':s.profile==='lofi'?'lofi':'house'],recipe=pool[pick('build',pool.length)];
    return {index:10+recipe,kind:'build',hits:build(recipe,density),break:true};
  }
  if(a.section==='intro'&&next.section==='groove'){
    if(r('lift')>=.4+energy*.004)return null;
    const index=pick('lift',LIFTS.length),full=LIFTS[index];
    const hits=full.slice(full.length-clamp(Math.round(2+density*(full.length-2)+.25),2,full.length));
    return {index,kind:'lift',hits,break:density>.45&&r('break')<.5};
  }
  // Energy goes down (into the breakdown or the next form's intro): a small turn or a clean stop.
  if(r('turn')>=.3+energy*.003)return null;
  // Into the breakdown a clean stop suits best; into the next intro, a small turn.
  if(energy>=30&&r('drop')<(next.section==='open'?.6:.2))return {index:29,kind:'drop',hits:[],break:false};
  const index=pick('turn',TURNS.length);
  return {index:20+index,kind:'turn',hits:TURNS[index],break:false};
}

/** Start of the band's break (bass and comping rest while the drums fill), if any. */
export function fillBreak(s:Settings,bar:number):number|undefined{
  const plan=fillPlanV17(s,bar);
  if(!plan?.break||!plan.hits.length)return;
  return Math.min(...plan.hits.map(x=>gridTime(s,bar,x.step)))-(plan.hits.some(x=>x.flam)?.01:0);
}

export function addFillV17(s:Settings,bar:number,events:MusicEvent[]){
  const plan=fillPlanV17(s,bar);if(!plan)return;
  if(plan.kind==='drop'){
    // A stop: the kit falls silent for the last beat, and the next downbeat lands in the gap.
    const from=gridTime(s,bar,12);
    for(let i=events.length-1;i>=0;i--)if(events[i].layer==='rhythm'&&events[i].at>=from&&events[i].at<bar+1)events.splice(i,1);
    return;
  }
  const tonic=tonicPc(s),root=41+pc(tonic-41),third=keyPcs(s).includes(pc(tonic+4))?4:3;
  const toms=[root+7,root+third,root,root-5];
  const strokes:MusicEvent[]=[];
  for(const x of plan.hits){
    const at=gridTime(s,bar,x.step),tom=x.voice==='tom',hat=x.voice==='hat';
    const stroke=(time:number,accent:number):MusicEvent=>({at:time,length:tom?.045:.018,voice:x.voice,layer:'rhythm',
      notes:tom?[toms[x.tom??1]]:[],gain:(tom?.040:hat?.023:.026)*accent*(.75+s.energy*.0025),
      pan:tom?[-.22,-.08,.08,.22][x.tom??1]:hat?.16:0,cutoff:5000,fill:plan.index,velocity:clamp(.3+.65*accent,.2,1),
      ...(hat?{articulation:x.open?'open' as const:'closed' as const}:{})});
    // A flam is a soft grace stroke just ahead of the main one.
    if(x.flam)strokes.push(stroke(at-.01,x.accent*.35));
    strokes.push(stroke(at,x.accent));
  }
  const begin=Math.min(...strokes.map(e=>e.at)),big=plan.kind==='build'||plan.kind==='lift';
  for(let i=events.length-1;i>=0;i--){
    const e=events[i];
    if(e.layer!=='rhythm'||e.at<begin-1e-9||e.at>=bar+1)continue;
    const clash=strokes.some(x=>Math.abs(x.at-e.at)<.03);
    // Clear optional hats/ghosts; big fills also take over the kick and any coinciding backbeat.
    if(e.voice==='hat'||(e.voice==='snare'&&(e.gain<.03||clash))||(big&&e.voice==='kick')||clash&&e.voice===strokes.find(x=>Math.abs(x.at-e.at)<.03)!.voice)events.splice(i,1);
  }
  events.push(...strokes);
}
