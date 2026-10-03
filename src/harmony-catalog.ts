// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { ProfileId } from './music';
export const QUALITIES = {
  maj7: [0,4,7,11], m7: [0,3,7,10], '7sus4': [0,5,7,10],
  '6': [0,4,7,9], add9: [0,4,7,14], madd9: [0,3,7,14], '7': [0,4,7,10],
} as const;
export type Degree = readonly [number, keyof typeof QUALITIES];
export interface HarmonyRecipe { id: string; name: string; profile: ProfileId; mode: 'major'|'minor'; chords: readonly Degree[]; ending: Degree }
// Four functional roots per recipe; endings are authored approaches back to chord 1.
// All tones stay inside the recipe's major/natural-minor collection, including added ninths.
export const HARMONIES: readonly HarmonyRecipe[] = [
  {id:'w01',name:'Sunday turnaround',profile:'lofi',mode:'major',chords:[[0,'maj7'],[9,'m7'],[2,'m7'],[7,'7sus4']],ending:[7,'7']},
  {id:'w02',name:'Window light',profile:'lofi',mode:'major',chords:[[0,'6'],[4,'m7'],[5,'maj7'],[2,'m7']],ending:[7,'7']},
  {id:'w03',name:'Soft landing',profile:'lofi',mode:'major',chords:[[5,'maj7'],[4,'m7'],[2,'m7'],[0,'add9']],ending:[0,'6']},
  {id:'w04',name:'Paper lantern',profile:'lofi',mode:'major',chords:[[9,'m7'],[4,'m7'],[2,'m7'],[7,'7sus4']],ending:[7,'7']},
  {id:'w05',name:'Late morning',profile:'lofi',mode:'major',chords:[[0,'add9'],[5,'6'],[9,'m7'],[7,'7sus4']],ending:[7,'7']},
  {id:'w06',name:'Velvet minor',profile:'lofi',mode:'minor',chords:[[0,'madd9'],[5,'m7'],[10,'7sus4'],[3,'maj7']],ending:[7,'m7']},
  {id:'w07',name:'Falling leaves',profile:'lofi',mode:'minor',chords:[[0,'m7'],[10,'add9'],[8,'maj7'],[7,'m7']],ending:[5,'m7']},
  {id:'w08',name:'Amber room',profile:'lofi',mode:'minor',chords:[[8,'maj7'],[5,'m7'],[0,'madd9'],[3,'6']],ending:[10,'7sus4']},
  {id:'w09',name:'Quiet conversation',profile:'lofi',mode:'minor',chords:[[0,'m7'],[3,'maj7'],[10,'add9'],[5,'m7']],ending:[7,'m7']},
  {id:'w10',name:'Blue notebook',profile:'lofi',mode:'minor',chords:[[5,'m7'],[10,'7sus4'],[3,'maj7'],[8,'maj7']],ending:[0,'m7']},
  {id:'q01',name:'Open horizon',profile:'ambient',mode:'major',chords:[[0,'add9'],[5,'maj7'],[0,'6'],[2,'m7']],ending:[5,'6']},
  {id:'q02',name:'Still water',profile:'ambient',mode:'major',chords:[[0,'maj7'],[2,'m7'],[5,'add9'],[0,'6']],ending:[7,'7sus4']},
  {id:'q03',name:'Cloud layers',profile:'ambient',mode:'major',chords:[[5,'maj7'],[0,'add9'],[9,'m7'],[4,'m7']],ending:[0,'6']},
  {id:'q04',name:'Long afternoon',profile:'ambient',mode:'major',chords:[[0,'6'],[9,'m7'],[4,'m7'],[7,'7sus4']],ending:[2,'m7']},
  {id:'q05',name:'Floating shore',profile:'ambient',mode:'major',chords:[[2,'m7'],[5,'add9'],[0,'maj7'],[9,'m7']],ending:[7,'7sus4']},
  {id:'q06',name:'Distant glow',profile:'ambient',mode:'major',chords:[[0,'maj7'],[4,'m7'],[9,'m7'],[5,'6']],ending:[7,'7sus4']},
  {id:'q07',name:'Slow tide',profile:'ambient',mode:'major',chords:[[5,'add9'],[2,'m7'],[9,'m7'],[0,'maj7']],ending:[0,'6']},
  {id:'q08',name:'Morning mist',profile:'ambient',mode:'major',chords:[[0,'add9'],[7,'7sus4'],[2,'m7'],[5,'maj7']],ending:[5,'6']},
  {id:'q09',name:'Moonlit water',profile:'ambient',mode:'minor',chords:[[0,'madd9'],[8,'maj7'],[5,'m7'],[0,'m7']],ending:[10,'7sus4']},
  {id:'q10',name:'Night garden',profile:'ambient',mode:'minor',chords:[[3,'add9'],[8,'maj7'],[0,'m7'],[5,'m7']],ending:[10,'7sus4']},
  {id:'a01',name:'Midnight descent',profile:'dub',mode:'minor',chords:[[0,'m7'],[8,'maj7'],[10,'add9'],[7,'m7']],ending:[10,'7sus4']},
  {id:'a02',name:'Deep pulse',profile:'dub',mode:'minor',chords:[[0,'madd9'],[5,'m7'],[0,'m7'],[10,'7sus4']],ending:[7,'m7']},
  {id:'a03',name:'Neon steps',profile:'dub',mode:'minor',chords:[[0,'m7'],[3,'6'],[10,'add9'],[8,'maj7']],ending:[7,'m7']},
  {id:'a04',name:'Afterglow',profile:'dub',mode:'minor',chords:[[8,'maj7'],[3,'add9'],[7,'m7'],[0,'madd9']],ending:[10,'7sus4']},
  {id:'a05',name:'Night transit',profile:'dub',mode:'minor',chords:[[0,'m7'],[7,'m7'],[8,'add9'],[10,'7sus4']],ending:[5,'m7']},
  {id:'a06',name:'Undercurrent',profile:'dub',mode:'minor',chords:[[5,'m7'],[0,'madd9'],[8,'maj7'],[10,'add9']],ending:[0,'m7']},
  {id:'a07',name:'Low orbit',profile:'dub',mode:'minor',chords:[[0,'madd9'],[8,'6'],[3,'maj7'],[5,'m7']],ending:[10,'7sus4']},
  {id:'a08',name:'Side street',profile:'dub',mode:'minor',chords:[[0,'m7'],[10,'7sus4'],[5,'m7'],[8,'maj7']],ending:[7,'m7']},
  {id:'a09',name:'Warm signal',profile:'dub',mode:'major',chords:[[9,'m7'],[5,'maj7'],[2,'m7'],[7,'7sus4']],ending:[4,'m7']},
  {id:'a10',name:'First train',profile:'dub',mode:'major',chords:[[0,'6'],[2,'m7'],[4,'m7'],[9,'m7']],ending:[7,'7sus4']},
];
