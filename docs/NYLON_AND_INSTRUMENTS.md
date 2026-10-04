# Nylon guitar and instrument controls — v0.24.0

## User-facing behavior

- Arpeggio now includes **나일론 기타 / Nylon guitar**. Other layers retain their existing palettes. It is a manual choice; historical seeded instrument choices remain unchanged.
- **악기 유지 / Keep sounds** applies to New flow. It preserves the five sound choices and current mute states while generating a new composition. The switch survives reloads. Manual sound changes remain available; loading a favorite or selecting a mood still loads that selection's sounds.
- After hours rhythm selection now lives in the instrument toolbar as two explicit buttons. Selecting Four on the floor starts at 108 BPM; Drum & bass starts at 170 BPM. On narrow screens the pair occupies a full row below the toolbar title and switch.
- Saved labels cycle from 1 through 999 separately for each mood, skipping numbers still in the collection. For example, counter 999 with existing (1) and (2) produces (3). The collection limit remains 12. Existing valid labels are preserved, with invalid or duplicate old labels repaired without replacing the saved settings or phrase.

## Guitar synthesis

Original physical-model synthesis; no recorded guitar samples or external instrument assets. A fractional-delay plucked string with a triangular initial displacement supplies the fundamental and decaying harmonics. A quiet detuned companion, body resonances, a brief finger transient and velocity-dependent filtering shape the sound. This is a synthesized nylon-guitar timbre, not a recording of a particular instrument.

Guitar arpeggios retain the existing onset grid and contour but use a lower register (MIDI 48–66). Neighboring notes may ring together; damped releases stop before harmony changes and written rests. Written velocity and hand variation are stored in saved phrases for repeatable playback.

Buffers are generated at 48 kHz regardless of the output device and resampled by Web Audio. A per-context 24 MiB LRU cache bounds retained buffers. Starting with guitar selected prepares all 38 normal-velocity pitch/hand combinations, yielding between renders. Voice nodes participate in the shared stop/cleanup lifecycle.

## UX audit and verification

The previous groove dropdown sat between transport and instrument controls without a clear grouping. Moving it into the instrument toolbar makes its scope explicit. A global Keep sounds control avoids five separate locks for the requested workflow; its pressed state and explanatory tooltip are available to keyboard and assistive-technology users.

Verified local layouts at 1280 px, 390 px and 320 px, with Korean/dark and English/light views. No horizontal overflow was observed. Keyboard Space toggles the lock; the instrument menus remain editable while locked. New flow keeps the selected guitar and other sounds when locked and resumes instrument generation when unlocked. Groove selection updates BPM and preserves sound selections.

- 82 automated tests pass, including pitch/decay/determinism checks at 44.1, 48 and 96 kHz, all-mode articulation boundaries, saved-phrase validation, legacy instrument compatibility, number rollover, collisions and reload migration.
- TypeScript, production build and release/license audit pass.
- 24 OfflineAudioContext renders cover lo-fi, ambient, four on the floor and D&B, 50/180 BPM, full mix/guitar/muted guitar. All outputs are finite; the highest full-mix sample peak is 0.848. Muted guitar is silent and every rendered voice is cleaned up.
- At 44.1/96 kHz device rates, preparation produces the same 38 buffers (21,888,000 bytes) and subsequent normal-velocity lookups cause no new renders.
- Live D&B guitar playback passed 32 bars with zero late onsets and no engine error. Stop released all active sources. Saving, loading and reloading preserved the canonical written score. A browser scenario with (1), (2) and (999) saved allocated (3), then allocated (4) after reload while retaining those older entries.
- A bounded Terra code review prompted fixed-rate synthesis, cache preparation, a clearer attack and direct-call validation. Musical quality still depends on listening; signal and scheduling checks do not establish perceptual realism.

Local evidence: `.local/nylon-all-tests.log`, `.local/nylon-build.log`, `.local/nylon-audio-results.json`; UI screenshots and 20-second listening previews are under `output/playwright/nylon-*`. These temporary artifacts are excluded from the repository.
