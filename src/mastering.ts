// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later

// Adapted from Mastermind's applySoftKneeCurve: unity below the knee,
// continuous unity slope on entry, then a monotonic approach to the ceiling.
export function peakCurve(sample: number, ceiling = 10 ** (-1 / 20), kneeDb = 3): number {
  const magnitude = Math.abs(sample);
  const start = ceiling / 10 ** (kneeDb / 20);
  if (magnitude <= start) return sample;
  const range = ceiling - start;
  return Math.sign(sample) * (start + range * Math.tanh((magnitude - start) / range));
}

// Native Web Audio nodes keep the continuous stereo mix on the audio thread.
// Fixed gain staging preserves rests and dynamics without chasing silence with AGC.
export function createMastering(context: BaseAudioContext) {
  const input = context.createBiquadFilter(); input.type = 'highpass'; input.frequency.value = 28; input.Q.value = .707;
  const body = context.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 280; body.Q.value = .7; body.gain.value = -1.3;
  const air = context.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 6500; air.gain.value = -1.5;
  const drive = context.createGain(); drive.gain.value = 3.2;
  const glue = context.createDynamicsCompressor();
  glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 1.8;
  glue.attack.value = .025; glue.release.value = .18;
  // Native compressors supply makeup gain; avoid another boost into the peak stage.
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 12;
  limiter.attack.value = .001; limiter.release.value = .09;
  const safety = context.createWaveShaper();
  safety.curve = Float32Array.from({ length: 8193 }, (_, i) => peakCurve(i / 4096 - 1));
  safety.oversample = '4x';
  // Volume follows mastering: changing the slider never changes compression strength.
  const volume = context.createGain(); volume.gain.value = 0;
  const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .82;
  input.connect(body).connect(air).connect(drive).connect(glue)
    .connect(limiter).connect(safety).connect(volume).connect(analyser).connect(context.destination);
  return { input, volume, analyser, glue, limiter };
}

export const volumeGain = (percent: number) => Math.pow(Math.min(100, Math.max(0, percent)) / 100, 1.4);
