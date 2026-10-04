// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {chordAt,type Settings,type MusicEvent} from './music';
import {arrangementAt} from './arrangement';
import {nextHarmonyBoundary} from './harmony-v5';
import {pitchesOf} from './harmony';
import {hash,random} from './seed';
import {gridTime} from './timing';

// Two-bar gestures: the downbeat is supplied by the harmonic/metrical anchors.
const CELLS=[[6,14,24],[8,22],[10,18,28],[6,20],[12,22,28],[8,18,26],[10,24],[6,18,26]];
const RELEASE=.07;
interface Slot {at:number;length:number;anchor:boolean;answer:boolean;gain:number}
const pc=(n:number)=>((n%12)+12)%12;
const rootAt=(s:Settings,at:number)=>{
  const root=pc(chordAt(s,at).root);
  return Array.from({length:19},(_,i)=>34+i).filter(n=>pc(n)===root).sort((a,b)=>Math.abs(a-40)-Math.abs(b-40))[0];
};
const overlap=(a:number,b:number,c:number,d:number)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
const transitionCost=(from:number,to:number)=>Math.abs(to-from)*.12+Math.max(0,Math.abs(to-from)-7)*.7;

/** Bounded eight-bar planning. No playback history, look-behind recursion or mutable RNG. */
export function responsiveBass(s:Settings,start:number,backing:MusicEvent[],melody:MusicEvent[]):MusicEvent[]{
  const ambient=s.profile==='ambient',dnb=s.profile==='dub'&&s.groove==='dnb',seconds=240/s.bpm;
  const kicks=backing.filter(e=>e.voice==='kick'),snares=backing.filter(e=>e.voice==='snare'&&e.gain>.03);
  const sounding=(e:MusicEvent)=>e.at+e.length+(e.release??.14)/seconds;
  const activity=(at:number,length:number)=>melody.reduce((cost,e)=>cost+overlap(at,at+length,e.at,sounding(e))/length,0);
  const phrase=Math.floor(start/8),chapter=Math.floor(start/(ambient?64:32));
  // A seeded rotation retains a local identity, then moves to another cell family.
  const family=(hash(`${s.seed}:bass15:${s.profile}`)+chapter)%CELLS.length;
  // A separate, occasional identity: low roots enter an eighth note after the kick.
  // Held gates cross the following kick, so the existing dub duck envelope can breathe.
  const pulseSection=!ambient&&!dnb&&s.energy>=25&&arrangementAt(s,start).section!=='open'
    &&hash(`${s.seed}:bass15-pulse:${chapter}`)%3===0;
  if(pulseSection){
    const times=kicks.map(k=>k.at+.125).filter(at=>at<start+8&&
      !kicks.some(k=>{const gap=Math.abs(k.at-at)*seconds;return gap>.012&&gap<.085;}))
      .sort((a,b)=>a-b).filter((at,i,all)=>!i||at-all[i-1]>=.1);
    let harsh=0,held=0;
    const pulse=times.map((at,i):MusicEvent=>{
      const root=pc(chordAt(s,at).root),note=34+pc(root-34);
      const end=Math.min(times[i+1]??start+8,nextHarmonyBoundary(s,at),start+8);
      const length=Math.max(.025,Math.min(.42,end-at-RELEASE/seconds));
      held+=length;
      for(const m of melody)if([1,6,11].includes(pc(m.notes[0]-note)))
        harsh+=overlap(at,at+length,m.at,sounding(m))*(m.role==='neighbor'?.3:1);
      return {at,length:+length.toFixed(8),voice:'bass',layer:'bass',notes:[note],
        gain:.14*(.97+random(s.seed,`bass15-pulse-gain:${phrase}:${i}`)*.06),pan:0,
        cutoff:3200-s.warmth*23,role:'anchor'};
    });
    // A persistent root must yield when it rubs against a sustained lead too often.
    if(pulse.length>=8&&harsh/held<=.12)return pulse;
  }
  const options:{events:MusicEvent[];cost:number}[]=[];
  const unique=new Set<string>();
  for(let candidate=0;candidate<8;candidate++){
    const slots:Slot[]=[];
    const add=(at:number,anchor:boolean,answer:boolean)=>{
      if(at>=start+8||slots.some(e=>Math.abs(e.at-at)<.10))return;
      slots.push({at,length:0,anchor,answer,gain:ambient?.115:anchor?.166:answer?.135:.145});
    };
    for(let bar=start;bar<start+8;bar++){
      const changed=bar===start||chordAt(s,bar).label!==chordAt(s,bar-1).label;
      if(changed||!ambient&&(bar-start)%2===0)add(bar,true,false);
    }
    for(let stage=0;stage<4;stage++){
      const base=start+stage*2,form=arrangementAt(s,base),answer=stage%2===1;
      if(ambient){
        const replies=s.energy<15?0:1+(s.energy>65||hash(`${s.seed}:bass-space:${chapter}`)%3===0?1:0);
        const slot=(family+phrase)%4;
        const second=(slot+1+hash(`${s.seed}:bass-space-side:${chapter}`)%2)%4;
        if(form.section!=='open'&&replies>0&&(stage===slot||replies>1&&stage===second))
          add(base+[.25,.5,.75,1,1.25,1.5][(candidate+family+stage)%6],false,true);
        continue;
      }
      const cell=CELLS[(family+(answer?1:0)+(candidate>=4?2:0))%CELLS.length];
      const max=form.section==='open'?1:s.energy<30||form.section==='intro'?1:dnb?2:s.energy>70?3:2;
      for(const [i,step] of cell.slice(0,max).entries()){
        let local=step;
        // Keep the statement recognizable; vary the answer and turnaround in eighth notes.
        if(answer&&i===Math.min(max,cell.length)-1)local=Math.min(30,step+((candidate+phrase)%3-1)*2);
        let at=gridTime(s,base+Math.floor(local/16),local%16);
        if(!answer&&candidate%2===0){
          const near=kicks.filter(k=>Math.abs(k.at-at)<=.13).sort((a,b)=>Math.abs(a.at-at)-Math.abs(b.at-at))[0];
          if(near)at=near.at;
        }
        // A busy lead keeps its foreground; some candidates answer after its held note.
        if(answer&&candidate%4>=2&&activity(at,.20)>.35){
          const gaps=[at-.125,at+.125,at+.25].map(t=>gridTime(s,Math.floor(t),Math.round(t%1*16))).filter(t=>t>=base+.125&&t<base+1.875);
          at=gaps.sort((a,b)=>activity(a,.20)-activity(b,.20)||Math.abs(a-at)-Math.abs(b-at))[0]??at;
        }
        if(answer&&candidate%3===0&&activity(at,.2)>.5)continue;
        add(at,false,answer);
      }
    }
    slots.sort((a,b)=>a.at-b.at);
    let rhythmCost=0;
    for(let i=0;i<slots.length;i++){
      const e=slots[i],boundary=nextHarmonyBoundary(s,e.at);
      const next=Math.min(slots[i+1]?.at??start+8,boundary,start+8);
      const nearKick=kicks.some(k=>Math.abs(k.at-e.at)*seconds<=.012);
      const open=arrangementAt(s,Math.floor(e.at)).section==='open';
      const wanted=ambient?(e.anchor?(open?1.2:1.65+(family%4)*.10):.8+(family%3)*.2)
        :e.anchor?(dnb?.55+(family%3)*.08:.32+(family%4)*.035):e.answer?.16+(family%3)*.025:.24+(family%3)*.03;
      e.length=Math.max(.025,Math.min(wanted,next-e.at-RELEASE/seconds));
      if(!e.anchor){
        rhythmCost+=activity(e.at,e.length)*(e.answer?1.8:.65);
        if(e.answer)rhythmCost-=.5; // restrained replies are preferable to silence everywhere
        if(nearKick)rhythmCost-=.55;
        if(snares.some(k=>Math.abs(k.at-e.at)*seconds<.025))rhythmCost+=.6;
      }
      for(const kick of kicks){
        const distance=Math.abs(kick.at-e.at)*seconds;
        if(distance>.012&&distance<.085)rhythmCost+=2;
      }
      if(nearKick)e.gain*=.93;
    }
    const tones=slots.map(e=>{
      if(e.anchor){
        const chord=chordAt(s,e.at);
        return pitchesOf(chord,34,52).filter(n=>[0,7].includes(pc(n-chord.root)));
      }
      const chord=chordAt(s,e.at),stable=pitchesOf(chord,34,50).filter(n=>[0,3,4,7].includes(pc(n-chord.root)));
      return stable.length?stable:pitchesOf(chord,34,50);
    });
    const localCost=(note:number,i:number)=>{
      const e=slots[i],nextAnchor=slots.slice(i+1).find(n=>n.anchor)?.at??start+8,target=rootAt(s,nextAnchor);
      let cost=Math.abs(note-40)*.025;
      // Root support is preferred; a fifth can support a lead tone that clashes with the root.
      if(e.anchor&&pc(note-chordAt(s,e.at).root)!==0)cost+=.65;
      if(e.answer)cost+=Math.abs(note-(rootAt(s,e.at)+[0,7,-5,3][family%4]))*.055;
      for(const m of melody){
        const shared=overlap(e.at,e.at+e.length+RELEASE/seconds,m.at,sounding(m));
        if(!shared)continue;
        const interval=pc(m.notes[0]-note),harsh=[1,6,11].includes(interval)?3.5:[2,10].includes(interval)?.65:0;
        cost+=harsh*shared/Math.max(.125,e.length)*(m.role==='neighbor'?.3:1);
      }
      if(!e.anchor&&(slots[i+1]?.anchor||i===slots.length-1))cost+=Math.abs(note-target)*.17;
      return cost;
    };
    // Pitch overlap costs depend on slot/pitch, not on the path leading there.
    const costs=tones.map((notes,i)=>new Map(notes.map(note=>[note,localCost(note,i)])));
    const opening=rootAt(s,start),destination=rootAt(s,start+8);
    let states=[{cost:0,path:[] as number[]}];
    for(let i=0;i<slots.length;i++){
      const next=new Map<string,typeof states[number]>();
      for(const state of states)for(const note of tones[i]){
        const previous=state.path.at(-1)??opening;
        const repeated=state.path.length>=2&&state.path.at(-1)===note&&state.path.at(-2)===note;
        const cost=state.cost+costs[i].get(note)!+transitionCost(previous,note)+(repeated&&!slots[i].anchor?.35:0);
        const key=`${previous}:${note}`,old=next.get(key);
        if(!old||cost<old.cost)next.set(key,{cost,path:[...state.path,note]});
      }
      states=[...next.values()];
    }
    const best=states.map(state=>({...state,cost:state.cost+transitionCost(state.path.at(-1)!,destination)})).sort((a,b)=>a.cost-b.cost)[0];
    const events=slots.map((e,i):MusicEvent=>({at:e.at,length:+e.length.toFixed(8),voice:'bass',layer:'bass',notes:[best.path[i]],
      gain:e.gain*(.97+random(s.seed,`bass15-gain:${phrase}:${i}`)*.06),pan:0,cutoff:3200-s.warmth*23,role:'anchor'}));
    const signature=JSON.stringify(events);
    if(!unique.has(signature)){unique.add(signature);options.push({events,cost:rhythmCost+best.cost*.7});}
  }
  options.sort((a,b)=>a.cost-b.cost);
  const close=options.filter(o=>o.cost<=options[0].cost+.7).slice(0,3);
  return close[Math.floor(random(s.seed,`bass15-choice:${phrase}`)*close.length)].events;
}
