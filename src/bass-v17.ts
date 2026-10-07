// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {chordAt,type Settings,type MusicEvent} from './music';
import {arrangementAt} from './arrangement';
import {hasEnding,nextHarmonyBoundary} from './harmony-v5';
import {pitchesOf} from './harmony';
import {keyPcs,tonicPc} from './harmony-v17';
import {fillBreak} from './fills-v17';
import {hash,random} from './seed';
import {gridTime} from './timing';

// v15's two-bar cells and kick-aware rhythm planning, with a second melodic voice on top:
// approach notes into chord changes, octave/inversion lines, pedals and counterpoint to the lead.
const CELLS=[[6,14,24],[8,22],[10,18,28],[6,20],[12,22,28],[8,18,26],[10,24],[6,18,26]];
const RELEASE=.07;
interface Slot {at:number;length:number;anchor:boolean;answer:boolean;gain:number;change:boolean;approach?:number}
const pc=(n:number)=>((n%12)+12)%12;
const rootAt=(s:Settings,at:number)=>{
  const root=pc(chordAt(s,at).root);
  return Array.from({length:19},(_,i)=>34+i).filter(n=>pc(n)===root).sort((a,b)=>Math.abs(a-40)-Math.abs(b-40))[0];
};
const overlap=(a:number,b:number,c:number,d:number)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
const transitionCost=(from:number,to:number)=>{
  const size=Math.abs(to-from);
  if(size===12)return .55; // an octave is idiomatic for bass; it keeps the same pitch class
  return size*.12+Math.max(0,size-7)*.7-(size>0&&size<=2?.06:0);
};

