# Development guide

[English](development.md) | [Русский](development.ru.md)

Supporting details for development: commands, troubleshooting, pre-commit, code rules, gameplay video recording. Deliberately kept out of the README.

## Requirements and first run

- Node.js **22.12+** (enforced by `scripts/check-node.mjs`; Prisma 7 breaks on 22.10). `.nvmrc` → 22.12.0.
- pnpm **10.15** (`packageManager` in the root package.json).

```bash
nvm use
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @racing/api prisma:generate
pnpm ready-steady-go
```

`ready-steady-go` = build `@racing/shared` → `prisma migrate deploy && prisma db seed` → run web + api in parallel.

## Command matrix

| Command                                 | What it does                                          |
| --------------------------------------- | ----------------------------------------------------- |
| `pnpm ready-steady-go`                  | Full dev cycle (shared → prisma → web+api)            |
| `pnpm build`                            | Build all packages                                    |
| `pnpm typecheck`                        | `tsc -b` over project references (+ build shared)     |
| `pnpm lint`                             | ESLint across packages, `--max-warnings=0`            |
| `pnpm format`                           | Prettier over the repo (`format:check` — verify only) |
| `pnpm test`                             | API Vitest (unit) + web Vitest/RTL/MSW                |
| `pnpm test:api` / `pnpm test:web`       | One package at a time                                 |
| `pnpm --filter @racing/api test:e2e`    | API e2e (supertest + real Nest app, temporary SQLite) |
| `pnpm test:e2e`                         | Playwright (alias `pnpm e2e`)                         |
| `pnpm test:all`                         | All unit/integration + Playwright                     |
| `pnpm --filter @racing/web e2e:install` | One-time: download Playwright browsers                |

## Troubleshooting

| Symptom                                 | Fix                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Требуется Node.js 22.12+` / Node error | `nvm use`                                                                                               |
| `Cannot find matching keyid` (corepack) | `corepack disable && npm install -g pnpm@10.15.0`                                                       |
| Need pnpm without global install        | `npx pnpm@10.15.0 <cmd>`                                                                                |
| Seed data gone / schema changed         | `pnpm --filter @racing/api exec prisma migrate deploy && pnpm --filter @racing/api exec prisma db seed` |
| 401 after page reload                   | Normal: the access token lives in memory and is refreshed via the refresh cookie                        |

## Pre-commit

Husky + lint-staged (installed automatically on `pnpm install` via `prepare`):

1. `lint-staged` over staged files: `*.{ts,tsx}` — `eslint --fix --max-warnings=0` + `prettier --write`; other text files — `prettier --write`.
2. `pnpm typecheck` across the whole project.

## Code rules

Style is locked in `eslint.config.js` and Prettier; new code must pass `pnpm lint` and `pnpm typecheck` without touching the rules.

- Files and folders are **kebab-case** only; types live in a sibling `*.types.ts`; tests are `*.test.ts(x)` next to the module.
- Type aliases — PascalCase with a `T` prefix (`TVehicleId`), interfaces — `I` (but prefer `type`). Constants — `UPPER_SNAKE_CASE`.
- **No `any`/`unknown`** without a hard need, no function declarations (arrow functions only), no default exports.
- Imports only via aliases (`@/…`, `@racing/shared`) and the **public API of a slice** (`index.ts`); relative parent imports are forbidden. Exception — the `race-canvas` slice (deep imports inside its own slice).
- JSDoc `/** */` in **English** on public functions/hooks/components; `//` for in-body notes.
- Nest exceptions: modules/controllers/services/DTOs are classes (DI and `class-validator`); HTTP-decorated methods sit on the prototype (a decorator won't attach to an arrow field).
- FSD: layers `app → pages → widgets → features → entities → shared`, imports only downward.

## Gameplay media

Current clips (`docs/video/`, gitignored — originals `.mov`, README clips `.mp4`; the READMEs embed the mp4s as github.com/user-attachments links, which is the only way GitHub autoplays video in markdown):

- `race-1-desktop.mp4` — hero: full Coastal Oval run, countdown → drift → finish (27 s)
- `race-2-desktop.mp4` — Night City run (22 s)
- `race-3-desktop.mp4` — Storm Eight run, rain and elevated deck (25 s)
- `menu-desktop.mp4` — app tour: home, garage, tracks, profile (32 s)
- `race-1-mobile.mp4` / `menu-mobile.mp4` — phone: touch controls, compact HUD (27/38 s, portrait)

Recording on macOS: `Cmd+Shift+5` → record portion, browser window fullscreen. Before recording: dev mode, light theme and EN — consistent with the README; keep the perf HUD in frame, it is part of the show. Audio: race clips carry the synthesized BGM/SFX, menu clips are silent (`-an`).

Conversion — 2-pass H.264 sized to fit GitHub's ~10 MB attachment limit (repo-relative mp4s do not play in markdown, and a repo file over 100 MB cannot be pushed at all):

```bash
# budget: video bps ≈ target_bytes*8/duration − 96000; drop "-c:a aac -b:a 96k" and add "-an" when silent
ffmpeg -i clip.mov -vf "scale=1920:-2:flags=lanczos,fps=60" -c:v libx264 -preset slow \
  -b:v 2600k -maxrate 3900k -bufsize 6500k -pix_fmt yuv420p -profile:v high -pass 1 -an -f mp4 /dev/null
ffmpeg -i clip.mov -vf "scale=1920:-2:flags=lanczos,fps=60" -c:v libx264 -preset slow \
  -b:v 2600k -maxrate 3900k -bufsize 6500k -pix_fmt yuv420p -profile:v high -pass 2 \
  -c:a aac -b:a 96k -movflags +faststart clip.mp4
```

Update flow after re-recording: edit `README.md` on github.com → drag the new mp4 into the editor → replace the `https://github.com/user-attachments/assets/REPLACE-<clip>` placeholder URL with the generated one (keep `README.ru.md` in sync); details in the comment at the top of each README.

## Prisma

- The client is generated into `apps/api/src/generated/prisma` — generated code, never hand-edited.
- Schema — `apps/api/prisma/schema.prisma` (User, RefreshSession, Track, RaceResult); migrations are not kept in git, they are applied with `prisma migrate deploy` + `prisma db seed`.
- Changed the schema → `pnpm --filter @racing/api prisma:migrate`, then reuse the generated types; shared contracts live in `packages/shared`.

## CI

`.github/workflows/ci.yml`: install → shared build → prisma generate → **lint → typecheck → migrate → test → build**. The same must be green locally before pushing.
