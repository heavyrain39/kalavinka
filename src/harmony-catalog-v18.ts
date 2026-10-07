// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
// Generator v18 progression catalogue: jazz/soul chord colours, variable chord lengths
// and a bank per mood (lo-fi, ambient, deep house, liquid D&B). Chord progressions are
// common musical vocabulary; nicknames describe the idiom, and no melody is borrowed.

/** Intervals above the root. The comping drops the root (and then the fifth) of richer chords. */
export const QUALITIES_V18 = {
  maj7: [0,4,7,11], maj9: [0,4,7,11,14], '6': [0,4,7,9], '6/9': [0,4,7,9,14], add9: [0,4,7,14], 'maj7#11': [0,4,7,11,18],
  m7: [0,3,7,10], m9: [0,3,7,10,14], m11: [0,3,7,10,14,17], m6: [0,3,7,9], madd9: [0,3,7,14], 'm6/9': [0,3,7,9,14],
  m7b5: [0,3,6,10], dim7: [0,3,6,9],
  '7': [0,4,7,10], '9': [0,4,7,10,14], '13': [0,4,7,10,14,21], '7b9': [0,4,7,10,13], '7#9': [0,4,7,10,15], '9#11': [0,4,7,10,14,18],
  '7sus4': [0,5,7,10], '9sus4': [0,5,7,10,14],
} as const;
export type QualityV18 = keyof typeof QUALITIES_V18;
export const LABELS_V18: Record<QualityV18, string> = {
  maj7: 'maj7', maj9: 'maj9', '6': '6', '6/9': '6/9', add9: 'add9', 'maj7#11': 'maj7♯11',
  m7: 'm7', m9: 'm9', m11: 'm11', m6: 'm6', madd9: 'madd9', 'm6/9': 'm6/9', m7b5: 'm7♭5', dim7: '°7',
  '7': '7', '9': '9', '13': '13', '7b9': '7♭9', '7#9': '7♯9', '9#11': '9♯11', '7sus4': '7sus4', '9sus4': '9sus4',
};
export type ModeV18 = 'major' | 'minor' | 'dorian' | 'lydian';
export const MODES_V18: Record<ModeV18, readonly number[]> = {
  major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10], dorian: [0,2,3,5,7,9,10], lydian: [0,2,4,6,7,9,11],
};
export type BankV18 = 'lofi' | 'ambient' | 'house' | 'dnb';
/** [semitones above the tonic, quality, length in units]. One unit is a bar (two bars in ambient). */
export type StepV18 = readonly [number, QualityV18, number];
/** `since`: the first generator version that may pick it, so added progressions never change older songs. */
export interface ProgressionV18 { id: string; name: string; bank: BankV18; mode: ModeV18; weight: number; chords: readonly StepV18[]; since?: number }

