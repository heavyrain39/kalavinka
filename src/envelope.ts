// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
interface Envelope {
  time: number; amplitude: number; attack: number; hold: number;
  decay: number; sustain: number; release: number; bass: boolean;
}

/** Relative, curved tails retain the same articulation at every output level. */
export function scheduleAmbientEnvelope(param:AudioParam,{time,amplitude,attack,hold,decay,sustain,release}:Envelope){
  const attackCurve=Float32Array.from({length:65},(_,i)=>amplitude*Math.sin(i/64*Math.PI/2)**2);
  param.setValueCurveAtTime(attackCurve,time,attack);
  const held=amplitude*(sustain?sustain*.92:Math.exp(-(hold-attack)/decay));
  param.exponentialRampToValueAtTime(Math.max(1e-9,held),time+hold);
  const floor=Math.exp(-5.5);
  const tail=Float32Array.from({length:129},(_,i)=>held*(sustain?Math.cos(i/128*Math.PI/2)**2:(Math.exp(-5.5*i/128)-floor)/(1-floor)));
  param.setValueCurveAtTime(tail,time+hold,release);
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
