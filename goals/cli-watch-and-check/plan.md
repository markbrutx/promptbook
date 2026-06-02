# CLI watch & check — Plan

## Подход

Четыре фичи в одном пакете `@markbrutx/promptbook-cli`, идут отдельными шагами в порядке зависимости. `--exclude-code-prompts` — самый изолированный, идёт первым. Затем `--check`, затем `--all`. `watch` — последний, использует предыдущие три кирпича: для каждой затронутой книги вызывает ту же ветку `bundle`, что и пользователь руками. Core (`packages/core`) не трогаем. Vocabulary везде синтетический (`assistant` / `summarizer` / `digest-table`), никаких domain-слов.

## Шаги

### 1. `bundle --exclude-code-prompts`

**Файлы:** `packages/cli/src/args.ts`, `packages/cli/src/commands/bundle.ts`, `packages/cli/src/run.ts`, `packages/cli/test/commands/bundle.test.ts`

- В `args.ts` добавить поле `excludeCodePrompts: boolean` и парсинг опции `--exclude-code-prompts` (`type: "boolean"`)
- В `bundle.ts` перед `serializeBook` / `serializeBookJson`: если `args.excludeCodePrompts` — клонировать `book` с заменой `codePrompts` на пустую `Map` (`{ ...book, codePrompts: new Map() }`)
- В `run.ts` дополнить блок Options в HELP строкой `--exclude-code-prompts  bundle: omit code-prompts from the serialized output`
- Тест в `bundle.test.ts`: загрузить fixture-книгу с одним code-prompt'ом → без флага в output есть имя code-prompt; с флагом — нет

**Проверка:** `npm -w @markbrutx/promptbook-cli run typecheck && npm -w @markbrutx/promptbook-cli run test`. Ручной smoke: `node packages/cli/bin/promptbook bundle <test-book> --json` vs `--exclude-code-prompts --json`.

### 2. `bundle --check`

**Файлы:** `packages/cli/src/args.ts`, `packages/cli/src/commands/bundle.ts`, `packages/cli/src/run.ts`, `packages/cli/test/commands/bundle.test.ts`

- В `args.ts` добавить поле `check: boolean` и опцию `--check` (`type: "boolean"`)
- В `bundle.ts`: если `args.check` — собрать `output` как обычно, определить целевой путь (если `--out` задан — он; иначе `<promptsDir>/book.generated.ts`), прочитать существующий файл через `io.fs.readFile`. Сравнить строкой. Совпало → stderr `<bookName> up to date`, return 0. Не совпало → stderr `<bookName> stale` + первая разная строка (`first diff at line N`), return 1. Целевого файла нет → stderr `<bookName> stale (missing <path>)`, return 1
- В `--json` режим внутри `--check`: вместо строк печатать JSON-объект `{ "book": "...", "status": "up-to-date" | "stale", "diff": null | { "firstDiffLine": N, "reason": "..." } }` на stderr (stdout остаётся пустым, контракт `--check` — это статус, не payload)
- В `run.ts` дополнить HELP: `--check                 bundle: compare with the existing output; exit 1 on drift`
- Тесты: (a) актуальный → exit 0; (b) подменить один байт в `book.generated.ts` → exit 1 с `stale`; (c) удалить файл → exit 1 с `missing`

**Проверка:** `npm -w @markbrutx/promptbook-cli run test`. Ручной smoke на свежей fixture-книге.

### 3. `bundle --all`

**Файлы:** `packages/cli/src/args.ts` (флаг уже есть), `packages/cli/src/commands/bundle.ts`, `packages/cli/src/run.ts`, `packages/cli/test/commands/bundle.test.ts`

- Флаг `all` уже определён в `args.ts` (используется в `ls`/`resolve`)
- В `bundle.ts`: на входе проверить — если `args.all` и `args.out` оба заданы → stderr `error: --all is not compatible with -o/--out`, return 1
- Если `args.all`: использовать `loadWorkspace(io, rootDir)` из `workspace.ts` (rootDir — это `requirePromptsDir(io, args.operands[0] ?? args.dir)`), для каждой книги вызвать единый внутренний хелпер `bundleOne(book.dir, args, io)` и собирать exit-коды; итоговый exit — `max(codes)`
- Внутренний хелпер `bundleOne` инкапсулирует текущую логику команды (load → portableBook → optionally exclude code-prompts → serialize → write-or-check)
- В `run.ts` дополнить HELP: пометить, что `--all` теперь поддерживает и `bundle` (`--all  ls/resolve/bundle: span every book in the workspace`)
- Тесты: workspace с двумя книгами в tmpdir → `bundle --all` создаёт оба `book.generated.ts`; одна книга с подменённым байтом + `--all --check` → exit 1 с её именем; `--all -o file` → exit 1 с error

