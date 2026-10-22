# Development guide

[English](development.md) | [Русский](development.ru.md)

Вспомогательные детали для разработки: команды, траблшутинг, прекоммит, правила кода, запись геймплейного видео. В README сознательно не вошло.

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
| `pnpm --filter @racing/web e2e:install` | Один раз: скачать браузеры Playwright                            |

## Траблшутинг

| Симптом                                 | Решение                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Требуется Node.js 22.12+`              | `nvm use`                                                                                               |
| `Cannot find matching keyid` (corepack) | `corepack disable && npm install -g pnpm@10.15.0`                                                       |
| Нужен pnpm без глобальной установки     | `npx pnpm@10.15.0 <cmd>`                                                                                |
| Пропали seed-данные / изменилась схема  | `pnpm --filter @racing/api exec prisma migrate deploy && pnpm --filter @racing/api exec prisma db seed` |
| 401 после перезагрузки страницы         | Норма: access-токен в памяти, поднятие через refresh-cookie                                             |

## Прекоммит

Husky + lint-staged (ставится автоматически при `pnpm install` через `prepare`):

1. `lint-staged` по staged-файлам: `*.{ts,tsx}` — `eslint --fix --max-warnings=0` + `prettier --write`; прочие текстовые — `prettier --write`.
2. `pnpm typecheck` по всему проекту.

## Правила кода

Стиль зафиксирован в `eslint.config.js` и Prettier; новый код обязан проходить `pnpm lint` и `pnpm typecheck` без правок правил.

- Файлы и папки — только **kebab-case**; типы в `*.types.ts` рядом; тесты `*.test.ts(x)` лежат рядом с модулем.
- Type-алиасы — PascalCase с префиксом `T` (`TVehicleId`), интерфейсы — `I` (но предпочитаем `type`). Константы — `UPPER_SNAKE_CASE`.
- **Нет `any`/`unknown`** без крайней необходимости, нет function declaration (только стрелочные), нет default export.
- Импорты только через алиасы (`@/…`, `@racing/shared`) и **public API слайса** (`index.ts`); относительные через родителя запрещены. Исключение — слайс `race-canvas` (глубокие импорты внутри своего слайса).
- JSDoc `/** */` на **английском** для публичных функций/хуков/компонентов; `//` — для пояснений внутри тела.
- Nest-исключения: модули/контроллеры/сервисы/DTO — классы (DI и `class-validator`); методы с HTTP-декораторами — на прототипе (декоратор не вешается на стрелочное поле).
- FSD: слои `app → pages → widgets → features → entities → shared`, импорты только «вниз».

## Медиа: запись и обновление

Текущие ролики (`docs/video/`, в gitignore — исходники `.mov`, ролики для README `.mp4`; GitHub рендерит видеоплеер только в issues/PR, но не внутри markdown-файлов, поэтому в README — кликабельные постеры, открывающие mp4, опубликованный как github.com/user-attachments ассет):

- `race-1-desktop.mp4` — главное: полный заезд Coastal Oval, отсчет → занос → финиш (27 с)
- `race-2-desktop.mp4` — заезд Night City (22 с)
- `race-3-desktop.mp4` — заезд Storm Eight, дождь и эстакада (25 с)
- `menu-desktop.mp4` — обзор приложения: home, garage, tracks, profile (32 с)
- `race-1-mobile.mp4` / `menu-mobile.mp4` — телефон: тач-контроли, компактный HUD (27/38 с, вертикальное)

Запись на macOS: `Cmd+Shift+5` → record portion, окно браузера на весь экран. Перед записью: dev-режим, светлая тема и EN — в едином стиле с README; perf-HUD оставить в кадре — это часть продакшена демо. Звук: в рейс-роликах — синтезированные BGM/SFX, в menu-роликах тишина (`-an`).

Конвертация — 2-pass H.264 под лимит вложений GitHub ~10 МБ (mp4 по относительному пути из репо в markdown не играется, а файл тяжелее 100 МБ вообще не запушится):

```bash
# бюджет: видеобитрейт ≈ target_bytes*8/длительность − 96000; для тихой записи "-c:a aac -b:a 96k" убрать, добавить "-an"
ffmpeg -i clip.mov -vf "scale=1920:-2:flags=lanczos,fps=60" -c:v libx264 -preset slow \
  -b:v 2600k -maxrate 3900k -bufsize 6500k -pix_fmt yuv420p -profile:v high -pass 1 -an -f mp4 /dev/null
ffmpeg -i clip.mov -vf "scale=1920:-2:flags=lanczos,fps=60" -c:v libx264 -preset slow \
  -b:v 2600k -maxrate 3900k -bufsize 6500k -pix_fmt yuv420p -profile:v high -pass 2 \
  -c:a aac -b:a 96k -movflags +faststart clip.mp4
```

Постеры (коммитятся в `docs/screenshots/video-posters/`): реальный кадр каждого ролика — брать середину заезда (у рейс-роликов ~70-75% длительности, после отсчета; у menu-роликов — лидерборд; у мобильного заезда — кадр с тач-контролями):

```bash
ffmpeg -ss <секунды> -i clip.mp4 -frames:v 1 -vf scale=640:-2 -y poster.png   # вертикальные: scale=379:-2
```

Бейдж воспроизведения поверх: Pillow рисует центральный круг `rgba(12,12,20,175)` (радиус ≈ 19% короткой стороны) с белым кольцом и белым треугольником на оверлее с 4-кратным суперсэмплированием, даунсэмпл Lanczos. Ширины совпадают с thumbs скриншотов ниже (640/379), чтобы секции читались как одна галерея.

Обновление после перезаписи: перетащить новый mp4 в редактор открытого issue/PR на github.com и **опубликовать комментарий** — user-attachments становятся публичными только вместе с отправленным комментарием, неотправленные отдают 404 для всех остальных (см. issue #5) → заменить старую ссылку `https://github.com/user-attachments/assets/…` в `README.md`, перегенерировать связанный постер и продублировать оба в `README.ru.md`; подробности в комментарии в начале каждого README.

## Prisma

- Клиент генерируется в `apps/api/src/generated/prisma` — сгенерированный код, руками не правим.
- Схема — `apps/api/prisma/schema.prisma` (User, RefreshSession, Track, RaceResult); миграции в git не хранятся, разворачиваются `prisma migrate deploy` + `prisma db seed`.
- Изменили схему → `pnpm --filter @racing/api prisma:migrate`, затем переиспользуйте сгенерированные типы; общие контракты правьте в `packages/shared`.

## CI

`.github/workflows/ci.yml`: install → shared build → prisma generate → **lint → typecheck → migrate → test → build**. Локально должно быть зеленым то же самое перед push.
