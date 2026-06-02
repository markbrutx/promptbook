# CLI watch & check — Facts

## Новые CLI команды

- `promptbook watch [<dir>]` существует и описана в `promptbook --help`
- `promptbook bundle --check` существует и описана в `promptbook --help`
- `promptbook bundle --all` существует и описана в `promptbook --help`
- `promptbook bundle --exclude-code-prompts` существует и описана в `promptbook --help`

## `watch` — что делает

- `promptbook watch` без аргументов берёт `promptsDir` из ближайшего `promptbook.json` (та же стратегия что у `bundle` / `ls`)
- `promptbook watch <dir>` следит за указанной папкой как за prompts-folder (single-book или multi-book workspace)
- При запуске сразу пересобирает `book.generated.ts` для каждой найденной книги (как `bundle --all`) и потом ждёт изменений
- При изменении файла внутри книги в одной из этих папок — пересобирает `book.generated.ts` именно для этой книги: `fragments/`, `rules/`, `compositions/`, `code-prompts/`, `promptbook.json`
- Игнорирует изменения в `book.generated.ts` (артефакт сборки), `*.test.ts`, `*.test.js`, `fixtures/`, любых файлах вне отслеживаемых папок книги
- Серия событий по одной книге в пределах 250 мс дебаунсится — один пересбор на пачку
- Несколько книг в одном workspace пересобираются независимо (затронуты A и B → собираются параллельно или последовательно, не блокируют друг друга)

## `watch` — вывод

- stdout пустой (контракт IO промптбука: stdout = payload; у watch payload нет)
- stderr: при старте печатает одну строку со списком книг, за которыми следит
- stderr: на каждый успешный пересбор печатает одну строку `[HH:MM:SS] <book> bundled (<bytes> B, <ms>ms)`
- stderr: на ошибку пересбора печатает одну строку с тегом `ERROR` и одной строкой подсказки CLI, watcher продолжает работать
- Honor `NO_COLOR` — без ANSI escape когда `NO_COLOR` выставлен

## `watch` — флаги и поведение

- `--out <file>` поддерживается: по умолчанию каждая книга пишет в `<bookDir>/book.generated.ts`; с `--out` пишет в указанный файл (одиночная книга обязательна)
- `--plain` поддерживается с той же семантикой что у `bundle --plain`
- `--exclude-code-prompts` поддерживается с той же семантикой что у `bundle --exclude-code-prompts`
- `--json` отключает форматирование строк-событий и печатает на stderr JSON-объекты по одному на строку (`{ "event": "bundled", "book": "...", "bytes": ..., "ms": ... }` / `{ "event": "error", "book": "...", "message": "..." }`)
- SIGINT и SIGTERM корректно завершают watcher (закрывают подписку, печатают финальную строку, выходят с кодом 0)
- Watcher не падает на единичной ошибке сборки и не выходит сам по таймауту

## `bundle --check`

- Без `--check` поведение `bundle` не меняется
- С `--check` команда собирает книгу в память и сравнивает с лежащим рядом `book.generated.ts` (или с файлом из `--out`)
- Совпало — exit 0, на stderr строка `<book> up to date`
- Не совпало — exit 1, на stderr строка `<book> stale` и краткий хинт что отличается (например, номер первой различающейся строки и количество строк-отличий)
- В `--json` режиме результат печатается как JSON-объект `{ "book": "...", "status": "up-to-date" | "stale", "diff": { ... } | null }`
- Целевой файл отсутствует — считается stale (exit 1) с пояснением `missing`

## `bundle --all`

- Без `--all` поведение `bundle` не меняется (одна книга)
- С `--all` пересобирает все книги в workspace последовательно
- В сочетании с `--check` проходит по всем книгам, если хоть одна stale — exit 1
- В сочетании с `-o`/`--out` отказывается работать с ошибкой (несовместимые флаги: при `--all` каждая книга пишет в свой `<bookDir>/book.generated.ts`)

## `bundle --exclude-code-prompts`

- Без флага `book.codePrompts` сериализуется в output как раньше
- С флагом `book.codePrompts` сериализуется как пустая `Map` (или пустой массив в JSON) и в файле нет ни одной строки с code-prompt'овским содержимым
- Это позволяет хранить `code-prompts/` как metadata для `ls`/`view` без раздувания runtime-бандла, не требуя от потребителя ручных хаков (`mv code-prompts /tmp`)
- Флаг работает совместно с `--all`, `--check`, `--plain`

## Архитектурные инварианты — не нарушаются

- Core (`packages/core`) не получает новых зависимостей и не получает CLI-импортов
- Зависимость остаётся однонаправленной: `cli → core`
- `resolve` / `lint` / `load` / `interpolate` остаются детерминированными и чистыми (watch живёт целиком в CLI)
- Никаких моделей watch не дёргает (контракт determinism)
- Никаких domain-слов (`roast`/`resume`/`voice`/`paywall`/...) в коде, тестах, документации
- Synthetic fixture vocabulary (`assistant` / `summarizer` / `digest-table`) используется во всех новых примерах и тестах

