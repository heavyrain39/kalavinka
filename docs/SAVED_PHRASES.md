# Eight-bar saved phrases · v0.13.0

The heart saves the containing phrase: bars 1–8, 9–16, etc. It stores settings, explicit note/rhythm events for all four parts, eight per-bar chord records and the original source-bar offset. It is a written score, not recorded audio or an effects/tempo-automation recording.

Loading starts at the saved phrase's beginning. The first eight bars use the stored events directly; bar nine continues generation from `sourceBar + 8` using the saved settings/version. During a live edit, the current phrase's already-scheduled score sections and the planned next section are retained, so capturing does not recompose the earlier bars with the last slider value. The saved continuation settings come from the last planned section. Audio is rendered at the saved tempo rather than preserving a history of tempo gestures.

`Transport.window()` exposes clipped, immutable score/render plans; tick keeps only the current eight-bar history plus the pending section. At most one queued change per future bar is needed. The existing absolute audio clock and half-open scheduling intervals are unchanged.

The heart compares canonical settings and complete phrase data, not just a seed. It refreshes at phrase boundaries and score changes without rebuilding the favorites list every frame. Stopping leaves the last captured phrase available to save; starting again follows the player's selected start. Explicit composition edits recompose the saved opening at the next scheduled bar, while volume/reverb leave its notes intact.

## Storage and compatibility

- `worksong.favorites.v3` adds optional `phrase` to each existing favorite; item IDs, genre counters, display numbers and the 12-item limit are preserved.
- V2/V1 are read only as migration sources and kept as backups. A malformed V3 container falls back to valid V2 before V1. Invalid individual clips fall back to that favorite's settings.
- Legacy favorites without a clip retain their original generator version and start at bar zero. Their original listening position was never recorded and cannot be recovered.
- `worksong.selection.v1` atomically stores the selected settings and explicit opening. It is restored only when its settings match the current settings record. Shared settings links take precedence; subsequent manual selection/edit clears the old shared hash.
- The decoder limits clips to eight chords and 512 events, validates numeric ranges, layer/voice/instrument combinations and allowed optional fields, and discards unknown properties. Chord labels render as text, never HTML.
- Share links still contain settings, not local phrase data; the tooltip/toast describes them accordingly.

## Verification

49 unit/regression tests cover versions 1–7, serialized score replay, continuation offsets, independent copies, invalid data, muted written parts, historical timing fixtures and bounded current-phrase history.

Browser checks cover malformed V3 → V2 migration, preserved legacy number 17, separate first/second phrase saves, duplicate prevention, pending edits preserving earlier notes, stop-then-save, reload and recall, selected-phrase restoration on reload, and continuation beyond the frozen opening. A D&B case saved 148 events at source bar 8 and continued past source bar 16 with zero late events/errors. Layouts at 1440×900, 390×844 and 320×740 had no horizontal overflow; desktop/mobile screenshots were inspected.
