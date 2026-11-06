// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent, Settings } from './music';
import { defaultArpeggioInstrument } from './instruments';

// Generator v27 lo-fi: a chord struck on the same sixteenth as an arpeggio note sounds with it.
// Lo-fi chords start 6 ms late (a relaxed hand) and are often rolled (+12 ms), and a four-note
// keyboard chord takes longer to speak than a marimba note, so the two used to land 20–40 ms
// apart: a flam. Those chords now drop the lag and the roll and start a little early by the
// difference in speaking time (capped at 20 ms). Chords that play alone keep their lazy feel.
export const alignV27 = (s: Settings) => s.profile === 'lofi' && s.generatorVersion >= 27;
/** Time (ms) for each voice to reach half its level, measured on the rendered instruments. */
export const SPEAK_MS: Record<string, number> = {
  'h-electric': 29, 'h-felt': 29, 'h-organ': 42, 'h-pad': 95,
  'm-marimba': 17, 'm-bell': 17, 'm-pluck': 17, 'm-flute': 39, 'm-nylon': 17,
};
export const MAX_LEAD_MS = 20;
/** How much earlier (seconds) a chord on that instrument starts to sound with the arpeggio's. */
export const chordLead = (harmony: string, arpeggio: string) =>
  Math.min(MAX_LEAD_MS, Math.max(0, (SPEAK_MS[harmony] ?? 29) - (SPEAK_MS[arpeggio] ?? 17))) / 1000;

export function alignChordsV27(s: Settings, bar: number, events: MusicEvent[]): MusicEvent[] {
  if (!alignV27(s)) return events;
  const arps = events.filter(e => e.layer === 'arpeggio');
  if (!arps.length) return events;
  const step = (e: MusicEvent) => Math.round((e.at - bar) * 16);
  const seconds = 240 / s.bpm;
  // A rolled chord is two events on one sixteenth: they move together and stop rolling.
  const groups = new Map<number, MusicEvent[]>();
  for (const e of events) if (e.layer === 'harmony') { const k = step(e); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(e); }
  const moved = new Map<MusicEvent, MusicEvent>();
  for (const [k, chord] of groups) {
    const arp = arps.find(a => step(a) === k);
    if (!arp) continue;
    const lead = chordLead(s.instruments.harmony, arp.instrument ?? s.instruments.arpeggio ?? defaultArpeggioInstrument(s.profile));
    const at = Math.max(bar, arp.at - lead / seconds), end = Math.max(...chord.map(e => e.at + e.length));
    for (const e of chord) moved.set(e, { ...e, at, length: +(end - at).toFixed(8) });
  }
  return events.map(e => moved.get(e) ?? e);
}
