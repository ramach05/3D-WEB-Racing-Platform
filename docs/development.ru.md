# Руководство разработчика

[English](development.md) | [Русский](development.ru.md)

Всё, что нужно после клонирования репозитория: первый запуск, полный список команд, траблшутинг, прекоммит, правила кода и видеоматериалы. В README — только быстрый старт.

## Требования и первый запуск

- Node.js **22.12+** (проверяет `scripts/check-node.mjs`; на 22.10 падает Prisma 7). `.nvmrc` → 22.12.0.
- pnpm **10.15** (`packageManager` в корневом package.json).

```bash
nvm use
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @racing/api prisma:generate
pnpm ready-steady-go
```

`ready-steady-go` = сборка `@racing/shared` → `prisma migrate deploy && prisma db seed` → параллельный dev web+api.

## Матрица команд

| Команда                                 | Что делает                                                       |
| --------------------------------------- | ---------------------------------------------------------------- |
| `pnpm ready-steady-go`                  | Полный dev-цикл (shared → prisma → web+api)                      |
| `pnpm build`                            | Сборка всех пакетов                                              |
| `pnpm typecheck`                        | `tsc -b` по project references (+ build shared)                  |
| `pnpm lint`                             | ESLint по всем пакетам, `--max-warnings=0`                       |
| `pnpm format`                           | Prettier по всему репо (`format:check` — только проверка)        |
| `pnpm test`                             | API Vitest (unit) + web Vitest/RTL/MSW                           |
| `pnpm test:api` / `pnpm test:web`       | По одному пакету                                                 |
| `pnpm --filter @racing/api test:e2e`    | API e2e (supertest + реальное Nest-приложение, временная SQLite) |
| `pnpm test:e2e`                         | Playwright (алиас `pnpm e2e`)                                    |
| `pnpm test:all`                         | Все юнит/интеграционные + Playwright                             |
| `pnpm --filter @racing/web e2e:install` | Установить браузеры Playwright (нужно один раз)                  |

## Траблшутинг

| Симптом                                 | Решение                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Требуется Node.js 22.12+`              | `nvm use`                                                                                               |
| `Cannot find matching keyid` (corepack) | `corepack disable && npm install -g pnpm@10.15.0`                                                       |
| Нужен pnpm без глобальной установки     | `npx pnpm@10.15.0 <cmd>`                                                                                |
| Пропали seed-данные / изменилась схема  | `pnpm --filter @racing/api exec prisma migrate deploy && pnpm --filter @racing/api exec prisma db seed` |
| 401 после перезагрузки страницы         | Норма: access-токен живёт в памяти, восстановление через refresh-cookie                                 |

## Прекоммит

Husky + lint-staged (устанавливаются автоматически при `pnpm install` через `prepare`):

1. `lint-staged` по staged-файлам: `*.{ts,tsx}` — `eslint --fix --max-warnings=0` + `prettier --write`; прочие текстовые — `prettier --write`.
2. `pnpm typecheck` по всему проекту.

## Правила кода

Стиль зафиксирован в `eslint.config.js` и Prettier; новый код обязан проходить `pnpm lint` и `pnpm typecheck` без правок правил.

- Файлы и папки — только **kebab-case**; типы — в соседнем `*.types.ts`; тесты `*.test.ts(x)` лежат рядом с модулем.
- Type-алиасы — PascalCase с префиксом `T` (`TVehicleId`), интерфейсы — `I` (но предпочитаем `type`). Константы — `UPPER_SNAKE_CASE`.
- **Нет `any`/`unknown`** без крайней необходимости, нет function declaration (только стрелочные), нет default export.
- Импорты только через алиасы (`@/…`, `@racing/shared`) и **public API слайса** (`index.ts`); относительные через родителя запрещены. Исключение — слайс `race-canvas` (глубокие импорты внутри своего слайса).
- JSDoc `/** */` на **английском** для публичных функций/хуков/компонентов; `//` — для пояснений внутри тела.
- Nest-исключения: модули/контроллеры/сервисы/DTO — классы (DI и `class-validator`); методы с HTTP-декораторами — на прототипе (декоратор не вешается на стрелочное поле).
- FSD: слои `app → pages → widgets → features → entities → shared`, импорты только «вниз».

## Медиа: запись и обновление

Ролики лежат в `docs/video/` (в gitignore — исходники `.mov`, ролики для README — `.mp4`) и встроены в README как ссылки на github.com/user-attachments: GitHub показывает видеоплеер только в issues/PR, а mp4 из репозитория в markdown не воспроизводится. Поэтому в README — кликабельные постеры, открывающие опубликованный mp4.

Обновление после перезаписи: перетащить новый mp4 в редактор открытого issue/PR на github.com и **опубликовать комментарий** — user-attachments становятся публичными только после отправки комментария; пока он не отправлен, ссылка отдаёт 404 всем остальным (см. issue #5). Затем заменить старую ссылку `https://github.com/user-attachments/assets/…` в `README.md`, перегенерировать связанный постер в `docs/screenshots/video-posters/` и продублировать оба в `README.ru.md`.

Ролики: `race-1-desktop.mp4` (заезд Coastal Oval), `race-2-desktop.mp4` (Night City), `race-3-desktop.mp4` (Storm Eight), `menu-desktop.mp4` (обзор приложения), `race-1-mobile.mp4` / `menu-mobile.mp4` (телефон, вертикальный). Полный конвейер записи, конвертации и постеров — в истории git этого файла: `git log -p -- docs/development.ru.md`.

## Prisma

- Клиент генерируется в `apps/api/src/generated/prisma` — это сгенерированный код, вручную не правим.
- Схема — `apps/api/prisma/schema.prisma` (User, RefreshSession, Track, RaceResult); миграции в git не хранятся, разворачиваются `prisma migrate deploy` + `prisma db seed`.
- Если изменили схему — выполните `pnpm --filter @racing/api prisma:migrate`, затем используйте сгенерированные типы; общие контракты правьте в `packages/shared`.

## CI

`.github/workflows/ci.yml`: install → shared build → prisma generate → **lint → typecheck → migrate → test → build**. Перед push локально должны проходить те же проверки.

Число тестов в бейдже «Tests» и секции «Тесты» обоих README поддерживается вручную — при изменении набора тестов обновляйте цифры.
