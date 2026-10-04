# Background arpeggio · v0.14.0 / generator v8

The independent Arpeggio switch adds a quiet, intermittent chord-tone part alongside the four existing instruments. It starts enabled on new compositions, can run with Melody muted, and uses a separate gain bus with an 80 ms mute ramp. The four instrument selectors keep their existing meaning.

Twelve contours cover ascending, descending, up/down, down/up, skips, alternating pedal tones and interleaved chord tones. A seeded permutation uses every contour before repeating; adjacent entrances cannot select the same contour. Each entrance also chooses its register and rhythmic offset deterministically. The part uses compact chord voicings, marimba for lo-fi, bell for ambient, and pluck for house/D&B.

Each 16-bar span reserves a four-bar entrance starting at bar 8 or 10 (zero-based), leaving 10–14 bars between episodes. Ambient and D&B stretch that plan by two: eight-bar episodes with slower notes and 20–28 bars of rest. Entrances sit in the groove/return portions of the existing form. Each two-bar gesture repeats once, giving 8 or 12 notes per episode. This is deliberately a background accent rather than a continuously running ostinato.

Nominal event gain stays at or below .019. Melody overlaps reduce it further, bounded timing offsets reduce coincident attacks, and dry note releases end before the next chord. Soft low-pass filtering and modest alternating pan keep it behind the main melody. Melody muting does not rewrite the arpeggio score.

V8 adds events without changing the v7 backing. V1–v7 generation and existing favorite/link versions remain intact. The existing ordinary-startup upgrade policy remains; loading an old favorite retains its version until an explicit composition edit upgrades it. Enabling the new switch on an old favorite upgrades its composition to v8.

Hearts retain the actual arpeggio notes, timing, duration, sound, gain, pan and release in the existing eight-bar phrase format. Reload and replay start with the saved phrase, then continue from the original absolute bar. This remains a score snapshot: a single final settings snapshot governs playback, not a recording of tempo automation, mute transitions or reverb history inside the eight-bar window.

## Verification

- V7 fingerprints preserved for lo-fi, ambient, house and D&B; v8 without arpeggio equals v7.
- 52 Node tests: 12-pattern rotation, entry/rest density, chord tones, note/release bounds at 50/180 BPM, independent mute, serialization, seeking, and earlier score/transport regressions.
- Actual browser save/reload/replay retained 12 arpeggio events from source bar 8. Independent switches worked with zero reported late events or page errors.
- Korean/English layouts checked at 1440, 390 and 320 px without horizontal overflow; desktop/mobile screenshots inspected.
- 16 Web Audio offline renders across four modes: full mix, isolated arpeggio, muted arpeggio and melody. Muted output was zero; arpeggio RMS was below melody RMS in each case; all voices cleaned up. Maximum full-mix sample peak was .84358 at maximum energy/reverb/volume (not a true-peak measurement).
- Production TypeScript/Vite build and release license audit passed.

The timing and level checks establish bounded behavior, not subjective musical quality across every possible seed.
