// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent } from './music';

/** App-specific onset lookup in bars. Sustained notes are scheduled only at their onset. */
export class Score {
  private bars = new Map<number, MusicEvent[]>();
  constructor(private compose: (bar: number) => MusicEvent[]) {}

  onsets(begin: number, end: number): MusicEvent[] {
    if (!Number.isFinite(begin) || !Number.isFinite(end) || end <= begin || end <= 0) return [];
    const first = Math.max(0, Math.floor(begin)), last = Math.ceil(end);
    const result: MusicEvent[] = [];
    for (let bar = first; bar < last; bar++) {
      let notes = this.bars.get(bar);
      if (!notes) { notes = this.compose(bar); this.bars.set(bar, notes); }
      for (const note of notes) if (note.at >= begin && note.at < end) result.push(note);
    }
    for (const bar of this.bars.keys()) if (bar < first - 2 || bar > last + 2) this.bars.delete(bar);
    return result;
  }
}
