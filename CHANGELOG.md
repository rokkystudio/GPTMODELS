# CHANGELOG

## 1.3.3 — 2026-09-24

- `UI Chat / Work` больше не завершает переключение ошибкой, когда React dispatcher не найден: включается визуальная проекция текущей поверхности на уже отрисованный composer.
- Визуальная проекция помечает composer, меняет placeholder поля ввода, добавляет бейдж `Work UI` / `Chat UI` к model picker и подсвечивает action button; MutationObserver пере применяет эффект после React-render.
- Fetch-поля и persisted surface preference продолжают синхронизироваться отдельно, без reload, URL navigation, branch, handoff или серверной конвертации conversation.

## 1.3.2 — 2026-09-24

- Поиск React Chat/Work dispatcher расширен с одной Fiber-цепочки composer до набора anchors и React root tree, чтобы переключение не зависело от текущего DOM-расположения штатного state.
- Поддержаны production-ключи `__reactFiber$`, `__reactInternalInstance$` и `__reactContainer$`; диагностика ошибки теперь показывает rendered mode, количество anchors и React roots.
- Определение текущего composer использует дополнительные селекторы `form[data-type="unified-composer"]`, `#prompt-textarea`, `#composer-submit-button` и `#thread-bottom-container`.

## 1.3.1 — 2026-09-24

- JSON-поля блока `Backend fields` в режиме Auto показывают фактические значения последнего перехваченного исходящего payload вместо неактивного пустого input.
- При фиксированном ручном режиме JSON-поле показывает итоговое значение, а при `Custom JSON` то же поле становится редактируемым и используется как источник ручного значения.
- Отсутствующее поле визуально отличается от JSON `null`; до первого подходящего запроса показывается отдельное состояние «ещё не наблюдалось».
- При переходе из Auto в `Custom JSON` текущее отображаемое JSON-значение используется как стартовое ручное значение.
- Подпись metadata-поля приведена к точному имени `message.metadata.conversation_execution_target`.

## 1.3.0 — 2026-09-24

- Добавлен блок `Backend fields` с независимым финальным управлением режимными полями исходящего payload.
- Для каждого поля доступны сохранение результата предыдущих пресетов, удаление, `null`, известные значения и `Custom JSON`.
- Ручные контролы охватывают `conversation_origin`, raw `conversation_mode`, `conversation_mode.kind`, `chat_mode`, `tpp_work_handoff_conversion`, оба расположения `conversation_execution_target` и `turn_origin`.
- Порядок применения фиксирован: `UI Chat/Work` → `Chat Mode` → `Backend fields`; ручные значения имеют максимальный приоритет.
- Raw `conversation_mode` позволяет передавать объект целиком, после чего отдельный `conversation_mode.kind` при необходимости задаёт финальный `kind`.
- Явные ручные backend-поля применяются и к Gizmo/custom GPT; без ручного override режимные поля Gizmo остаются штатными.
- Панель увеличена и прокручивается, чтобы все backend-контролы оставались доступны без изменения URL или режима разговора при загрузке страницы.
- Область диагностики имеет собственную минимальную высоту и прокрутку, поэтому длинные статусы не сжимаются backend-контролами и остаются читаемыми.
- Комбобокс `UI Chat / Work` переключает React state уже отрисованного composer без перезагрузки и без зависимости от штатного Chat/Work toggle, который исчезает после создания разговора.
- Surface preference синхронизируется значениями `chat` / `work`; live-перерисовка выполняется через единственный распознанный React hook dispatcher, а неоднозначный Fiber state завершается явной ошибкой вместо эвристического изменения чужого состояния.

## 1.2.0 — 2026-09-24

- Панель разделяет поверхность `UI Auto / Chat / Work` и независимый backend-переключатель `Chat Mode`.
- Явный выбор Chat/Work синхронизирует штатные localStorage/cookie поверхности без navigation, reload, branch, handoff и серверной конвертации.
- Загрузка страницы только восстанавливает сохранённые значения панели и не меняет URL разговора.
- `Chat Mode` отправляет набор Chat-сигналов: `primary_assistant`, `conversation_origin: null`, существующий `chat_mode: "chat"` и исключение Work handoff/execution target.
- UI Chat/Work продолжает управлять `conversation_origin` исходящих init/prepare/conversation запросов.
- Диагностика отдельно показывает выбранную UI-поверхность и применение `Chat Mode`.

## 1.1.0 — 2026-09-24

- Панель предоставляет режим разговора `Auto / Chat / Work`.
- Chat задаёт `conversation_origin` как null, Work задаёт значение `tpp`, Auto сохраняет исходное значение.
- `conversation_mode` остаётся штатным и не используется как признак Chat/Work.
- `chat_mode` меняется только при наличии поля в исходном payload.
- Chat исключает `tpp_work_handoff_conversion`; Work использует handoff только когда он уже присутствует в штатном payload.
- Диагностика показывает origin, `conversation_mode`, `chat_mode`, `turn_origin` и наличие Work handoff.
- Режим Chat/Work применяется к init, prepare и conversation, включая продолжение существующего разговора.

## 1.0.0 — 2026-09-23

Первый выпуск Chrome/Edge-расширения Manifest V3.

- Page-world скрипт запускается на `document_start`.
- Пункт «Не изменять модель» передаёт исходный payload без преобразований.
- Все thinking-уровни доступны для каждой модели, включая `ultra`.
- Каталожно отсутствующие thinking-режимы имеют янтарную индикацию без блокировки.
- Текущие UI-модели сохраняются в постоянную историю.
- Исторические модели остаются выбираемыми и имеют фиолетовую индикацию.
- Экспериментальные API-only slug имеют голубую индикацию.
- Chat Mode остаётся отдельной галочкой и применяется только при явно выбранной модели.
- Gizmo определяется по явному `gizmo_id`; другие conversation mode не считаются Gizmo автоматически.
