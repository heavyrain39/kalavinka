// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
/** Own a voice graph even if the audio context suspends before queued onended events. */
export function ownVoice(sources: AudioScheduledSourceNode[], nodes: AudioNode[],
  active: Set<AudioScheduledSourceNode>, cleanups?: Set<() => void>) {
  let remaining = sources.length, disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const source of sources) {
      source.onended = null;
      try { source.stop(); } catch { /* not started or already stopped */ }
      source.disconnect(); active.delete(source);
    }
    for (const node of nodes) node.disconnect();
    cleanups?.delete(dispose);
  };
  cleanups?.add(dispose);
  for (const source of sources) {
    active.add(source);
    source.onended = () => {
      active.delete(source); source.disconnect();
      if (--remaining === 0) dispose();
    };
  }
  return dispose;
}
