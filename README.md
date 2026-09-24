# GPT Models

Chrome/Edge-расширение Manifest V3 для ручного управления параметрами запросов ChatGPT.

## Возможности

- Ранний page-world перехват `window.fetch` на `document_start`.
- Обработка `/backend-api/conversation/init`, `/backend-api/f/conversation/prepare` и `/backend-api/f/conversation`.
- Независимый выбор model slug, thinking effort, service tier, поверхности `Auto / Chat / Work`, backend-переключателя `Chat Mode` и финальных ручных значений режимных полей.
- `UI Auto` сохраняет штатный `conversation_origin`, `UI Chat` отправляет `conversation_origin: null`, `UI Work` отправляет `conversation_origin: "tpp"`.
- Явный выбор `UI Chat` или `UI Work` переключает уже отрисованный composer без перезагрузки страницы и без штатного Chat/Work toggle: расширение сохраняет surface preference, пробует обновить найденный React state, а если dispatcher не найден — применяет визуальную проекцию результата к composer. Поэтому поле ввода, model picker и send controls получают видимое состояние выбранной поверхности даже на странице существующего разговора. URL не меняется; navigation, reload, branch, handoff и серверная конвертация разговора не используются.
- При обычной загрузке страницы сохранённые настройки только восстанавливаются в панели; расширение не меняет URL и не запускает режимные действия самостоятельно.
- `Chat Mode` независимо добавляет backend-сигналы обычного Chat: `conversation_mode: { kind: "primary_assistant" }`, `conversation_origin: null`, существующий `chat_mode: "chat"`, удаление `tpp_work_handoff_conversion` и `conversation_execution_target`.
- `Chat Mode` имеет приоритет над `UI Work`, а блок `Backend fields` применяется последним и имеет максимальный приоритет над обоими пресетами.
- Для каждого backend-поля JSON-поле показывает фактическое значение последнего исходящего payload в режиме Auto; для фиксированного ручного режима показывает итоговое значение, а при выборе `Custom JSON` это же поле становится редактором. Отсутствующее поле отображается отдельно от `null`.
- Ручные контролы охватывают `conversation_origin`, весь `conversation_mode`, `conversation_mode.kind`, `chat_mode`, `tpp_work_handoff_conversion`, top-level `conversation_execution_target`, `message.metadata.conversation_execution_target` и `turn_origin`.
- Полный bypass при выборе «Не изменять модель»: расширение отображает фактические параметры, но передаёт исходный payload без изменений.
- Все thinking-уровни доступны для каждой модели, включая `ultra`.
- Thinking-уровень, отсутствующий в объявленном каталожном JSON модели, остаётся доступным и выделяется янтарным цветом.
- Текущие UI-модели автоматически сохраняются в историю. Исчезнувшие из последующих каталогов модели остаются доступными и выделяются фиолетовым цветом.
- Экспериментальные текстовые и кодовые slug из публичного каталога OpenAI API отображаются голубым цветом и передаются только при явном выборе.
- Gizmo/custom GPT сохраняет штатные режимные поля для UI/Chat Mode пресетов, но явные значения из `Backend fields` применяются и к Gizmo.

## Chat и Work в текущем web-клиенте

Текущий JavaScript ChatGPT разделяет визуальную поверхность и параметры backend-запроса:

- persisted surface preference расширение синхронизирует значениями `chat` и `work`;
- localStorage-ключ поверхности — `oai/apps/tpp/chat-surface-mode`;
- cookie поверхности — `oai-chat-surface-mode`;
- Chat override cookie — `oai-chat-surface-mode-chat-override-expires-at`;
- `conversation_origin` передаётся отдельно: Work соответствует `tpp`, Chat — `null`;
- `conversation_mode.kind` является отдельным backend-сигналом типа ассистента и используется переключателем `Chat Mode`;
- `chat_mode` меняется на `chat` только если поле уже присутствует в исходном payload;
- `turn_origin` относится к происхождению конкретного хода, например `targeted_reply`, и доступен для независимого ручного переопределения;
- `tpp_work_handoff_conversion` относится к Work handoff и исключается при включённом `Chat Mode`;
- `conversation_execution_target` и одноимённое поле metadata пользовательского сообщения исключаются при включённом `Chat Mode`.

После штатного UI-пресета и `Chat Mode` расширение применяет блок `Backend fields`. Поэтому любое из перечисленных полей можно финально оставить как есть, удалить, записать как `null` или задать точным JSON-значением. В Auto соседнее JSON-поле показывает фактическое значение последнего перехваченного исходящего payload; при `Custom JSON` оно становится редактируемым и его содержимое используется как ручное значение. Для `conversation_mode` доступен как raw-объект целиком, так и отдельный `kind`; `kind` применяется после raw-значения. Строка Custom задаётся в кавычках, а объекты и массивы вводятся в обычном JSON-синтаксисе.

Расширение намеренно не пытается изменить сохранённый тип существующего conversation на сервере. Выбранные параметры применяются к локальной поверхности и к перехваченным исходящим запросам. Это позволяет продолжать использовать тот же URL разговора даже после выгрузки вкладки браузером и последующей загрузки страницы.

## Установка в Chrome или Edge

1. Открыть `chrome://extensions` или `edge://extensions`.
2. Включить режим разработчика.
3. Нажать «Загрузить распакованное расширение».
4. Выбрать каталог `C:\\FILES\\PROJECTS\\GPTMODELS`.
5. Перезагрузить открытую вкладку ChatGPT.

## Цвета

| Цвет | Значение |
|---|---|
| Штатный | Модель или thinking-режим присутствует в текущем UI-каталоге |
| Фиолетовый | Модель сохранена в истории, но отсутствует в текущем UI-каталоге |
| Голубой | Экспериментальный slug из каталога OpenAI API, отсутствующий в UI |
| Янтарный | Thinking-режим отсутствует в объявленном списке выбранной модели |

Цвет является диагностической меткой и не блокирует выбор.

## История моделей

Ключ `gpt-model-picker.model-history.v1` хранит в localStorage ChatGPT компактные снимки моделей:

- slug;
- название;
- источник Work или Chat;
- объявленные thinking-режимы;
- время первого и последнего наблюдения.

Полные ответы каталогов и bearer-токен сессии не сохраняются.

## Структура

- `manifest.json` — Manifest V3.
- `src/api-models.js` — экспериментальные API-only slug.
- `src/main.js` — панель, каталоги, история, UI Chat/Work, ручные backend-поля и перехват запросов.
- `CHANGELOG.md` — история проекта.

## Проверка

```powershell
node --check src\api-models.js
node --check src\main.js
```

API-only список является экспериментальным: наличие slug в OpenAI API не означает поддержку этого slug внутренним backend ChatGPT.
