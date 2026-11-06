// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';
import type { Hit, Kind } from './comping-v26';

// Generator v28 D&B comping. Up to v27 the liquid pad was struck every second bar and held:
// one long chord against a busy break. While the break plays (groove and return), the keys now
// play two-bar rhythm cells written around it — a chord on the kick, syncopated stabs between
// the snares, a push into the next chord — and then bend around the lead and the bass with the
// v26 rules. The intro and the breakdown, where the break is out, keep the long liquid pad.
export const dnbCompV28 = (s: Settings) => s.profile === 'dub' && s.groove === 'dnb' && s.generatorVersion >= 28;
/** Sections where the break plays and the keys join its rhythm. */
export const rhythmSection = (section: string) => section === 'groove' || section === 'return';
// Kick on 0 and 10 (6 in alternate bars), snare on 4 and 12: no cell strikes a snare.
export const DNB: readonly (readonly Hit[])[] = [
  [[0, 'l', .82], [10, 's', .6], [16, 'm', .74], [19, 's', .55], [26, 's', .58], [30, 'p', .62]],
  [[0, 'm', .8], [6, 's', .56], [10, 's', .62], [16, 'l', .76], [27, 'g', .42], [30, 'p', .6]],
  [[0, 'l', .8], [11, 's', .55], [16, 'l', .74], [23, 's', .56], [30, 'p', .6]],
  [[2, 'm', .76], [10, 's', .62], [18, 'm', .72], [26, 's', .6]],
  [[0, 'm', .8], [3, 'g', .4], [10, 'm', .66], [16, 'm', .76], [19, 'g', .4], [26, 'm', .64]],
];
/** D&B chord lengths in bars (a bar is 1.4 s at 170 BPM): long half a bar, medium a quarter. */
export const DNB_LONG = 8 / 16, DNB_MEDIUM = 4 / 16;
/** Release tails in seconds: long chords keep a liquid tail, stabs stay short. */
export const DNB_TAIL: Record<Kind, number> = { l: .5, m: .3, s: .16, g: .12, p: .24 };
/** Sixteenths a long or medium chord rings before an answering stab may follow it. */
export const DNB_HOLD: Partial<Record<Kind, number>> = { l: 8, m: 4 };