**Проверка:** `npm -w @markbrutx/promptbook-cli run test`. Ручной smoke: соорудить workspace из двух fixture-книг и проверить `bundle --all` + `bundle --all --check`.

### 4. `watch` команда

**Файлы новые:** `packages/cli/src/commands/watch.ts`, `packages/cli/test/commands/watch.test.ts`
**Файлы правки:** `packages/cli/src/args.ts`, `packages/cli/src/run.ts`, `packages/cli/package.json`

- В `package.json` (workspace `@markbrutx/promptbook-cli`) добавить `chokidar` в `dependencies` версии `^4.0.3` (без peer на fsevents — `@4` имеет минимальный footprint)
- В `args.ts` парсер не требует новых флагов — `watch` уже примет `--dir`, `--plain`, `--exclude-code-prompts`, `--out`, `--json` через существующую общую схему; добавить только проверку валидности комбинаций в самой команде
- В `run.ts` добавить `case "watch": return cmdWatch(args, io)` и блок HELP `watch                   Rebuild book.generated.ts as fragments/rules/compositions change`
- В `watch.ts`:
  - `cmdWatch(args, io)`: вызвать `requirePromptsDir`, потом `loadWorkspace(io, rootDir)`. Если `args.out` задан и книг больше одной → stderr `error: --out requires a single book`, return 1
  - Initial pass: для каждой книги вызвать `bundleOne` (тот же хелпер из шага 3) и напечатать результат
  - `chokidar.watch(rootDir, { ignored, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 50 } })` где `ignored` — array of patterns: `**/book.generated.ts`, `**/*.test.{ts,js}`, `**/fixtures/**`, `**/node_modules/**`, `**/.git/**`, файлы вне известных папок книги (`fragments/`, `rules/`, `compositions/`, `code-prompts/`, `promptbook.json`)
  - На каждое событие: найти затронутую книгу (та, чей `book.dir` — префикс `eventPath`), поставить/переустановить debounce-таймер 250 мс для этой книги; по таймеру — вызвать `bundleOne` и напечатать строку результата на stderr
  - SIGINT и SIGTERM: `watcher.close()`, напечатать `\nstopped\n` на stderr, `return 0`. Глобальное промисное API: `cmdWatch` возвращает Promise, который резолвится только когда watcher закрыт
  - Формат stderr-строк: `[HH:MM:SS] <book> bundled (<bytes> B, <ms>ms)` для успеха; `[HH:MM:SS] <book> ERROR: <message>` для ошибки. С `--json` — JSON-объект на строку: `{ "ts": "...", "event": "bundled"|"error", "book": "...", ... }`
  - `NO_COLOR`: использовать `colorEnabled(io)` из `io.ts`; цвет применяется только к тегу `ERROR` и времени
- Тест в `watch.test.ts`: создать tmpdir с двумя книгами (минимальные fixtures), запустить `cmdWatch` в отдельном Promise, дождаться initial bundle, touch файла во первой книге, дождаться следующего bundled-события (через подмену `io.stderr` на буфер), послать SIGINT через `process.emit`. Тест проверяет: (a) initial bundle сделан для обеих книг, (b) после touch — пересборка только первой, (c) SIGINT корректно завершает

**Проверка:** `npm -w @markbrutx/promptbook-cli run typecheck && npm -w @markbrutx/promptbook-cli run test`. Ручной smoke: в tmpdir с двумя книгами `node packages/cli/bin/promptbook watch`, поправить фрагмент, увидеть строку bundled, нажать Ctrl-C.

### 5. README и HELP

**Файлы:** `packages/cli/README.md`, `README.md` корня (если перечисляет CLI), `packages/cli/src/run.ts` (HELP уже обновлён в шагах 1–4)

- В `packages/cli/README.md` блок `## Commands` добавить строку `promptbook watch                        # rebuild book.generated.ts on every fragment/rule edit`
- В блоке Options добавить новые флаги bundle: `--check`, `--all` (расширение применимости), `--exclude-code-prompts`
- В корневом `README.md` поискать список CLI-команд (`grep -nE 'promptbook (resolve|lint|bundle|view)' README.md`). Если есть — обновить, чтобы не разошлось с CLI README
- Vocabulary: примеры используют `assistant` / `summarizer` / `digest-table`