/** Bounded eight-bar planning after the melody is written. No playback history or mutable RNG. */
export function bassV17(s:Settings,start:number,backing:MusicEvent[],melody:MusicEvent[]):MusicEvent[]{
  const ambient=s.profile==='ambient',dnb=s.profile==='dub'&&s.groove==='dnb',seconds=240/s.bpm,evolution=s.evolution/100;
  const kicks=backing.filter(e=>e.voice==='kick'),snares=backing.filter(e=>e.voice==='snare'&&e.gain>.03);
  const sounding=(e:MusicEvent)=>e.at+e.length+(e.release??.14)/seconds;
  const lead=melody.filter(e=>e.role!=='neighbor');
  const activity=(at:number,length:number)=>melody.reduce((cost,e)=>cost+overlap(at,at+length,e.at,sounding(e))/length,0);
  const melodyAt=(t:number)=>lead.filter(e=>e.at<=t+1e-6&&sounding(e)>t).at(-1)?.notes[0];
  const phrase=Math.floor(start/8),chapter=Math.floor(start/(ambient?64:32)),form=arrangementAt(s,start);
  const family=(hash(`${s.seed}:bass15:${s.profile}`)+chapter)%CELLS.length;
  const key=keyPcs(s),tonic=tonicPc(s);
  // Chord changes inside (and at the end of) this window, including one-bar approach chords.
  const changes=Array.from({length:8},(_,i)=>start+i+1).filter(b=>chordAt(s,b).label!==chordAt(s,b-1).label);
  // Pedal: the tonic sustains under compatible chords (ambient spaces, some intros).
  const pedalNote=34+pc(tonic-34);
  const pedalWanted=!dnb&&(ambient?random(s.seed,`bass17-pedal:${Math.floor(start/16)}`)<.4
    :form.section==='intro'&&random(s.seed,`bass17-pedal:${chapter}`)<.5);
  const pedalFits=(at:number)=>pedalWanted&&!hasEnding(s,Math.floor(at))&&!(chordAt(s,at).tones??chordAt(s,at).notes).some(n=>[1,11].includes(pc(n-pedalNote)));
  const approachChance=s.energy<25||ambient?0:(dnb?.2:s.profile==='lofi'?.42:.32)+evolution*.3;
  const approachTones=(target:number)=>{
    // Chromatic below/above, diatonic step, and the fifth that "dominates" the target.
    const options:[number,number][]=[[target-1,.15],[target+1,.3],[target+7,.25],[target-5,.25]];
    for(const d of [-2,2,-1,1])if(key.includes(pc(target+d)))options.push([target+d,.1]);
    return options.filter(([n])=>n>=34&&n<=52);
  };

  const pulseSection=!ambient&&!dnb&&s.energy>=25&&form.section!=='open'
    &&hash(`${s.seed}:bass15-pulse:${chapter}`)%3===0;
  if(pulseSection){
    const times=kicks.map(k=>k.at+.125).filter(at=>at<start+8&&
      !kicks.some(k=>{const gap=Math.abs(k.at-at)*seconds;return gap>.012&&gap<.085;}))
      .sort((a,b)=>a-b).filter((at,i,all)=>!i||at-all[i-1]>=.1);
    // House-style octave answers on alternate pulses in some chapters.
    const octave=hash(`${s.seed}:bass17-octave:${chapter}`)%2===0;
    let harsh=0,held=0;
    const pulse=times.map((at,i):MusicEvent=>{
      const root=pc(chordAt(s,at).root);let note=34+pc(root-34);
      const end=Math.min(times[i+1]??start+8,nextHarmonyBoundary(s,at),start+8);
      let length=Math.max(.025,Math.min(.42,end-at-RELEASE/seconds));
      let role:MusicEvent['role']='anchor',resolvesTo:number|undefined;
      const change=changes.find(b=>b>at&&b<=(times[i+1]??start+8)+1e-6&&b-at<=.3);
      if(change!==undefined&&random(s.seed,`bass17-pulse-approach:${phrase}:${i}`)<approachChance){
        const target=34+pc(chordAt(s,change).root-34),m=melodyAt(at);
        const options=approachTones(target).filter(([n])=>m===undefined||![1,6,11].includes(pc(m-n))).sort((a,b)=>a[1]-b[1]);
        if(options.length){note=options[0][0];length=Math.min(length,.1);role='anticipation';resolvesTo=target;}
      }else if(octave&&i%2===1&&note+12<=55)note+=12;
      held+=length;
      for(const m of melody)if([1,6,11].includes(pc(m.notes[0]-note)))
        harsh+=overlap(at,at+length,m.at,sounding(m))*(m.role==='neighbor'?.3:1);
      return {at,length:+length.toFixed(8),voice:'bass',layer:'bass',notes:[note],
        gain:.14*(.97+random(s.seed,`bass15-pulse-gain:${phrase}:${i}`)*.06)*(role==='anticipation'?.85:1),pan:0,
        cutoff:3200-s.warmth*23,role,...(resolvesTo!==undefined?{resolvesTo}:{})};
    });
    if(pulse.length>=8&&harsh/held<=.12)return pulse;
  }
  const options:{events:MusicEvent[];cost:number}[]=[];
  const unique=new Set<string>();
  for(let candidate=0;candidate<8;candidate++){
    const slots:Slot[]=[];
    const add=(at:number,anchor:boolean,answer:boolean,change=false,approach?:number)=>{
      if(at>=start+8||slots.some(e=>Math.abs(e.at-at)<.10))return;
      slots.push({at,length:0,anchor,answer,change,approach,gain:ambient?.115:anchor?.166:approach!==undefined?.12:answer?.135:.145});
    };
    for(let bar=start;bar<start+8;bar++){
      const changed=bar===start||chordAt(s,bar).label!==chordAt(s,bar-1).label;
      if(changed||!ambient&&(bar-start)%2===0)add(bar,true,false,changed);
    }
    for(let stage=0;stage<4;stage++){
      const base=start+stage*2,section=arrangementAt(s,base),answer=stage%2===1;
      if(ambient){
        const replies=s.energy<15?0:1+(s.energy>65||hash(`${s.seed}:bass-space:${chapter}`)%3===0?1:0);
        const slot=(family+phrase)%4;
        const second=(slot+1+hash(`${s.seed}:bass-space-side:${chapter}`)%2)%4;
        if(section.section!=='open'&&replies>0&&(stage===slot||replies>1&&stage===second))
          add(base+[.25,.5,.75,1,1.25,1.5][(candidate+family+stage)%6],false,true);
        continue;
      }
      const cell=CELLS[(family+(answer?1:0)+(candidate>=4?2:0))%CELLS.length];
      const max=section.section==='open'?1:s.energy<30||section.section==='intro'?1:dnb?2:s.energy>70?3:2;
      for(const [i,step] of cell.slice(0,max).entries()){
        let local=step;
        if(answer&&i===Math.min(max,cell.length)-1)local=Math.min(30,step+((candidate+phrase)%3-1)*2);
        let at=gridTime(s,base+Math.floor(local/16),local%16);
        if(!answer&&candidate%2===0){
          const near=kicks.filter(k=>Math.abs(k.at-at)<=.13).sort((a,b)=>Math.abs(a.at-at)-Math.abs(b.at-at))[0];
          if(near)at=near.at;
        }
        if(answer&&candidate%4>=2&&activity(at,.20)>.35){
          const gaps=[at-.125,at+.125,at+.25].map(t=>gridTime(s,Math.floor(t),Math.round(t%1*16))).filter(t=>t>=base+.125&&t<base+1.875);
          at=gaps.sort((a,b)=>activity(a,.20)-activity(b,.20)||Math.abs(a-at)-Math.abs(b-at))[0]??at;
        }
        if(answer&&candidate%3===0&&activity(at,.2)>.5)continue;
        add(at,false,answer);
      }
    }
    // Approach notes lead into chord changes; when the lead rests, a two-note run answers it.
    if(approachChance>0)for(const change of changes){
      if(change<start+8&&pedalFits(change))continue; // a held pedal is not approached
      if(random(s.seed,`bass17-approach:${phrase}:${change-start}:${candidate>=4?1:0}`)>=approachChance)continue;
      const at=gridTime(s,change-1,14);
      for(let i=slots.length-1;i>=0;i--)if(!slots[i].anchor&&slots[i].at>at-.1&&slots[i].at<change)slots.splice(i,1);
      if(slots.some(e=>e.at>at-.1&&e.at<change))continue;
      const resting=!dnb&&activity(change-.5,.5)<.15&&random(s.seed,`bass17-run:${phrase}:${change-start}`)<.6;
      if(resting&&!slots.some(e=>e.at>change-.35&&e.at<at))add(gridTime(s,change-1,12),false,false,false,change);
      add(at,false,false,false,change);
    }
    slots.sort((a,b)=>a.at-b.at);
    let rhythmCost=0;
    for(let i=0;i<slots.length;i++){
      const e=slots[i],boundary=nextHarmonyBoundary(s,e.at);
      const next=Math.min(slots[i+1]?.at??start+8,e.approach!==undefined?e.approach:boundary,start+8);
      const nearKick=kicks.some(k=>Math.abs(k.at-e.at)*seconds<=.012);
      const open=arrangementAt(s,Math.floor(e.at)).section==='open';
      const wanted=e.approach!==undefined?.09:ambient?(e.anchor?(open?1.2:1.65+(family%4)*.10):.8+(family%3)*.2)
        :e.anchor?(dnb?.55+(family%3)*.08:.32+(family%4)*.035):e.answer?.16+(family%3)*.025:.24+(family%3)*.03;
      e.length=Math.max(.025,Math.min(wanted,next-e.at-RELEASE/seconds));
      if(!e.anchor){
        rhythmCost+=activity(e.at,e.length)*(e.answer?1.8:e.approach!==undefined?.4:.65);
        if(e.answer)rhythmCost-=.5;
        if(e.approach!==undefined)rhythmCost-=.35;
        if(nearKick)rhythmCost-=.55;
        if(snares.some(k=>Math.abs(k.at-e.at)*seconds<.025))rhythmCost+=.6;
      }
      for(const kick of kicks){
        const distance=Math.abs(kick.at-e.at)*seconds;
        if(distance>.012&&distance<.085)rhythmCost+=e.approach!==undefined?.8:2;
      }
      if(nearKick)e.gain*=.93;
    }
    const tones=slots.map((e):number[]=>{
      const chord=chordAt(s,e.at);
      if(e.approach!==undefined)return [...new Set(pitchesOf(chordAt(s,e.approach),34,52).filter(n=>pc(n-chordAt(s,e.approach!).root)===0)
        .flatMap(t=>approachTones(t).map(([n])=>n)))];
      // After an ensemble break, everyone lands together on the root.
      if(e.anchor&&Math.abs(e.at-start)<1e-6&&fillBreak(s,start-1)!==undefined)return pitchesOf(chord,34,52).filter(n=>pc(n-chord.root)===0);
      // An approached chord change lands on the root it was approaching.
      if(e.anchor&&slots.some(o=>o.approach!==undefined&&Math.abs(o.approach-e.at)<1e-6))return pitchesOf(chord,34,52).filter(n=>pc(n-chord.root)===0);
      if(e.anchor&&pedalFits(e.at))return [pedalNote,pedalNote+12].filter(n=>n<=52);
      // Inversions (the third) are allowed on held bars, giving stepwise lines between roots.
      if(e.anchor)return pitchesOf(chord,34,52).filter(n=>[0,7].includes(pc(n-chord.root))||!e.change&&[3,4].includes(pc(n-chord.root)));
      const stable=pitchesOf(chord,34,52).filter(n=>[0,3,4,7].includes(pc(n-chord.root)));
      return stable.length?stable:pitchesOf(chord,34,52);
    });
    const leadAt=slots.map(e=>melodyAt(e.at));
    const localCost=(note:number,i:number)=>{
      const e=slots[i],chord=chordAt(s,e.at),nextAnchor=slots.slice(i+1).find(n=>n.anchor)?.at??start+8,target=rootAt(s,nextAnchor);
      const interval=pc(note-chord.root);
      let cost=Math.abs(note-40)*.025;
      if(e.anchor&&interval!==0&&!(pedalFits(e.at)&&pc(note-pedalNote)===0))cost+=[3,4].includes(interval)?.55:.65;
      if(e.answer)cost+=Math.abs(note-(rootAt(s,e.at)+[0,7,-5,3][family%4]))*.055;
      if(e.approach!==undefined){
        const goal=chordAt(s,e.approach).root,d=pc(note-goal);
        cost+=d===11?.15:d===1?.3:d===7||d===5?.25:.1;
        if(!key.includes(pc(note))&&d!==11&&d!==1)cost+=.4;
      }
      for(const m of melody){
        const shared=overlap(e.at,e.at+e.length+RELEASE/seconds,m.at,sounding(m));
        if(!shared)continue;
        const iv=pc(m.notes[0]-note),harsh=[1,6,11].includes(iv)?3.5:[2,10].includes(iv)?.65:0;
        cost+=harsh*shared/Math.max(.125,e.length)*(m.role==='neighbor'?.3:1);
      }
      // Doubling the lead's third or seventh in the bass thins the chord.
      const m=leadAt[i];
      if(m!==undefined&&pc(m)===pc(note)&&interval!==0)cost+=.6;
      if(!e.anchor&&(slots[i+1]?.anchor||i===slots.length-1))cost+=Math.abs(note-target)*.17;
      return cost;
    };
    // Counterpoint with the lead: avoid parallel octaves/fifths, reward contrary motion at changes.
    const voiceCost=(i:number,previous:number,note:number)=>{
      const m1=leadAt[i-1],m2=leadAt[i];
      if(i===0||m1===undefined||m2===undefined||m1===m2||previous===note)return 0;
      const before=pc(m1-previous),after=pc(m2-note),bass=Math.sign(note-previous),lead=Math.sign(m2-m1);
      let cost=0;
      if((before===0||before===7)&&before===after&&bass===lead)cost+=1.2;
      if(slots[i].change&&bass!==lead)cost-=.2;
      return cost;
    };
    const costs=tones.map((notes,i)=>new Map(notes.map(note=>[note,localCost(note,i)])));
    const opening=rootAt(s,start),destination=rootAt(s,start+8);
    let states=[{cost:0,path:[] as number[]}];
    for(let i=0;i<slots.length;i++){
      const next=new Map<string,typeof states[number]>();
      for(const state of states)for(const note of tones[i]){
        const previous=state.path.at(-1)??opening;
        const repeated=state.path.length>=2&&state.path.at(-1)===note&&state.path.at(-2)===note;
        const cost=state.cost+costs[i].get(note)!+transitionCost(previous,note)+voiceCost(i,previous,note)+(repeated&&!slots[i].anchor?.35:0)
          +(slots[i].approach!==undefined&&slots[i-1]?.approach!==undefined&&previous===note?.9:0);
        const key=`${previous}:${note}`,old=next.get(key);
        if(!old||cost<old.cost)next.set(key,{cost,path:[...state.path,note]});
      }
      states=[...next.values()];
    }
    const best=states.map(state=>({...state,cost:state.cost+transitionCost(state.path.at(-1)!,destination)})).sort((a,b)=>a.cost-b.cost)[0];
    const events=slots.map((e,i):MusicEvent=>{
      const approach=e.approach!==undefined;
      return {at:e.at,length:+e.length.toFixed(8),voice:'bass',layer:'bass',notes:[best.path[i]],
        gain:e.gain*(.97+random(s.seed,`bass15-gain:${phrase}:${i}`)*.06),pan:0,cutoff:3200-s.warmth*23,
        role:approach?'anticipation':'anchor',...(approach?{resolvesTo:best.path[i+1]??destination}:{})};
    });
    const signature=JSON.stringify(events);
    if(!unique.has(signature)){unique.add(signature);options.push({events,cost:rhythmCost+best.cost*.7});}
  }
  options.sort((a,b)=>a.cost-b.cost);
  const close=options.filter(o=>o.cost<=options[0].cost+.7).slice(0,3);
  return close[Math.floor(random(s.seed,`bass17-choice:${phrase}`)*close.length)].events;
}
