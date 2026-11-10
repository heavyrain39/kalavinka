// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent } from './music';

/** One melody note of the eight-bar phrase, in fractions of the canvas (x, w across; y down). */
export interface RibbonNote { at: number; end: number; x: number; w: number; y: number }
export interface RibbonColors { dim: string; mid: string; bright: string }

const BARS = 8, TOP = .16, BOTTOM = .84, MINIMUM_SPAN = 12;

/**
 * Lays the melody of an eight-bar phrase out as a piano-roll ribbon. The height scales to the
 * phrase's own range, with a minimum span so a narrow line does not jump across the whole height.
 */
export function ribbonLayout(events: MusicEvent[]): RibbonNote[] {
  const lead = events.filter(e => e.layer === 'motif' && e.notes.length && e.at >= 0 && e.at < BARS);
  if (!lead.length) return [];
  const pitches = lead.flatMap(e => e.notes), lowest = Math.min(...pitches), highest = Math.max(...pitches);
  const spare = Math.max(0, MINIMUM_SPAN - (highest - lowest)) / 2, low = lowest - spare, span = highest - lowest + spare * 2;
  return lead.flatMap(e => e.notes.map(note => {
    const end = Math.min(BARS, e.at + e.length);
    return { at: e.at, end, x: e.at / BARS, w: (end - e.at) / BARS, y: BOTTOM - (note - low) / span * (BOTTOM - TOP) };
  }));
}

/**
 * Draws the ribbon: a faint live waveform behind, the phrase's melody and a playhead. `position`
 * is the playhead in bars (0–8), or null while stopped; notes behind the playhead are lit, the
 * sounding one brightest. Colours come from the page's own tokens.
 */
export function drawRibbon(context: CanvasRenderingContext2D, width: number, height: number, notes: RibbonNote[],
  view: { position: number | null; samples: Float32Array | null; colors: RibbonColors }) {
  const { position, samples, colors } = view;
  context.clearRect(0, 0, width, height);
  if (samples) {
    // Start at a rising zero crossing so the wave stands still instead of jittering.
    const half = samples.length >> 1;
    let first = 0;
    for (let i = 1; i < half; i++) if (samples[i - 1] < 0 && samples[i] >= 0) { first = i; break; }
    context.globalAlpha = .2; context.strokeStyle = colors.mid; context.lineWidth = 1; context.beginPath();
    for (let i = 0; i < half; i += 2) {
      const x = i / (half - 2) * width, y = height / 2 - samples[first + i] * height * .5;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke(); context.globalAlpha = 1;
  }
  for (const note of notes) {
    const sounding = position !== null && position >= note.at && position < note.end;
    context.fillStyle = sounding ? colors.bright : position === null || position >= note.end ? colors.mid : colors.dim;
    const thickness = sounding ? 5 : 4;
    const x = Math.round(note.x * width), right = Math.max(x + 2, Math.round((note.x + note.w) * width) - 1);
    context.fillRect(x, Math.round(note.y * height - thickness / 2), right - x, thickness);
  }
  if (position !== null) {
    context.fillStyle = colors.bright;
    context.fillRect(Math.min(width - 1, Math.round(position / BARS * width)), 0, 1, height);
  }
}
