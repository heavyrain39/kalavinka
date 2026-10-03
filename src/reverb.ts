// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
export const reverbGain = (amount: number) => .46 * Math.min(100, Math.max(0, Number.isFinite(amount) ? amount : 0)) / 100;

export function createRoom(context: BaseAudioContext, impulse: AudioBuffer, amount: number) {
  const input = context.createBiquadFilter(); input.type = 'highpass'; input.frequency.value = 220;
  const preDelay = context.createDelay(.1); preDelay.delayTime.value = .018;
  const room = context.createConvolver(); room.buffer = impulse;
  const damping = context.createBiquadFilter(); damping.type = 'lowpass'; damping.frequency.value = 3400;
  const wet = context.createGain(); wet.gain.value = reverbGain(amount);
  input.connect(preDelay).connect(room).connect(damping).connect(wet);
  return { input, wet, nodes: [input, preDelay, room, damping, wet] };
}
