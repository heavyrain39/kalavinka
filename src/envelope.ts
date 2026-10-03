// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
interface Envelope {
  time: number; amplitude: number; attack: number; hold: number;
  decay: number; sustain: number; release: number; bass: boolean;
}

export function scheduleEnvelope(param: AudioParam, {time, amplitude, attack, hold, decay, sustain, release, bass}: Envelope) {
  const epsilon = 1e-6, end = time + hold + release;
  param.setValueAtTime(0, time);
  param.linearRampToValueAtTime(amplitude, time + attack);
  let heldLevel: number;
  if (sustain) {
    const decayEnd = Math.min(hold, attack + .18);
    // Short notes need one target at the hold boundary, not two conflicting ramps.
    if (decayEnd < hold) param.exponentialRampToValueAtTime(Math.max(epsilon, amplitude * sustain), time + decayEnd);
    heldLevel = Math.max(epsilon, amplitude * sustain * .90);
  } else {
    heldLevel = Math.max(epsilon, amplitude * Math.exp(-(hold - attack) / decay));
  }
  param.exponentialRampToValueAtTime(heldLevel, time + hold);
  // A relative bass floor spreads the fade through its existing release window.
  // Finish at exact zero before disconnecting; bass gaps and event timing stay intact.
  param.exponentialRampToValueAtTime(bass ? Math.max(epsilon, heldLevel * .001) : epsilon, end);
  param.linearRampToValueAtTime(0, end + .005);
}
