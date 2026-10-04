# Melody v7 · narrative without a fixed song loop

Released with app v0.12.0. Browser-only deterministic composition; no model, service or downloaded music.

## Musical structure

- A seed defines a two-bar rhythmic motif, relative scale contour, individual gates and accents. Repeated pitches are allowed. Larger contour moves are followed by a smaller move in the opposite direction.
- Eight bars form statement, altered answer, development and a quieter shortened cadence. Motif slots retain their identity when sparse profiles remove optional notes. D&B and ambient use a smaller note budget.
- After 64 bars (128 in ambient), the first statement quotes the previous motif before introducing the new motif in its answer. New rhythmic families come from seeded permutations, with no adjacent duplicate at permutation boundaries. Chapter-specific contour/gate choices prevent a fixed nine-family whole-song loop.
- The chapter clock is independent of Variation. Variation controls optional edits and developmental displacement. Even at zero, absolute chapter and sentence indices continue to develop the score.
- Actual pitches adapt the motif to the current chord and sounding bass. Bounded weighted selection among close candidates avoids taking the same single optimal path on every seed. A compact register and central entry/exit notes constrain phrase-boundary jumps.
- Short non-chord neighbours are inserted only where a rest permits a two-note tension/resolution gesture. They approach the next guaranteed chord tone by one or two semitones. They avoid strong subdivisions, incompatible sounding bass tones, harmonic changes and nearby fills. They are occasional, not mandatory in every phrase.
- Note lengths, accents and phrase-end space are explicit. New events include a release ceiling in seconds, so the melodic synthesis envelope fits the written harmonic/next-onset budget. Neighbours use a 35 ms release; ordinary melodic notes use up to 140 ms. Existing scores omit this field and retain their envelopes.

## Compatibility and cost

Only version 7 dispatches to `ensemble-v7.ts`; versions 1–6 keep their existing score paths. V7 reuses V6 accompaniment and drum expression. Existing favorites/shared links retain their version. New flow/profile/timbre selection and ordinary startup use v7, following the existing upgrade policy.

Composition is indexed by absolute bars, never by a mutable random stream or growing playback history. An eight-bar result cache holds at most 64 entries, excludes instruments/volume/mutes, and belongs only to v7. Seeking and cache eviction reproduce the same score. Reverb can still carry an intentionally diffuse tail across chord changes; the release budget governs dry voices.

## Verification

- V6 score fingerprints recorded before changes: all three profiles plus D&B; v7 accompaniment comparison across 96 bars.
- Twelve chapters per profile and Variation setting: no identical complete chapter signatures, including Variation 0; chronological versus shuffled queries and cache eviction agree.
- Seed/tempo corpus checks melodic range, density, positive durations, allowed leaps, chord-tone anchors, same-pitch repetitions, recognizable rhythmic replies, neighbour resolution and envelope budgets.
- Existing score, timing, bass, drum and lifecycle regression tests remain in use. Browser checks render complete mixes through actual Web Audio DSP and exercise saved/current playback.

Release checks: 45 Node tests passed. A 30-progression mix render passed, and a focused 16-case render (four melodic instruments × lo-fi/ambient/house/D&B, with actual neighbour pairs) produced finite output with maximum sample peak 0.84956 and no remaining voices/cleanup callbacks. The browser playback check preserved a v6 favorite and played v7 D&B through a live Variation change with zero reported late events. These sample peaks are not true-peak measurements.

These are musical heuristics and safety properties, not an objective score for catchiness or beauty. The eight-bar arc deliberately remains recognizable; long listening and comparative human listening remain the way to tune its musical character.

## Closing-note correction · v0.16.0 / generator v10

Two rules caused an incomplete eighth bar: stage 3 removed all gestures after step 20 of its two-bar span, and the intro then omitted the last gesture of odd stages. Together they could remove the intended closing note and leave a long empty ending.

V10 retains the final two-bar gesture sequence, places its last note in the latter half of bar eight, and exempts the final cadence from intro omission. Its gate sustains toward the phrase boundary, still respecting chord changes, the following note and the instrument's release. Sparse ambient/D&B arrangements also retain this closing note. The other stages keep their existing thematic development.

`src/melody-v7.ts` preserves the v7–v9 algorithm; the narrative cache distinguishes old and new melodic versions. Fingerprints and mixed-version queries verify that reading an old favorite cannot reuse a new cached cadence or vice versa.

57 Node tests passed, including a 1,024-phrase cadence corpus across four modes, eight seeds, two tempos and two energies. Every tested phrase retains a late closing note whose dry release ends near the phrase boundary without overlap. Browser replay verifies the written cadence and 32 evenly spaced arpeggio notes in the first eight-bar save, then plays through the final bar without late events. Production build and license audit passed.
