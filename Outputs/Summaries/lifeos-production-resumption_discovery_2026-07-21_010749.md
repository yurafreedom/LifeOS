Report saved to: `Outputs/Discoveries/lifeos-production-resumption_discovery_2026-07-21_010749.md`

DISCOVERY for Life OS production resumption

Вердикт: повний візуальний rewrite не потрібен. Це вже великий React-прототип: 15 маршрутів, RU/UA, 3 теми, централізований стан, фінанси, задачі, нотатки, цілі та ліки.

До production він ще не готовий: React/Babel працюють із CDN у браузері, 51 JSX-скрипт завантажується вручну, немає `package.json`, build, API, auth, CI/CD, серверної конфігурації чи повноцінних тестів.

Дані зараз живуть лише в `localStorage`. Розміщення на VPS дасть URL, але не дасть синхронізації між пристроями, серверних backup або захищеного акаунта.

Рекомендований напрям: зберегти UI/CSS/assets і перенести їх у стандартний production React build; backend додавати лише після рішення, чи потрібен multi-device режим.

У working tree є незавершений незакомічений Batch 1 (`+533/-265`) і попередній не затверджений Plan. Його не можна непомітно змішувати з production-міграцією.

`AGENTS.md` та `CLAUDE.md` помилково описують інший Python/FastAPI-проєкт; це окремий високий процесний ризик.

Для Phase B потрібні рішення: local-only чи server-backed; один користувач чи акаунти; спочатку завершити Batch 1 чи production foundation; який VPS/domain доступний.

Full: Outputs/Discoveries/lifeos-production-resumption_discovery_2026-07-21_010749.md