**Проверка:** `npm run build` зелёный (доки не компилируются, но lint markdown'а через biome может задеть — `npm run check`); `node packages/cli/bin/promptbook --help` показывает новые флаги и команду.

### 6. Скиллы

**Файлы:**
- `skills/promptbook-install/SKILL.md`
- `skills/promptbook-migrate/SKILL.md`
- `skills/promptbook-doctor/SKILL.md`
- `skills/promptbook-annotations/SKILL.md`

- В `promptbook-install/SKILL.md`: после раздела про первичную установку добавить короткий блок «Dev loop» — `promptbook watch` запускает фоновую пересборку, `promptbook bundle --check --all` в CI ловит незакоммиченный артефакт, `--exclude-code-prompts` если `code-prompts/` хранятся для viewer а не для runtime
- В `promptbook-migrate/SKILL.md`: после раздела про первичную миграцию (где сейчас рекомендуется руками гонять `bundle` после каждой правки) — заменить рекомендацию на `promptbook watch` для итеративной фазы; упомянуть `--exclude-code-prompts` для случая когда мигратор оставляет computed prompts как code-prompt metadata
- В `promptbook-doctor/SKILL.md`: в начало workflow добавить шаг «sanity: `promptbook bundle --check --all` — все ли книги up-to-date в репо» как дешёвый предварительный чек перед глубоким аудитом
- В `promptbook-annotations/SKILL.md`: добавить одну строку про то, что `watch` + `view` хорошо работают параллельно: правка фрагмента → автоматический rebundle → viewer показывает новый assembly → новая аннотация
- Vocabulary тот же синтетический

**Проверка:** `grep -nE 'bundle|watch|check|exclude-code-prompts' skills/*/SKILL.md` — каждая правка видна; вычитать diff'ы глазами, никаких domain-слов

### 7. Версия пакета

**Файлы:** `packages/cli/package.json`

- Сменить `"version": "0.3.x"` на `"version": "0.4.0"`
- `@markbrutx/promptbook-core` версию НЕ менять
- `@markbrutx/promptbook-viewer` и `@markbrutx/promptbook-openrouter` НЕ менять
- Зависимость `chokidar` уже добавлена в шаге 4

**Проверка:** `cat packages/cli/package.json | grep version`. Не публикуем (публикация — отдельный шаг после approve).

### 8. Финальная сводка

- `npm run build` зелёный на root
- `npm run typecheck` зелёный на root
- `npm run test` зелёный на root (включая новые тесты)
- `npm run check` зелёный на root (biome + knip)
- Все существующие тесты `bundle`, `lint`, `resolve`, `ls`, `eval`, `view`, `annotations` остаются зелёными
- В описании коммита одна короткая строка по теме каждого шага (не batch-commit)

## Риски

- **chokidar на Linux**: в `chokidar@4` по умолчанию native `fs.watch`, fsevents как opt-in на macOS. Polling fallback не требуется при Node 20.6+, потому что recursive `fs.watch` на macOS работает нативно. На Linux рекурсивная подписка может не сработать на старых ядрах — chokidar решает это сам, подписываясь на каждую подпапку явно. Если у пользователя тысячи фрагментов — упрётся в `inotify` watch limit; смягчение — игнорировать `node_modules`, `.git`, `fixtures` уже в `ignored`
- **`--check` diff формат**: для длинных bundles вывод первой различающейся строки может оказаться нечитаем (длинная сериализованная Map). Решение: печатать только номер строки и количество отличающихся строк; полный diff — задача `git diff` после `bundle`
- **`watch` initial pass vs существующий бандл**: на старте watcher пересобирает все книги. Если до этого пользователь руками поправил `book.generated.ts` (что неправильно, но возможно) — он будет затёрт. Это правильное поведение (источник истины — фрагменты), но стоит упомянуть в README
- **chokidar как новая прод-зависимость**: добавляет ~30 KB к установке CLI. CLAUDE.md говорит «zero CLI/UI deps» только про `core`. CLI уже зависит от `@markbrutx/promptbook-openrouter` и опционально от `@markbrutx/promptbook-viewer` — добавление одной runtime-зависимости укладывается в стиль
- **`fsevents` peer на macOS**: chokidar v4 не подтягивает fsevents автоматически; recursive watch через `fs.watch` работает на macOS из коробки. Если кто-то захочет максимум производительности — отдельный goal по добавлению `fsevents` как optionalDependency
- **`bundle --check` ложно-stale из-за EOL**: если `book.generated.ts` коммитнули с CRLF а сборка генерит LF (или наоборот) — `--check` будет постоянно стабильно false. Смягчение: сравнение после нормализации EOL (`\r\n` → `\n`); этот пункт явно покрыть тестом
- **Версия чорно**: bump до 0.4.0 на новые публичные команды — это semver-aware, но если есть downstream проекты с pinned 0.3.x — они не получат фичи без bump. Это нормально, downstream обновится по запросу
- **Synthetic vocabulary leak**: legko случайно написать в README или скилле `roast` / `voice`. Мера — после каждого правленого файла прогнать `rg -nE '\b(roast|resume|voice|paywall|wizard|writer|final|reaction|hh)\b' <file>` и убедиться что нет совпадений в новых строках
