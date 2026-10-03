# Third-party notices — Kalavinka v0.9.0

The application code is governed by the root LICENSE. The following components
retain their original terms. These notices do not license the whole application
under the components' licenses.

## Mastermind — MIT

Copyright (c) 2026 Yakshawan.

The soft-knee peak curve in src/mastering.ts and visualization geometry adapted
in src/starfield.ts originate in the author's Mastermind project. The MIT notice
is retained in public/licenses/Mastermind-MIT.txt for those incorporated portions.

Source: https://github.com/heavyrain39/mastermind
Reference: e093056ac68593c25b48f132438ace0189b4d72d
Files: src/lib/dsp/limiter.js; src/features/mastering/VisualizerCard.tsx.

## Fonts — SIL Open Font License 1.1

Inter, JetBrains Mono and MuseoModerno are bundled locally through Fontsource
Variable packages. Fonts are unmodified. Their original copyright statements
and complete licenses are retained in public/licenses/Inter-OFL.txt,
public/licenses/JetBrainsMono-OFL.txt and public/licenses/MuseoModerno-OFL.txt.

Package source: https://github.com/fontsource/font-files
Exact installed versions are recorded in package-lock.json.

## Build tools

Vite, TypeScript, Playwright and tsx are development tools, not the application's
music engine. Their dependencies and package licenses are recorded by npm in
package-lock.json and their installed packages. The Vite module-preload helper
included in the generated JavaScript retains its MIT notice in
public/licenses/Vite-MIT.txt.

## Historical releases

Strudel and fraction.js are absent from the v0.9.0 dependency tree and browser
bundle. The previous v0.8.0 release used them; its notices remain in Git history
at commit 54cd8a16d6765179f6754547d4e75f3b21adcc2b. The transition does not
revoke any permissions previously granted for that release or its code.
