# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-22

First public release: a browser time-trial 3D racer with a full-stack backend.

### Added

- **Race core** — three tracks (Coastal Oval, Night City, Storm Eight), each with its own weather, palette and synthesized music theme; multi-lap format with ordered checkpoints, dynamic obstacles and oil slicks.
- **Physics** — arcade handling on Rapier WASM: fixed 1/60 step, framerate-independent input, handbrake drift, per-surface grip (asphalt / kerb / offroad).
- **Garage** — 5 GLB bodies at real-world class scale with live preview; paint adapts to the selected track.
- **Graphics** — procedural canvas textures, sun/moon shadows following the car, skid marks, tire smoke, three cameras (chase / bumper / TV), Bloom + Vignette post-FX on the night track.
- **Audio** — 100% runtime synthesis via Web Audio API: per-track chip-rock BGM, SFX and rain ambience; zero audio files shipped.
- **Auth** — 15-min access JWT kept in memory only; opaque refresh token in a path-scoped httpOnly cookie, stored as a SHA-256 hash with rotation and theft detection (reuse revokes all sessions).
- **Leaderboards & profile** — server-side per-track leaderboards, guest mode with local bests, aggregate stats and 6 achievements.
- **UX** — i18n (EN/RU), light/dark theme, mobile touch controls and responsive layouts, keyboard-operable menus with focus trapping.
- **Perf HUD** — in-game FPS, main-thread busy % and JS heap readouts.
- **Tooling** — pnpm monorepo with Feature-Sliced Design boundaries enforced by ESLint; 572 Vitest tests, 5 Playwright flows, CI gates `lint → typecheck → migrate → test → build`.

[1.0.0]: https://github.com/ramach05/3D-WEB-Racing-Platform/releases/tag/v1.0.0
