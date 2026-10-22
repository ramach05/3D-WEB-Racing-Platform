# Development guide

[English](development.md) | [Русский](development.ru.md)

Everything needed after cloning the repo: first run, the full command list, troubleshooting, pre-commit, code rules and the video assets. The README keeps only the quick start.

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

Race/menu clips live in `docs/video/` (gitignored — source `.mov`, README clips `.mp4`) and are embedded in the READMEs as github.com/user-attachments links: GitHub renders a video player only in issues/PRs and never plays a repo mp4 inside markdown, so the READMEs use clickable posters that open the hosted mp4.

Update flow after re-recording: drag the new mp4 into any open issue/PR editor on github.com and **submit the comment** — user-attachments go public only with a submitted comment, unpublished uploads 404 for everyone else (see issue #5) → replace the old `https://github.com/user-attachments/assets/…` URL in `README.md` → regenerate the linked poster in `docs/screenshots/video-posters/` → mirror both in `README.ru.md`.

Clips: `race-1-desktop.mp4` (Coastal Oval run), `race-2-desktop.mp4` (Night City), `race-3-desktop.mp4` (Storm Eight), `menu-desktop.mp4` (app tour), `race-1-mobile.mp4` / `menu-mobile.mp4` (phone, portrait). The full recording / ffmpeg / poster pipeline behind them is kept in this file's git history: `git log -p -- docs/development.md`.

## Prisma

- The client is generated into `apps/api/src/generated/prisma` — generated code, never hand-edited.
- Schema — `apps/api/prisma/schema.prisma` (User, RefreshSession, Track, RaceResult); migrations are not kept in git, they are applied with `prisma migrate deploy` + `prisma db seed`.
- Changed the schema → `pnpm --filter @racing/api prisma:migrate`, then reuse the generated types; shared contracts live in `packages/shared`.

## CI

`.github/workflows/ci.yml`: install → shared build → prisma generate → **lint → typecheck → migrate → test → build**. The same must be green locally before pushing.

The `Tests` badge and the Testing section of both READMEs carry the test count by hand — update the numbers when the suite changes.