const p = (id: string, name: string, bank: BankV18, mode: ModeV18, weight: number, chords: StepV18[], since?: number): ProgressionV18 => ({ id, name, bank, mode, weight, chords, ...(since ? { since } : {}) });
export const PROGRESSIONS_V18: readonly ProgressionV18[] = [
  // Lo-fi / neo-soul: ii–V–I, secondary dominants, tritone and backdoor resolutions, cycles of fifths.
  p('l01','Two of us','lofi','major',2,[[5,'maj9',2],[4,'7',2],[9,'m9',2],[7,'m9',1],[0,'9',1]]),
  p('l02','Royal road','lofi','major',2,[[5,'maj9',2],[7,'13',2],[4,'m7',2],[9,'m9',2]]),
  p('l03','Station lights','lofi','major',1,[[5,'maj9',2],[4,'7',2],[9,'m9',2],[0,'9',2]]),
  p('l04','Rhythm turnaround','lofi','major',2,[[0,'maj9',2],[9,'7',2],[2,'m9',2],[7,'13',2]]),
  p('l05','Neo-soul two-five','lofi','major',2,[[2,'m9',2],[7,'13',2],[0,'maj9',4]]),
  p('l06','Tritone glide','lofi','major',1,[[2,'m9',2],[1,'9#11',2],[0,'maj9',2],[9,'m9',2]]),
  p('l07','Backdoor home','lofi','major',2,[[0,'maj9',2],[5,'maj7',2],[5,'m9',2],[10,'9',2]]),
  p('l08','Autumn cycle','lofi','major',2,[[2,'m9',2],[7,'13',2],[0,'maj9',2],[5,'maj7',2],[11,'m7b5',2],[4,'7b9',2],[9,'m9',4]]),
  p('l09','Moon cycle','lofi','major',1,[[9,'m9',2],[2,'m9',2],[7,'13',2],[0,'maj9',2],[5,'maj7',2],[11,'m7b5',2],[4,'7b9',4]]),
  p('l10','Money, softened','lofi','major',2,[[0,'maj9',2],[7,'9sus4',2],[9,'m9',2],[5,'maj9',2]]),
  p('l11','Money, wistful','lofi','major',2,[[9,'m9',2],[5,'maj9',2],[0,'6/9',2],[7,'9sus4',2]]),
  p('l12','Canon walk','lofi','major',1,[[0,'maj9',1],[7,'9sus4',1],[9,'m9',1],[4,'m7',1],[5,'maj7',1],[0,'6/9',1],[2,'m9',1],[7,'13',1]]),
  p('l13','Lady in flight','lofi','major',1,[[0,'maj7',2],[5,'m9',1],[10,'9',1],[0,'maj9',2],[10,'m7',1],[3,'9',1],[8,'maj9',4],[2,'m7',1],[7,'7',1],[3,'maj7',1],[1,'maj7',1]]),
  p('l14','Three-six-two-five','lofi','major',2,[[4,'m7',2],[9,'7b9',2],[2,'m9',2],[7,'13',2]]),
  p('l15','Sunday turnaround','lofi','major',2,[[0,'maj9',2],[9,'m9',2],[2,'m9',2],[7,'13',2]]),
  p('l16','Window light','lofi','major',2,[[0,'6/9',2],[4,'m7',2],[5,'maj9',2],[2,'m9',2]]),
  p('l17','Late morning','lofi','major',2,[[0,'add9',2],[5,'6/9',2],[9,'m7',2],[7,'9sus4',2]]),
  p('l18','Paper lantern','lofi','major',2,[[9,'m9',2],[4,'m7',2],[2,'m9',2],[7,'7sus4',1],[7,'7b9',1]]),
  p('l19','Minor two-five','lofi','minor',2,[[2,'m7b5',2],[7,'7b9',2],[0,'m9',4]]),
  p('l20','Velvet minor','lofi','minor',2,[[0,'m9',2],[5,'m9',2],[10,'9',2],[3,'maj9',2]]),
  p('l21','Falling leaves','lofi','minor',2,[[5,'m9',2],[10,'9',2],[3,'maj9',2],[8,'maj7',2],[2,'m7b5',2],[7,'7b9',2],[0,'m9',4]]),
  p('l22','Dorian drift','lofi','dorian',2,[[0,'m9',2],[5,'9',2],[3,'maj9',2],[2,'m7',1],[7,'7#9',1]]),
  p('l23','Soul descent','lofi','minor',2,[[0,'m9',2],[10,'add9',2],[8,'maj9',2],[7,'7b9',2]]),
  p('l24','Amber room','lofi','minor',1,[[8,'maj9',2],[5,'m9',2],[0,'m11',2],[3,'6/9',2]]),
  p('l25','Quiet conversation','lofi','minor',1,[[0,'m11',2],[3,'maj9',2],[10,'add9',2],[5,'m9',2]]),
  p('l26','Blue notebook','lofi','minor',1,[[5,'m9',2],[10,'13',2],[3,'maj9',2],[8,'maj7#11',2]]),
  // v19: i – V – vii°7 – III – ♭VI7, after Hooktheory's analysis of "Voice of No Return" (NieR:Automata).
  // The harmonic-minor dominant and diminished leading-tone chord, then a dominant on ♭VI that falls home.
  p('l27','Machine lament','lofi','minor',2,[[0,'m9',2],[7,'7',1],[11,'dim7',1],[3,'maj7',2],[8,'7',2]],19),

  // Ambient: no strong dominants; lydian and dorian colour, suspended and plagal motion.
  p('q01','Open horizon','ambient','major',1,[[0,'add9',2],[5,'maj9',2],[0,'6/9',2],[2,'m9',2]]),
  p('q02','Still water','ambient','major',1,[[0,'maj9',2],[2,'m9',2],[5,'add9',2],[0,'6/9',2]]),
  p('q03','Cloud layers','ambient','major',1,[[5,'maj9',2],[0,'add9',2],[9,'m9',2],[4,'m7',2]]),
  p('q04','Long afternoon','ambient','major',1,[[0,'6/9',2],[9,'m9',2],[4,'m7',2],[7,'9sus4',2]]),
  p('q05','Floating shore','ambient','major',1,[[2,'m11',2],[5,'add9',2],[0,'maj9',2],[9,'m9',2]]),
  p('q06','Distant glow','ambient','major',1,[[0,'maj9',2],[4,'m7',2],[9,'m9',2],[5,'6/9',2]]),
  p('q07','Slow tide','ambient','major',1,[[5,'add9',2],[2,'m9',2],[9,'m9',2],[0,'maj9',2]]),
  p('q08','Morning mist','ambient','major',1,[[0,'add9',2],[7,'9sus4',2],[2,'m9',2],[5,'maj9',2]]),
  p('q09','Moonlit water','ambient','minor',1,[[0,'madd9',2],[8,'maj9',2],[5,'m9',2],[0,'m11',2]]),
  p('q10','Night garden','ambient','minor',1,[[3,'add9',2],[8,'maj9',2],[0,'m9',2],[5,'m11',2]]),
  p('q11','Lydian float','ambient','lydian',1,[[0,'maj7#11',4],[2,'add9',4]]),
  p('q12','Lydian glow','ambient','lydian',1,[[0,'maj9',2],[2,'add9',2],[7,'maj9',2],[0,'maj7#11',2]]),
  p('q13','Aeolian tide','ambient','minor',1,[[8,'maj9',2],[10,'6/9',2],[0,'m9',4]]),
  p('q14','Suspended haze','ambient','major',1,[[0,'6/9',2],[5,'6/9',2],[9,'m11',2],[7,'9sus4',2]]),
  p('q15','Dorian dusk','ambient','dorian',1,[[0,'m9',4],[5,'add9',4]]),
  p('q16','Plateau','ambient','major',1,[[5,'maj9',4],[0,'6/9',4]]),
  p('q17','Glass horizon','ambient','major',1,[[9,'m9',2],[5,'maj7#11',2],[0,'6/9',2],[7,'9sus4',2]]),
  p('q18','Mirror lake','ambient','minor',1,[[0,'m11',2],[3,'maj9',2],[8,'maj7#11',2],[10,'6/9',2]]),

  // Deep house: hypnotic one- and two-chord vamps, minor ninths and dorian fourth chords.
  p('h01','Dorian vamp','house','dorian',2,[[0,'m9',4],[5,'9',4]]),
  p('h02','Two-chord minor','house','minor',2,[[0,'m11',4],[10,'6/9',4]]),
  p('h03','Warm pair','house','minor',1,[[0,'m9',4],[8,'maj9',2],[10,'6/9',2]]),
  p('h04','Midnight descent','house','minor',2,[[0,'m9',2],[8,'maj9',2],[10,'9sus4',2],[7,'m7',2]]),
  p('h05','Deep pulse','house','minor',1,[[0,'m11',2],[5,'m9',2],[0,'m9',2],[10,'9sus4',2]]),
  p('h06','Neon steps','house','minor',1,[[0,'m9',2],[3,'6/9',2],[10,'add9',2],[8,'maj7',2]]),
  p('h07','Afterglow','house','minor',2,[[8,'maj9',2],[3,'6/9',2],[7,'m7',2],[0,'m11',2]]),
  p('h08','Night transit','house','minor',1,[[0,'m9',2],[7,'m7',2],[8,'maj9',2],[10,'9sus4',2]]),
  p('h09','Undercurrent','house','minor',1,[[5,'m9',2],[0,'m11',2],[8,'maj9',2],[10,'add9',2]]),
  p('h10','Low orbit','house','minor',1,[[0,'m9',2],[8,'6/9',2],[3,'maj9',2],[5,'m9',2]]),
  p('h11','Side street','house','minor',1,[[0,'m7',2],[10,'9sus4',2],[5,'m9',2],[8,'maj9',2]]),
  p('h12','Organ stab','house','dorian',2,[[0,'m11',2],[3,'6/9',2],[5,'9',4]]),
  p('h13','Garage soul','house','minor',1,[[0,'m9',2],[5,'m9',2],[8,'maj9',2],[7,'7#9',2]]),
  p('h14','Warm signal','house','major',1,[[9,'m9',2],[5,'maj9',2],[2,'m9',2],[7,'9sus4',2]]),
  p('h15','First train','house','major',1,[[0,'6/9',2],[2,'m9',2],[4,'m7',2],[9,'m9',2]]),
  p('h16','Sunrise vamp','house','major',2,[[5,'maj9',4],[7,'9sus4',2],[9,'m9',2]]),

  // Liquid D&B: lush major/minor ninths, backdoor and soul resolutions, long plateaus.
  p('d01','Liquid backdoor','dnb','major',2,[[5,'m9',2],[10,'13',2],[0,'maj9',4]]),
  p('d02','Liquid royal','dnb','major',2,[[5,'maj9',2],[4,'m7',2],[9,'m9',4]]),
  p('d03','Rain on glass','dnb','major',1,[[0,'maj9',2],[4,'m7',2],[9,'m9',2],[5,'maj9',1],[7,'9sus4',1]]),
  p('d04','Soul liquid','dnb','minor',2,[[0,'m9',4],[8,'maj9',2],[10,'13',2]]),
  p('d05','Night bus','dnb','minor',2,[[5,'m9',2],[0,'m11',2],[8,'maj9',2],[10,'13',2]]),
  p('d06','Deep blue','dnb','dorian',2,[[0,'m9',2],[5,'13',2],[3,'maj9',2],[2,'m7',2]]),
  p('d07','Two-five liquid','dnb','major',2,[[2,'m9',2],[7,'13',2],[0,'maj9',2],[9,'m9',2]]),
  p('d08','Lifted','dnb','major',1,[[0,'maj9',2],[9,'m9',2],[5,'maj9',2],[7,'9sus4',2]]),
  p('d09','Glide','dnb','minor',1,[[0,'m9',2],[3,'maj9',2],[10,'6/9',2],[5,'m9',2]]),
  p('d10','Distant city','dnb','major',1,[[5,'maj7#11',4],[0,'maj9',4]]),
  p('d11','Neo liquid','dnb','major',2,[[5,'maj9',2],[4,'7#9',2],[9,'m9',2],[0,'9',2]]),
  p('d12','Sunset loop','dnb','minor',1,[[8,'maj9',2],[10,'9sus4',2],[0,'m9',4]]),
  p('d13','Long drive','dnb','major',1,[[5,'maj9',2],[7,'13',2],[4,'m7',2],[9,'m9',2],[2,'m9',2],[7,'9sus4',2],[0,'maj9',4]]),
];