## Зависимости

- Watch использует `chokidar@^4` как production-зависимость пакета `@markbrutx/promptbook-cli`
- Никакие другие новые зависимости не добавляются (ни в `cli`, ни в `core`, ни в `viewer`, ни в `openrouter`)
- `engines.node` остаётся `>=20.6` для `@markbrutx/promptbook-cli`
- На macOS, Linux, Windows watch работает одинаково (chokidar абстрагирует platform-специфику)

## Документация

- `packages/cli/README.md` обновлён: блок Commands упоминает `watch`, и блок флагов `bundle` упоминает `--check`, `--all`, `--exclude-code-prompts` с короткими описаниями
- `README.md` корня репо обновлён в части CLI-поверхности (если она там перечислена), чтобы не разъехалось с `packages/cli/README.md`
- Никакого отдельного `docs/` файла под dev-loop в этом goal-е не создаётся (одна страница `README.md` достаточно)

## Скиллы (`skills/<name>/SKILL.md`)

- `skills/promptbook-install/SKILL.md` упоминает `promptbook watch` как нормальный dev-цикл после установки (а не ручной `bundle` после каждой правки)
- `skills/promptbook-install/SKILL.md` упоминает `promptbook bundle --check` (и/или `--check --all`) как CI-гейт против устаревшего `book.generated.ts`
- `skills/promptbook-install/SKILL.md` упоминает `--exclude-code-prompts` как опцию когда `code-prompts/` хранится только для метаданных и не должен попадать в runtime bundle
- `skills/promptbook-migrate/SKILL.md` описывает новый dev-цикл (watch) в шагах после первичной миграции, чтобы агент-мигратор не учил пользователя ручному `bundle`
- `skills/promptbook-migrate/SKILL.md` упоминает `--exclude-code-prompts` для миграций, где computed prompts остаются как code-prompts metadata, но не в runtime bundle
- `skills/promptbook-doctor/SKILL.md` использует `bundle --check --all` как часть аудита freshness (а не вместо проверок, а в дополнение — простой sanity-чек перед глубоким анализом)
- `skills/promptbook-annotations/SKILL.md` упоминает что `watch` + `view` хорошо сочетаются для live-цикла «правка → viewer обновляется → новая аннотация» (одна короткая ссылка, без переписывания скилла)
- Никаких новых скиллов в этом goal-е не создаётся
- Никаких изменений в `references/` и `evals/` подпапках скиллов в этом goal-е не делается

## Тесты

- Unit-тесты на `args.ts` покрывают: `watch` как команду, `--check`, `--all`, `--exclude-code-prompts`
- Integration-тест на `bundle --check`: актуальный bundle → exit 0; устаревший bundle → exit 1 с поясняющей строкой; отсутствующий файл → exit 1 со словом `missing`
- Integration-тест на `bundle --exclude-code-prompts`: книга с code-prompts → output не содержит code-prompt данных
- Integration-тест на `bundle --all`: workspace с двумя книгами → обе пересобраны; одна книга stale в `--check` → exit 1 с её именем
- Integration-тест на `bundle --all -o file`: ошибка совмещения, exit 1
- Smoke-тест на `watch`: запуск во временный каталог с двумя книгами, touch одного фрагмента, проверка что соответствующий `book.generated.ts` обновился; SIGINT гасит процесс корректно
- Существующие тесты (`bundle` без флагов, `lint`, `resolve`, `ls`, `eval`) остаются зелёными без изменений
- `npm run build · typecheck · test · check` зелёный на root и в каждом workspace

## Версионирование и релиз

- В рамках этого goal-а: bump минорной версии `@markbrutx/promptbook-cli` (0.3.x → 0.4.0), потому что добавляются новые публичные команды и флаги
- `@markbrutx/promptbook-core` версия НЕ меняется (его поверхность не меняется)
- Этот goal НЕ публикует в npm; публикация — отдельный шаг после approve

## Не в скоупе

- Никакого изменения `resolve`, `lint`, `ls`, `eval`, `view`, `annotations`
- Никаких кросс-книжных shared-фрагментов
- Никакого hook-механизма для пользовательских pre-bundle скриптов (типа `_generate.ts`)
- Никакого автозапуска `parity.test.ts` или любых пользовательских тестов из watch
- Никакого изменения работы `code-prompts/` кроме нового флага `--exclude-code-prompts`
- Никакого подключения новых фич в потребителях (это отдельный downstream goal в каждом потребителе)
- Никакого изменения публичного API `@markbrutx/promptbook-core`
- Никаких новых скиллов; правки только в существующих четырёх и только там где описан dev-цикл / bundle
- Никакого синка скиллов в downstream-копии (например, в `~/pet/roasted.cv/.agents/skills/`) — отдельный downstream goal
