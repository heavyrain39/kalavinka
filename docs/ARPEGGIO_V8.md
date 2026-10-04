# Background arpeggio · v0.14.0 / generator v8

The independent Arpeggio switch adds a quiet, intermittent chord-tone part alongside the four existing instruments. Since v0.14.1 it appears as the fifth part in the instrument grid, with the same on/off and sound-dropdown controls. It starts enabled on new compositions, can run with Melody muted, and uses a separate gain bus with an 80 ms mute ramp. The arpeggio sound selector offers bell, marimba, soft flute and pluck independently of Melody. New Flow varies all five sounds.

Twelve contours cover ascending, descending, up/down, down/up, skips, alternating pedal tones and interleaved chord tones. A seeded permutation uses every contour before repeating; adjacent entrances cannot select the same contour. Each entrance also chooses its register and rhythmic offset deterministically. The part uses compact chord voicings, marimba for lo-fi, bell for ambient, and pluck for house/D&B by default. Explicit choices are retained in settings and saved phrases. Older v8 settings without a choice continue using the original profile sound.

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

V0.14.1 checks: 53 Node tests passed, including all four arpeggio timbres, save/normalize round trips and regeneration. Browser checks select Soft flute, save it, reload it and verify both the dropdown and actual saved notes. Responsive layouts cover 1440, 1024, 768, 390 and 320 px in Korean and English.

## Audibility correction · v0.15.0 / generator v9

The original entrance waited until bars 9/11 (house) or 17/21 (D&B), and the part was easily masked at its original level. A nonzero isolated render was insufficient evidence of useful presence in the full mix.

New compositions introduce the first episode in bar 3 in every mode, then use the existing sparse later episodes. V8 score fingerprints and saved note timing remain unchanged. The arpeggio bus receives a 2.3 multiplier (+7.23 dB), including playback of older saved arpeggio notes. The raised bus level is applied consistently at creation and live updates; mute still ramps to zero. Existing saved openings retain their written entrances; New Flow starts a v9 composition.

54 Node tests and the production build passed. Forty offline renders cover four sounds in both After hours rhythms, comparing full mix, isolated part, previous bus level, mute and melody. At the tested default tempos the new first onset is 4.58 seconds for house and 3 seconds for D&B. The measured part increased 7.23 dB while staying 3.65–11.71 dB below the isolated melody RMS. Sixteen additional stress renders cover all four modes at maximum energy/reverb/volume (maximum full-mix sample peak .84530). Mute output was zero and voices cleaned up. These measurements do not guarantee audibility on every speaker or every generated mix.

Live browser checks assert actual arpeggio dispatches by bar 4, exact saved-note/sound replay and independent mute, with no late events. The read-only diagnostic counter distinguishes arpeggio dispatch from other voices; it is not exposed as product UI.

## Repeating sequencer · v0.16.0 / generator v10

V8/v9's sparse chord-tone gestures did not establish a clear continuous arpeggio. V10 uses one fixed clock through the active episode: eight evenly spaced notes per bar, or four at D&B half-time. The selected 4- or 6-note contour repeats without phase resets at bar lines. Chord changes replace the pitches while retaining the ordered contour and clock. Melody overlap can reduce gain slightly but cannot delay or omit a step. Short gates and 40 ms releases leave each attack distinct.

The twelve-pattern rotation, rests between episodes, independent sound selector, early first entrance and saved-note replay remain. The denser part has a lower per-note level in ambient/D&B to stay behind the lead. V8/v9 implementation is preserved in `src/arpeggio-v9.ts`; V9 score fingerprints still match in all four modes.

Tests assert every interval, repeated ordered pitches under unchanged chords, exact event counts, release clearance and saved replay. Full validation also covers the corrected melodic cadence described in `MELODY_V7.md`.

## More frequent entries and part activity · v0.17.0 / generator v11

V11 alternates four active bars with four resting bars, doubled to eight/eight for ambient and D&B. The first episode still starts in bar 3. The twelve-pattern permutation and continuous step clock remain. V10 and older score timing is preserved by version dispatch; stored eight-bar phrases continue to play their explicit notes.

Automatic initial, profile and New Flow instrument selection excludes the chosen melody sound from the arpeggio candidates. New Flow also excludes its previous arpeggio sound. Manual matching selections remain valid and round-trip unchanged.

Each scene meters its five actual audio buses after mute (and bass ducking), using 256-sample analyser buffers. Readings include scene crossfade and master volume, then a short attack/release smooths a monochrome button background at up to 14% opacity. The on/off square remains independent. Shared melodic reverb/delay is represented by the overall scope rather than individual part indicators. Silent, muted and stopped parts settle to zero; reduced-motion mode uses slower changes at five updates per second. No additional audio source or timer drives the indicator.

Validation: 59 Node tests and the production build/license audit passed. The four v10 score fingerprints remain exact. Across 768 automatic profile/seed pairs, melody/arpeggio choices differ and manual matches survive normalization. Live browser checks cover all five activity signals, arpeggio rests/re-entry, individual mute, volume zero, stop and reduced motion with no late events. Light/dark desktop/mobile views and ten Korean/English layouts have no horizontal overflow. Saved arpeggio notes replay exactly after reload. Sixteen offline renders pass mute, cleanup and output bounds (maximum full-mix sample peak .84496).

## Phrase-aligned entrances · v0.18.0 / generator v12

An entry in bar 3 now continues through bar 8, rather than leaving in bar 6. Subsequent phrases combine bars 1–4, 5–8 and 3–8. These are positions in each eight-bar phrase in every mode; D&B retains its half-time note clock, while ambient keeps its quiet mix level.

Three seeded 64-bar arrangements each contain two opening-half entries, two answering-half entries, three late builds and one resting phrase. This gives 34 active bars out of 64, close to v11's half-time presence, while every change of pattern has at least two resting bars. The resting phrase permits an opening-half entry after a previous phrase ended with arpeggio. Twelve pitch contours continue to rotate by actual entry, skipping the resting phrase. Settings and absolute bar alone determine the plan, including across chapter boundaries and saved-phrase seeks.

V11 and older score timing remains under its original version; existing saved openings retain their written notes. New Flow uses v12. The four v11 score fingerprints are fixed in tests, with unchanged accompaniment, exact saved replay of all three windows and silence, full note counts through each window, chord/release bounds, and all twelve contours checked across tempos and modes.

Validation: 60 Node tests and the production build/license audit passed. Live audio activity persists in bars 7–8 after the bar-3 entrance, becomes silent in the following rest, and re-enters with the next phrase's answering half. Saving and reloading retains all 48 notes of the six-bar opening. Browser checks report no late events or page errors; sixteen offline renders remain bounded (maximum full-mix peak .84160), with zero muted output and complete source cleanup.
