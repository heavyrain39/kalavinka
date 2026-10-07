// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
// iOS plays Web Audio in the "ambient" audio session, which the ring/silent switch mutes:
// the graph keeps running (the waveform moves) but nothing reaches the speaker, and the
// volume buttons cannot help. Music apps claim the "playback" session instead.
// Safari/WKWebView 17+ expose navigator.audioSession; older engines switch category when
// an HTML media element is playing, so a silent looping clip is kept running during playback.
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
const ios = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let element: HTMLAudioElement | undefined;

/** Half a second of 8-bit silence as a WAV data URI (no network request). */
function silence() {
  const rate = 8000, length = rate / 2, bytes = new Uint8Array(44 + length), view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => [...value].forEach((c, i) => bytes[at + i] = c.charCodeAt(0));
  text(0, 'RIFF'); view.setUint32(4, 36 + length, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true); text(36, 'data'); view.setUint32(40, length, true);
  bytes.fill(128, 44);
  let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** Call synchronously inside the user's play gesture, before any await. */
export function claimPlaybackSession() {
  try {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch { /* unsupported */ }
  if (!ios) return;
  if (!element) {
    element = new Audio(silence());
    element.loop = true; element.preload = 'auto'; element.setAttribute('playsinline', '');
  }
  void element.play().catch(() => { /* the Web Audio graph still plays where allowed */ });
}
export function releasePlaybackSession() {
  element?.pause();
}
