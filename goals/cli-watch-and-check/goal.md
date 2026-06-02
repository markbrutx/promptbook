# Goal: CLI watch & check

Фундамент dev-loop в `@markbrutx/promptbook-cli`: команда `promptbook watch` для автоматической пересборки `book.generated.ts` при правках фрагментов/правил/композиций, плюс три новых флага `bundle` — `--check` (проверка что артефакт в репо актуален), `--all` (одной командой по всему workspace), `--exclude-code-prompts` (не сериализовать code-prompts в runtime bundle, чтобы потребителям не приходилось хачить через `mv code-prompts /tmp/`). Никаких изменений в `@markbrutx/promptbook-core`, никаких новых публичных API, никаких domain-слов. Bump `promptbook-cli` до 0.4.0; публикация в npm — отдельным шагом после approve.

## Shared Understanding

См. [facts.md](./facts.md)

## Execution Plan

См. [plan.md](./plan.md)

## Done Condition

- `promptbook --help` показывает команду `watch` и флаги `bundle --check`, `--all`, `--exclude-code-prompts`
- `promptbook bundle --check` возвращает 0 на актуальном `book.generated.ts` и 1 на устаревшем или отсутствующем
- `promptbook bundle --all` пересобирает все книги в workspace; `--all -o file` падает с ошибкой
- `promptbook bundle --exclude-code-prompts` сериализует bundle без code-prompts
- `promptbook watch` запускается, делает initial bundle всех книг, реагирует на touch фрагмента в одной книге пересборкой только её, корректно завершается по SIGINT
- `npm run build && npm run typecheck && npm run test && npm run check` зелёные на root
- `packages/cli/README.md` и четыре скилла (`promptbook-install`, `promptbook-migrate`, `promptbook-doctor`, `promptbook-annotations`) обновлены без domain-слов
- `packages/cli/package.json` версия — `0.4.0`; `@markbrutx/promptbook-core` версия не тронута
