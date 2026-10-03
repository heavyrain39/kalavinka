// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
// A bundled audio clock, independent of UI animation and inactive-tab setTimeout throttling.
class WorkSongClock extends AudioWorkletProcessor {
  constructor() { super(); this.frames = 0; }
  process() {
    this.frames += 128;
    if (this.frames >= sampleRate * .045) { this.frames = 0; this.port.postMessage(currentTime); }
    return true;
  }
}
registerProcessor('worksong-clock', WorkSongClock);
