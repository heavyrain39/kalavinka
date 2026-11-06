// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent, Settings } from './music';
import { arrangementAt } from './arrangement';
import { crashEvent } from './crash';
import { fillPlanV17 } from './fills-v17';

// Generator v25 deep house: a reversed cymbal swells over the last two beats of a build-up and
// lands on the crash that opens the return. Only where the score already has both the build
// fill and that crash, so it marks the biggest lift of the form and nothing else.
export const swellV25 = (s: Settings) => s.profile === 'dub' && s.groove !== 'dnb' && s.generatorVersion >= 25;
/** Swell length in bars (two beats). */
export const SWELL = .5;
/** The cymbal's own 0.1 s bloom, played backwards as the swell's fade-out. */
export const CYMBAL_BLOOM = .1;
/** The swell peaks 40 ms after the downbeat, over the crash's rising bloom, so the two overlap. */
export const SWELL_LEAD = .04;

/** The score already builds up into a crash on the return: the swell's natural place. */
const eligible = (s: Settings, bar: number) => bar >= 0 && arrangementAt(s, bar).section === 'open'
  && arrangementAt(s, bar + 1).section === 'return' && fillPlanV17(s, bar)?.kind === 'build' && !!crashEvent(s, bar + 1);

export function swellEvent(s: Settings, bar: number): MusicEvent | undefined {
  if (!swellV25(s) || !eligible(s, bar)) return;
  // In a run of eligible forms only every other one swells, so it never becomes a routine.
  const form = arrangementAt(s, bar).formLength;
  let run = 0;
  while (eligible(s, bar - (run + 1) * form)) run++;
  if (run % 2) return;
  const crash = crashEvent(s, bar + 1)!;
  return { at: bar + 1 - SWELL, length: SWELL, voice: 'crash', layer: 'rhythm', notes: [], gain: crash.gain * .5,
    pan: -crash.pan, cutoff: crash.cutoff, velocity: crash.velocity, variation: crash.variation, reverse: true };
}

/** A reversed copy of a cymbal buffer (cached per buffer). */
const reversed = new WeakMap<AudioBuffer, AudioBuffer>();
export function reversedBuffer(buffer: AudioBuffer): AudioBuffer {
  let out = reversed.get(buffer);
  if (!out) {
    out = new AudioBuffer({ length: buffer.length, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) out.copyToChannel(buffer.getChannelData(ch).slice().reverse(), ch);
    reversed.set(buffer, out);
  }
  return out;
}
