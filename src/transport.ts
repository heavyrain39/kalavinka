// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Score } from './score';
import type { MusicEvent } from './music';

interface Section<T> {
  bar: number;
  time: number;
  bpm: number;
  score: Score;
  active: boolean;
  render: T;
  activate?: () => void;
}
interface TransportOptions<T> {
  clock: () => number;
  trigger: (event: MusicEvent, time: number, duration: number, bpm: number, render: T) => void;
  onError: (error: unknown) => void;
}
const LOOKAHEAD = .18;
const START_LEAD = .19;

/** Piecewise bar-to-audio-time mapping. No timers, synthesis, or pattern language. */
export class Transport<T = undefined> {
  private sections: Section<T>[] = [];
  private cursor = 0;
  running = false;
  stalled = 0;
  constructor(private options: TransportOptions<T>) {}

  start(score: Score, bpm: number, render: T = undefined as T) {
    this.checkTempo(bpm);
    const time = this.options.clock() + START_LEAD;
    this.sections = [{ bar: 0, time, bpm, score, render, active: true }];
    this.cursor = time;
    this.stalled = 0;
    this.running = true;
    this.tick();
  }
  stop() { this.running = false; this.sections = []; }
  get position() { return this.sections.length ? Math.max(0, this.barAt(this.options.clock())) : 0; }
  get pending() { return this.sections.some(s => !s.active); }

  /** Replace an unreserved change, or append after all audio already reserved. */
  queue(score: Score, bpm: number, activate: () => void, render: T = undefined as T): number {
    this.checkTempo(bpm);
    if (!this.running) throw new Error('Transport is stopped');
    const last = this.sections.at(-1)!;
    if (!last.active && last.time >= this.cursor && last.time > this.options.clock()) {
      last.score = score; last.bpm = bpm; last.activate = activate; last.render = render;
      return last.bar;
    }
    const safeTime = Math.max(this.cursor, this.options.clock() + LOOKAHEAD);
    const bar = Math.floor(this.barAt(safeTime)) + 1;
    const time = last.time + (bar - last.bar) * 240 / last.bpm;
    this.sections.push({ bar, time, bpm, score, render, active: false, activate });
    return bar;
  }

  tick() {
    if (!this.running) return;
    try {
      const now = this.options.clock(), end = now + LOOKAHEAD;
      // A sleeping/blocked page resumes from the audio clock, without a burst of old notes.
      if (this.cursor < now) { this.stalled++; this.cursor = now; }
      for (const section of this.sections) {
        if (!section.active && section.time <= now) { section.active = true; section.activate?.(); }
      }
      if (!this.running) return;
      for (let i = 0; i < this.sections.length; i++) {
        const section = this.sections[i], next = this.sections[i + 1];
        const from = Math.max(this.cursor, section.time), to = Math.min(end, next?.time ?? Infinity);
        if (to <= from) continue;
        // Widen the numeric query very slightly, then use one authoritative time interval.
        // This avoids floating point conversion dropping a note exactly at a tick boundary.
        const beginBar = section.bar + (from - section.time) * section.bpm / 240;
        const endBar = section.bar + (to - section.time) * section.bpm / 240;
        for (const event of section.score.onsets(Math.max(section.bar, beginBar - 1e-9), endBar + 1e-9)) {
          if (next && event.at >= next.bar) continue;
          const time = section.time + (event.at - section.bar) * 240 / section.bpm;
          if (time < from || time >= to) continue;
          this.options.trigger(event, time, event.length * 240 / section.bpm, section.bpm, section.render);
          if (!this.running) return;
        }
      }
      this.cursor = Math.max(this.cursor, end);
      // Keep only the audible section and queued future sections, even over long sessions.
      while (this.sections.length > 1 && this.sections[1].active) this.sections.shift();
    } catch (error) {
      this.stop(); this.options.onError(error);
    }
  }
  private barAt(time: number) {
    let section = this.sections[0];
    for (const candidate of this.sections) if (candidate.time <= time) section = candidate;
    return section.bar + (time - section.time) * section.bpm / 240;
  }
  private checkTempo(bpm: number) {
    if (!Number.isFinite(bpm) || bpm < 50 || bpm > 180) throw new RangeError('Invalid tempo');
  }
}
