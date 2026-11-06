// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Chord, MusicEvent, Settings } from './music';
import { hash } from './seed';

// Generator v26 lo-fi comping that listens to the band. The v18 two-bar cell stays the backbone;
// four rules make the chords interlock with the lead and the bass instead of laying long blocks:
//  1. no short stab a sixteenth next to a lead note (a flam), unless it lands with it;
//  2. where the lead rests for a quarter note or more, the keys answer with one or two short
//     stabs on the off-beats, in the bass's gaps;
//  3. a bass pickup late in the bar (sixteenths 13–15) is played with the keys: a push into a new
//     chord, or a short stab on the same chord;
//  4. chords are shorter (long ≤ 5 sixteenths, medium ≤ 3) and end a little before the next stab,
//     so the keys keep a rhythm of their own instead of laying blocks.
export const interlockV26 = (s: Settings) => s.profile === 'lofi' && s.generatorVersion >= 26;
export type Kind = 'l' | 'm' | 's' | 'g' | 'p';
export type Hit = readonly [number, Kind, number];
/** Gap left before the next stab, in bars (three quarters of a sixteenth). */
export const BREATH = .75 / 16;
/** v26 lo-fi chord lengths in bars: long and medium. */
export const LONG = 5 / 16, MEDIUM = 3 / 16;
/** Key-release tails in seconds, so short stabs stay short (the electric piano's own is 0.40 s). */
export const TAIL: Record<Kind, number> = { l: .34, m: .26, s: .16, g: .12, p: .2 };
const pc = (n: number) => ((n % 12) + 12) % 12;
const stepOf = (at: number, bar: number) => Math.round((at - bar) * 16);

export function interlockHits(s: Settings, bar: number, part: number, hits: readonly Hit[], melody: readonly MusicEvent[],
  bass: readonly MusicEvent[], chord: Chord, next: Chord, intro: boolean): Hit[] {
  const lead = melody.filter(e => e.at >= bar - 1 && e.at < bar + 1);
  const onsets = new Set(lead.filter(e => e.at >= bar - 1e-9).map(e => stepOf(e.at, bar)));
  const sounding = Array.from({ length: 16 }, (_, k) => lead.some(e => {
    const from = (e.at - bar) * 16, to = from + e.length * 16;
    return from < k + .5 && to > k + .25;
  }));
  const bassSteps = bass.filter(e => e.at >= bar - 1e-9 && e.at < bar + 1).map(e => ({ step: stepOf(e.at, bar), e }));
  const local = (h: Hit) => h[0] - part * 16;
  // 1. Flams: a stab or ghost a sixteenth away from a lead onset (and not with one) gives way.
  let out: Hit[] = hits.filter((h, i) => {
    const k = local(h);
    if (i === 0 || h[1] === 'l' || h[1] === 'm' || h[1] === 'p' || onsets.has(k)) return true;
    return !onsets.has(k - 1) && !onsets.has(k + 1);
  });
  // 3. The bass picks up into the next bar: the keys play that sixteenth with it.
  const pickup = bassSteps.find(({ step }) => step >= 13 && step <= 15);
  if (pickup) {
    const into = next.label !== chord.label && pickup.e.notes.some(n => next.notes.some(c => pc(c) === pc(n)));
    // Everything late in the bar gives way to the shared hit.
    out = out.filter(h => local(h) < 12 || local(h) === pickup.step);
    if (!out.some(h => local(h) === pickup.step)) out.push([part * 16 + pickup.step, into ? 'p' : 's', into ? .64 : .56]);
  }
  // 2. Answer the lead's rests (not in the calm intro, not in quiet songs).
  if (!intro && s.energy >= 30) {
    let k = 0;
    while (k < 16) {
      if (sounding[k]) { k++; continue; }
      let end = k; while (end < 16 && !sounding[end]) end++;
      const gap: [number, number] = [k, end]; k = end;
      if (gap[1] - gap[0] < 4) continue;
      const taken = (step: number) => out.some(h => Math.abs(local(h) - step) <= 2) || bassSteps.some(b => b.step === step);
      const candidates: number[] = [];
      for (let step = Math.max(1, gap[0]); step < gap[1]; step++) {
        if (taken(step) || onsets.has(step)) continue;
        const weight = step % 4 === 2 ? 3 : step % 2 ? 1 : 0; // off-beat eighths first, then sixteenths
        for (let w = 0; w < weight; w++) candidates.push(step);
      }
      const wanted = gap[1] - gap[0] >= 8 && s.energy >= 45 ? 2 : 1;
      for (let n = 0; n < wanted && candidates.length; n++) {
        const step = candidates[hash(`${s.seed}:comp26:${bar}:${gap[0]}:${n}`) % candidates.length];
        out.push([part * 16 + step, 's', .5 + (hash(`${s.seed}:comp26:v:${bar}:${step}`) % 100) / 1000]);
        for (let i = candidates.length - 1; i >= 0; i--) if (Math.abs(candidates[i] - step) <= 2) candidates.splice(i, 1);
      }
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}
