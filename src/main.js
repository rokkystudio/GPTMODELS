// GPT Models Chrome/Edge extension page script v1.3.3
(() => {
    'use strict';

    const GLOBAL_KEY = '__gptModelPicker';
    const API_MODELS_KEY = '__gptModelPickerApiModels';
    const experimentalModels = Array.isArray(window[API_MODELS_KEY])
        ? window[API_MODELS_KEY].map((model) => ({ ...model }))
        : [];

    delete window[API_MODELS_KEY];

    if (window[GLOBAL_KEY] && typeof window[GLOBAL_KEY].stop === 'function') {
        window[GLOBAL_KEY].stop();
    }

    const config = {
        /** Версия файла и панели. */
        version: '1.3.3',

        /** URL backend-метода со списком моделей режима Work. */
        workModelsUrl: '/backend-api/tpp/models/?supports_model_picker_upgrade_presets=true',

        /** URL backend-метода со списком моделей обычного ChatGPT. */
        chatModelsUrl: '/backend-api/models?iim=false&is_gizmo=false&supports_model_picker_upgrade_presets=true',

        /** Путь инициализации параметров разговора. */
        conversationInitPath: '/backend-api/conversation/init',

        /** Путь предварительной подготовки нового хода разговора. */
        conversationPreparePath: '/backend-api/f/conversation/prepare',

        /** Путь финального запроса создания нового хода разговора. */
        conversationPath: '/backend-api/f/conversation',

        /** Ключ штатной поверхности Chat/Work в localStorage web-клиента. */
        nativeChatSurfaceStorageKey: 'oai/apps/tpp/chat-surface-mode',

        /** Cookie штатной поверхности Chat/Work web-клиента. */
        nativeChatSurfaceCookieName: 'oai-chat-surface-mode',

        /** Cookie временного приоритета Chat над рекомендацией Work. */
        nativeChatOverrideCookieName: 'oai-chat-surface-mode-chat-override-expires-at',

        /** Срок штатной cookie поверхности в секундах. */
        nativeChatSurfaceMaxAgeSeconds: 2 * 365 * 24 * 60 * 60,

        /** Срок штатного Chat override в миллисекундах. */
        nativeChatOverrideDurationMs: 4 * 60 * 60 * 1000,

        /** Значение выбора полного bypass, при котором исходящий payload передаётся без изменений. */
        autoModelSlug: 'auto',

        /** Ключ выбранной модели в localStorage. */
        storageKey: 'gpt-model-picker.selected-model.v2',

        /** Ключ накопленной истории моделей из UI-каталогов ChatGPT. */
        modelHistoryStorageKey: 'gpt-model-picker.model-history.v1',

        /** Ключ выбранной глубины рассуждения в localStorage. */
        thinkingEffortStorageKey: 'gpt-model-picker.thinking-effort.v1',

        /** Ключ режима ускоренной обработки в localStorage. */
        fastModeStorageKey: 'gpt-model-picker.fast-mode.v1',

        /** Ключ выбранного режима Chat/Work в localStorage. */
        conversationExperienceStorageKey: 'gpt-model-picker.conversation-experience.v1',

        /** Ключ отдельного backend-переключателя Chat Mode в localStorage. */
        forceChatStorageKey: 'gpt-model-picker.force-chat.v1',

        /** Ключ независимых ручных backend-переопределений режимных полей. */
        backendOverridesStorageKey: 'gpt-model-picker.backend-overrides.v1',

        /** Ключ позиции панели в localStorage. */
        positionStorageKey: 'gpt-model-picker.position.v1',

        /** Ключ состояния свёрнутой панели в localStorage. */
        collapsedStorageKey: 'gpt-model-picker.collapsed.v1',

        /** Ключ пользовательского размера панели в localStorage. */
        sizeStorageKey: 'gpt-model-picker.size.v1',

        /** Период проверки и автоматического восстановления перехватчика window.fetch. */
        hookCheckIntervalMs: 1000,

        /** Количество повторных загрузок каталогов после ошибки. */
        catalogRetryCount: 2,

        /** Задержка между повторными загрузками каталогов. */
        catalogRetryDelayMs: 1500,

        /** Включает диагностические сообщения в консоли браузера. */
        debug: true
    };

    const thinkingEffortOptions = [
        { value: 'auto', label: 'Auto — не вмешиваться' },
        { value: 'min', label: 'Лёгкое — min' },
        { value: 'standard', label: 'Стандартное — standard' },
        { value: 'extended', label: 'Усиленное — extended' },
        { value: 'xhigh', label: 'Очень высокое — xhigh' },
        { value: 'max', label: 'Тяжёлое — max' },
        { value: 'ultra', label: 'Ultra — ultra' }
    ];

    const backendFieldDefinitions = [
        {
            key: 'conversation_origin',
            label: 'conversation_origin',
            target: 'payload',
            path: ['conversation_origin'],
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить поле'],
                ['null', 'null — Chat'],
                ['json:"tpp"', '"tpp" — Work'],
                ['custom', 'Custom JSON…']
            ]
        },
        {
            key: 'conversation_mode',
            label: 'conversation_mode (raw)',
            target: 'payload',
            path: ['conversation_mode'],
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить поле'],
                ['null', 'null'],
                ['custom', 'Custom JSON…']
            ]
        },
        {
            key: 'conversation_mode_kind',
            label: 'conversation_mode.kind',
            target: 'payload',
            path: ['conversation_mode', 'kind'],
            pruneEmptyParents: true,
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить kind'],
                ['null', 'null'],
                ['json:"primary_assistant"', '"primary_assistant"'],
                ['custom', 'Custom JSON…']
            ]
        },
        {
            key: 'chat_mode',
            label: 'chat_mode',
            target: 'payload',
            path: ['chat_mode'],
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить поле'],
                ['null', 'null'],
                ['json:"chat"', '"chat"'],
                ['custom', 'Custom JSON…']
            ]
        },
        {
            key: 'tpp_work_handoff_conversion',
            label: 'tpp_work_handoff_conversion',
            target: 'payload',
            path: ['tpp_work_handoff_conversion'],
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить поле'],
                ['null', 'null'],
                ['true', 'true'],
                ['false', 'false'],
                ['custom', 'Custom JSON…']
            ]
        },
        {
            key: 'conversation_execution_target',
            label: 'conversation_execution_target',
            target: 'payload',
            path: ['conversation_execution_target'],
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить поле'],
                ['null', 'null'],
                ['custom', 'Custom JSON…']
            ]
        },
        {
            key: 'message_conversation_execution_target',
            label: 'message.metadata.conversation_execution_target',
            target: 'userMessageMetadata',
            path: ['conversation_execution_target'],
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить поле'],
                ['null', 'null'],
                ['custom', 'Custom JSON…']
            ]
        },
        {
            key: 'turn_origin',
            label: 'turn_origin',
            target: 'payload',
            path: ['turn_origin'],
            options: [
                ['preserve', 'Auto — не менять'],
                ['delete', 'Удалить поле'],
                ['null', 'null'],
                ['json:"targeted_reply"', '"targeted_reply"'],
                ['custom', 'Custom JSON…']
            ]
        }
    ];

    const state = {
        baseFetch: window.fetch,
        downstreamFetch: window.fetch,
        originalFetchDescriptor: Object.getOwnPropertyDescriptor(window, 'fetch'),
        fetchGuardInstalled: false,
        downstreamReplacementCount: 0,
        downstreamCallDepth: 0,
        selectedModelSlug: '',
        selectedThinkingEffort: 'auto',
        fastModeEnabled: false,
        selectedConversationExperience: 'chat',
        forceChatEnabled: true,
        backendOverrides: {},
        backendOverrideControls: {},
        backendFieldSnapshots: {},
        projectedChatSurfaceMode: '',
        surfaceProjectionObserver: null,
        surfaceProjectionTimer: null,
        surfaceProjectionApplying: false,
        workModels: [],
        chatModels: [],
        historicalModels: [],
        experimentalModels,
        modelHistory: [],
        workDefaultModelSlug: '',
        panel: null,
        header: null,
        collapseButton: null,
        select: null,
        input: null,
        thinkingSelect: null,
        fastCheckbox: null,
        conversationExperienceSelect: null,
        forceChatCheckbox: null,
        hookStatus: null,
        catalogStatus: null,
        selectedStatus: null,
        requestStatus: null,
        backendStatus: null,
        hookTimer: null,
        resizeObserver: null,
        dragState: null,
        collapsed: false,
        lastRequestedModelSlug: '',
        lastResolvedModelSlug: '',
        stopped: false
    };

    /**
     * Выводит диагностическое сообщение с префиксом скрипта.
     *
     * @param {...any} args
     */
    function log(...args) {
        if (config.debug) {
            console.debug('[GPT MODEL PICKER]', ...args);
        }
    }

    /**
     * Возвращает путь запроса без origin и query-параметров.
     *
     * @param {RequestInfo | URL} input
     * @returns {string}
     */
    function getRequestPath(input) {
        const rawUrl = input instanceof Request ? input.url : String(input);

        return new URL(rawUrl, window.location.origin).pathname;
    }

    /**
     * Вызывает текущую штатную обёртку fetch и ограничивает защиту от рекурсии
     * только синхронным вызовом нижнего слоя. Параллельные fetch-запросы не
     * отключают перехват друг для друга на время ожидания Promise.
     *
     * @param {RequestInfo | URL} input
     * @param {RequestInit | undefined} init
     * @returns {Promise<Response>}
     */
    function callDownstreamFetch(input, init) {
        if (state.downstreamCallDepth > 0) {
            return state.baseFetch.call(window, input, init);
        }

        state.downstreamCallDepth += 1;

        try {
            return state.downstreamFetch.call(window, input, init);
        } finally {
            state.downstreamCallDepth -= 1;
        }
    }

    /**
     * Возвращает JSON-тело запроса и функцию создания запроса с новым телом.
     *
     * @param {RequestInfo | URL} input
     * @param {RequestInit | undefined} init
     * @returns {Promise<{ body: string, rebuild: (body: string) => Request | [RequestInfo | URL, RequestInit] } | null>}
     */
    async function readRequestBody(input, init) {
        if (init && typeof init.body === 'string') {
            return {
                body: init.body,
                rebuild(body) {
                    return [input, { ...init, body }];
                }
            };
        }

        if (input instanceof Request) {
            return {
                body: await input.clone().text(),
                rebuild(body) {
                    return new Request(input, { body });
                }
            };
        }

        return null;
    }

    /**
     * Присваивает значение полю JSON payload, когда поле уже существует или разрешено его создать.
     *
     * @param {Record<string, any>} payload
     * @param {string} field
     * @param {unknown} value
     * @param {boolean} create
     * @returns {boolean}
     */
    function assignRequestField(payload, field, value, create) {
        const hasField = Object.prototype.hasOwnProperty.call(payload, field);

        if (!hasField && !create) {
            return false;
        }

        if (Object.is(payload[field], value)) {
            return false;
        }

        payload[field] = value;

        return true;
    }

    /**
     * Удаляет поле JSON payload и сообщает, было ли оно представлено.
     *
     * @param {Record<string, any>} payload
     * @param {string} field
     * @returns {boolean}
     */
    function deleteRequestField(payload, field) {
        if (!Object.prototype.hasOwnProperty.call(payload, field)) {
            return false;
        }

        delete payload[field];

        return true;
    }

    /**
     * Возвращает сохранённую настройку ручного backend-поля.
     *
     * @param {string} key
     * @returns {{ mode: string, customValue: string }}
     */
    function getBackendOverrideSetting(key) {
        const stored = state.backendOverrides[key];

        return {
            mode: typeof stored?.mode === 'string' ? stored.mode : 'preserve',
            customValue: typeof stored?.customValue === 'string' ? stored.customValue : ''
        };
    }

    /**
     * Преобразует выбранный режим ручного поля в точное JSON-значение.
     *
     * Custom принимает только валидный JSON, поэтому строковые значения задаются
     * с кавычками, например "my_value". Некорректное значение явно прерывает запрос.
     *
     * @param {{ mode: string, customValue: string }} setting
     * @param {string} fieldLabel
     * @returns {unknown}
     */
    function resolveBackendOverrideValue(setting, fieldLabel) {
        if (setting.mode === 'null') {
            return null;
        }

        if (setting.mode === 'true') {
            return true;
        }

        if (setting.mode === 'false') {
            return false;
        }

        if (setting.mode.startsWith('json:')) {
            return JSON.parse(setting.mode.slice(5));
        }

        if (setting.mode === 'custom') {
            try {
                return JSON.parse(setting.customValue);
            } catch (error) {
                throw new Error(`Некорректный Custom JSON для ${fieldLabel}: ${error.message}`);
            }
        }

        throw new Error(`Unsupported backend override mode for ${fieldLabel}: ${setting.mode}`);
    }

    /**
     * Присваивает значение по вложенному пути, создавая отсутствующие объекты.
     *
     * @param {Record<string, any>} root
     * @param {string[]} path
     * @param {unknown} value
     * @returns {boolean}
     */
    function assignNestedField(root, path, value) {
        let target = root;

        for (const segment of path.slice(0, -1)) {
            if (!target[segment] || typeof target[segment] !== 'object' || Array.isArray(target[segment])) {
                target[segment] = {};
            }

            target = target[segment];
        }

        const field = path.at(-1);

        if (Object.is(target[field], value)) {
            return false;
        }

        target[field] = value;

        return true;
    }

    /**
     * Удаляет поле по вложенному пути и при необходимости очищает пустые родительские объекты.
     *
     * @param {Record<string, any>} root
     * @param {string[]} path
     * @param {boolean} pruneEmptyParents
     * @returns {boolean}
     */
    function deleteNestedField(root, path, pruneEmptyParents) {
        const parents = [];
        let target = root;

        for (const segment of path.slice(0, -1)) {
            if (!target?.[segment] || typeof target[segment] !== 'object') {
                return false;
            }

            parents.push([target, segment]);
            target = target[segment];
        }

        const field = path.at(-1);

        if (!Object.prototype.hasOwnProperty.call(target, field)) {
            return false;
        }

        delete target[field];

        if (pruneEmptyParents) {
            for (let index = parents.length - 1; index >= 0; index -= 1) {
                const [parent, segment] = parents[index];
                const child = parent[segment];

                if (!child || typeof child !== 'object' || Object.keys(child).length > 0) {
                    break;
                }

                delete parent[segment];
            }
        }

        return true;
    }

    /**
     * Читает вложенное поле без смешивания отсутствующего значения и JSON null.
     *
     * @param {Record<string, any>} root
     * @param {string[]} path
     * @returns {{ present: boolean, value: unknown }}
     */
    function readNestedField(root, path) {
        let target = root;

        for (const segment of path.slice(0, -1)) {
            if (!target || typeof target !== 'object' || !Object.prototype.hasOwnProperty.call(target, segment)) {
                return { present: false, value: undefined };
            }

            target = target[segment];
        }

        if (!target || typeof target !== 'object') {
            return { present: false, value: undefined };
        }

        const field = path.at(-1);

        return Object.prototype.hasOwnProperty.call(target, field)
            ? { present: true, value: target[field] }
            : { present: false, value: undefined };
    }

    /**
     * Возвращает фактическое значение backend-поля из финального исходящего payload.
     *
     * Для message.metadata используется последнее пользовательское сообщение,
     * поскольку оно представляет текущий пользовательский ход в conversation payload.
     *
     * @param {Record<string, any>} payload
     * @param {typeof backendFieldDefinitions[number]} definition
     * @returns {{ present: boolean, value: unknown }}
     */
    function readBackendFieldValue(payload, definition) {
        if (definition.target === 'payload') {
            return readNestedField(payload, definition.path);
        }

        if (definition.target === 'userMessageMetadata' && Array.isArray(payload.messages)) {
            const userMessages = payload.messages.filter((message) => message?.author?.role === 'user');
            const currentUserMessage = userMessages.at(-1);

            if (currentUserMessage?.metadata && typeof currentUserMessage.metadata === 'object') {
                return readNestedField(currentUserMessage.metadata, definition.path);
            }

            return { present: false, value: undefined };
        }

        return { present: false, value: undefined };
    }

    /**
     * Сохраняет снимок режимных backend-полей после всех преобразований запроса.
     *
     * Снимок используется JSON-полями панели как read-only отображение фактического
     * значения. При режиме Custom то же поле становится редактором ручного JSON.
     *
     * @param {Record<string, any>} payload
     */
    function captureBackendFieldSnapshots(payload) {
        for (const definition of backendFieldDefinitions) {
            const current = readBackendFieldValue(payload, definition);

            state.backendFieldSnapshots[definition.key] = {
                observed: true,
                present: current.present,
                value: current.value
            };

            renderBackendOverrideControl(definition.key);
        }
    }

    /**
     * Применяет финальные ручные backend-переопределения после UI Chat/Work и Chat Mode.
     *
     * Каждый контрол независимо сохраняет поле, удаляет его или записывает точное JSON-значение.
     * Для message.metadata.conversation_execution_target настройка применяется ко всем
     * пользовательским сообщениям текущего payload и при необходимости создаёт metadata.
     *
     * @param {Record<string, any>} payload
     * @returns {{ changed: boolean, summary: string[] }}
     */
    function applyManualBackendOverrides(payload) {
        let changed = false;
        const summary = [];

        for (const definition of backendFieldDefinitions) {
            const setting = getBackendOverrideSetting(definition.key);

            if (setting.mode === 'preserve') {
                continue;
            }

            const value = setting.mode === 'delete'
                ? undefined
                : resolveBackendOverrideValue(setting, definition.label);
            const valueText = setting.mode === 'delete' ? 'DELETE' : JSON.stringify(value);

            if (definition.target === 'payload') {
                changed = setting.mode === 'delete'
                    ? deleteNestedField(payload, definition.path, Boolean(definition.pruneEmptyParents)) || changed
                    : assignNestedField(payload, definition.path, value) || changed;
            } else if (definition.target === 'userMessageMetadata' && Array.isArray(payload.messages)) {
                for (const message of payload.messages) {
                    if (message?.author?.role !== 'user') {
                        continue;
                    }

                    if (setting.mode === 'delete') {
                        if (message.metadata && typeof message.metadata === 'object') {
                            changed = deleteNestedField(message.metadata, definition.path, false) || changed;
                        }
                    } else {
                        if (!message.metadata || typeof message.metadata !== 'object') {
                            message.metadata = {};
                            changed = true;
                        }

                        changed = assignNestedField(message.metadata, definition.path, value) || changed;
                    }
                }
            }

            summary.push(`${definition.label}=${valueText}`);
        }

        return { changed, summary };
    }

    /**
     * Формирует JSON payload для этапов conversation/init, f/conversation/prepare и f/conversation.
     *
     * Пункт «Не изменять модель» включает полный bypass и передаёт исходный body без изменений.
     * Режим UI Chat/Work задаёт conversation_origin: Chat записывает null, Work записывает tpp,
     * Auto сохраняет штатное значение. Отдельный переключатель Chat Mode сохраняет набор
     * backend-сигналов обычного Chat: primary_assistant, conversation_origin=null, chat_mode=chat
     * при наличии поля и отсутствие Work handoff/execution target. Chat Mode имеет приоритет
     * над выбранным Work origin. После этих пресетов независимые ручные backend-контролы
     * финально задают, удаляют или сохраняют каждое режимное поле. Явные ручные настройки
     * разрешены и для Gizmo/custom GPT; без них Gizmo сохраняет штатные режимные поля.
     *
     * @param {string} body
     * @param {string} requestPath
     * @returns {{ body: string, changed: boolean, bypass: boolean, requestPath: string, originalModelSlug: string, requestedModelSlug: string, originalThinkingEffort: string, requestedThinkingEffort: string, originalServiceTier: string, requestedServiceTier: string, originalConversationOrigin: string, requestedConversationOrigin: string, originalConversationMode: string, requestedConversationMode: string, originalChatMode: string, requestedChatMode: string, originalTurnOrigin: string, requestedTurnOrigin: string, originalHasTppWorkHandoffConversion: boolean, requestedHasTppWorkHandoffConversion: boolean, originalConversationExecutionTarget: unknown, requestedConversationExecutionTarget: unknown, requestedConversationExperience: string, forceChatApplied: boolean, manualBackendOverrideSummary: string[] } | null}
     */
    function updateRequestBody(body, requestPath) {
        if (!body) {
            return null;
        }

        let payload;

        try {
            payload = JSON.parse(body);
        } catch {
            return null;
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return null;
        }

        const isInitRequest = requestPath === config.conversationInitPath;
        const isPrepareRequest = requestPath === config.conversationPreparePath;
        const isConversationRequest = requestPath === config.conversationPath;
        const originalModelSlug = String(
            payload.model
            || payload.requested_default_model
            || payload.model_slug
            || payload.requested_model_slug
            || payload.backend_model
            || ''
        );
        const originalThinkingEffort = String(
            payload.thinking_effort || payload.backend_thinking_effort || ''
        );
        const originalServiceTier = String(
            payload.service_tier || payload.backend_service_tier || ''
        );
        const originalConversationOrigin = payload.conversation_origin == null
            ? ''
            : String(payload.conversation_origin);
        const originalConversationMode = String(payload.conversation_mode?.kind || '');
        const originalChatMode = String(payload.chat_mode || '');
        const originalTurnOrigin = String(payload.turn_origin || '');
        const originalHasTppWorkHandoffConversion = payload.tpp_work_handoff_conversion != null;
        const originalConversationExecutionTarget = payload.conversation_execution_target;
        const bypass = state.selectedModelSlug === config.autoModelSlug;
        const overrideModel = !bypass;
        const overrideThinkingEffort = !bypass && state.selectedThinkingEffort !== 'auto';
        const isGizmoRequest = payload.gizmo_id != null;
        const overrideConversationExperience = (
            !bypass
            && state.selectedConversationExperience !== 'auto'
            && !isGizmoRequest
        );
        const forceChat = !bypass && state.forceChatEnabled && !isGizmoRequest;
        let changed = false;

        if (overrideModel) {
            const createModel = isPrepareRequest || isConversationRequest;
            const createRequestedDefaultModel = isInitRequest || isPrepareRequest || isConversationRequest;

            changed = assignRequestField(
                payload,
                'model',
                state.selectedModelSlug,
                createModel
            ) || changed;
            changed = assignRequestField(
                payload,
                'requested_default_model',
                state.selectedModelSlug,
                createRequestedDefaultModel
            ) || changed;
            changed = assignRequestField(
                payload,
                'model_slug',
                state.selectedModelSlug,
                false
            ) || changed;
            changed = assignRequestField(
                payload,
                'requested_model_slug',
                state.selectedModelSlug,
                false
            ) || changed;
            changed = assignRequestField(
                payload,
                'backend_model',
                state.selectedModelSlug,
                false
            ) || changed;
        }

        if (overrideConversationExperience) {
            changed = assignRequestField(
                payload,
                'conversation_origin',
                state.selectedConversationExperience === 'work' ? 'tpp' : null,
                isInitRequest || isPrepareRequest || isConversationRequest
            ) || changed;

            if (state.selectedConversationExperience === 'chat') {
                changed = deleteRequestField(payload, 'tpp_work_handoff_conversion') || changed;
            }
        }

        if (forceChat) {
            if (
                (isPrepareRequest || isConversationRequest)
                && (
                    payload.conversation_mode?.kind !== 'primary_assistant'
                    || Object.keys(payload.conversation_mode || {}).length !== 1
                )
            ) {
                payload.conversation_mode = { kind: 'primary_assistant' };
                changed = true;
            }

            changed = assignRequestField(
                payload,
                'conversation_origin',
                null,
                isInitRequest || isPrepareRequest || isConversationRequest
            ) || changed;
            changed = assignRequestField(payload, 'chat_mode', 'chat', false) || changed;
            changed = deleteRequestField(payload, 'tpp_work_handoff_conversion') || changed;
            changed = deleteRequestField(payload, 'conversation_execution_target') || changed;

            if (Array.isArray(payload.messages)) {
                for (const message of payload.messages) {
                    if (
                        message?.author?.role === 'user'
                        && message.metadata
                        && Object.prototype.hasOwnProperty.call(
                            message.metadata,
                            'conversation_execution_target'
                        )
                    ) {
                        delete message.metadata.conversation_execution_target;
                        changed = true;
                    }
                }
            }
        }

        const manualBackendResult = bypass
            ? { changed: false, summary: [] }
            : applyManualBackendOverrides(payload);
        changed = manualBackendResult.changed || changed;

        if (overrideThinkingEffort) {
            changed = assignRequestField(
                payload,
                'thinking_effort',
                state.selectedThinkingEffort,
                isPrepareRequest || isConversationRequest
            ) || changed;
            changed = assignRequestField(
                payload,
                'backend_thinking_effort',
                state.selectedThinkingEffort,
                false
            ) || changed;
        }

        if (!bypass && state.fastModeEnabled) {
            changed = assignRequestField(
                payload,
                'service_tier',
                'priority',
                isPrepareRequest || isConversationRequest
            ) || changed;
            changed = assignRequestField(
                payload,
                'backend_service_tier',
                'priority',
                false
            ) || changed;
        }

        const requestedConversationOrigin = payload.conversation_origin == null
            ? ''
            : String(payload.conversation_origin);
        const requestedConversationMode = String(payload.conversation_mode?.kind || '');
        const requestedChatMode = String(payload.chat_mode || '');
        const requestedTurnOrigin = String(payload.turn_origin || '');
        const requestedHasTppWorkHandoffConversion = payload.tpp_work_handoff_conversion != null;
        const requestedConversationExecutionTarget = payload.conversation_execution_target;

        captureBackendFieldSnapshots(payload);

        return {
            body: changed ? JSON.stringify(payload) : body,
            changed,
            bypass,
            requestPath,
            originalModelSlug,
            requestedModelSlug: overrideModel ? state.selectedModelSlug : originalModelSlug,
            originalThinkingEffort,
            requestedThinkingEffort: overrideThinkingEffort
                ? state.selectedThinkingEffort
                : originalThinkingEffort,
            originalServiceTier,
            requestedServiceTier: !bypass && state.fastModeEnabled ? 'priority' : originalServiceTier,
            originalConversationOrigin,
            requestedConversationOrigin,
            originalConversationMode,
            requestedConversationMode,
            originalChatMode,
            requestedChatMode,
            originalTurnOrigin,
            requestedTurnOrigin,
            originalHasTppWorkHandoffConversion,
            requestedHasTppWorkHandoffConversion,
            originalConversationExecutionTarget,
            requestedConversationExecutionTarget,
            requestedConversationExperience: overrideConversationExperience
                ? state.selectedConversationExperience
                : 'auto',
            forceChatApplied: forceChat,
            manualBackendOverrideSummary: manualBackendResult.summary
        };
    }

    /**
     * Добавляет непустое строковое значение в массив без повторений.
     *
     * @param {string[]} target
     * @param {unknown} value
     */
    function appendUniqueString(target, value) {
        if (typeof value === 'string' && value && !target.includes(value)) {
            target.push(value);
        }
    }

    /**
     * Собирает сведения о модели, thinking effort и service tier из JSON-объекта ответа.
     *
     * @param {unknown} value
     * @param {{ resolvedModels: string[], assistantModels: string[], allModels: string[], thinkingEfforts: string[], serviceTiers: string[] }} result
     */
    function collectResponseInfo(value, result) {
        if (!value || typeof value !== 'object') {
            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectResponseInfo(item, result);
            }

            return;
        }

        appendUniqueString(result.resolvedModels, value.resolved_model_slug);
        appendUniqueString(result.allModels, value.model_slug);
        appendUniqueString(result.thinkingEfforts, value.thinking_effort);
        appendUniqueString(result.thinkingEfforts, value.backend_thinking_effort);
        appendUniqueString(result.serviceTiers, value.service_tier);
        appendUniqueString(result.serviceTiers, value.backend_service_tier);

        if (value.author?.role === 'assistant' && value.metadata) {
            appendUniqueString(result.resolvedModels, value.metadata.resolved_model_slug);
            appendUniqueString(result.assistantModels, value.metadata.model_slug);
            appendUniqueString(result.thinkingEfforts, value.metadata.thinking_effort);
            appendUniqueString(result.serviceTiers, value.metadata.service_tier);
        }

        for (const nestedValue of Object.values(value)) {
            collectResponseInfo(nestedValue, result);
        }
    }

    /**
     * Возвращает сведения, раскрытые backend-событиями потокового ответа.
     *
     * @param {string} responseText
     * @returns {{ modelSlug: string, thinkingEffort: string, serviceTier: string }}
     */
    function extractResponseInfo(responseText) {
        const result = {
            resolvedModels: [],
            assistantModels: [],
            allModels: [],
            thinkingEfforts: [],
            serviceTiers: []
        };

        for (const line of responseText.split(/\r?\n/)) {
            const trimmedLine = line.trim();

            if (!trimmedLine || trimmedLine === 'data: [DONE]') {
                continue;
            }

            const jsonText = trimmedLine.startsWith('data:')
                ? trimmedLine.slice(5).trim()
                : trimmedLine;

            if (!jsonText.startsWith('{') && !jsonText.startsWith('[')) {
                continue;
            }

            try {
                collectResponseInfo(JSON.parse(jsonText), result);
            } catch {
                continue;
            }
        }

        return {
            modelSlug: result.resolvedModels.at(-1) || result.assistantModels.at(-1) || result.allModels.at(-1) || '',
            thinkingEffort: result.thinkingEfforts.at(-1) || '',
            serviceTier: result.serviceTiers.at(-1) || ''
        };
    }

    /**
     * Отображает параметры, раскрытые backend-событиями ответа.
     *
     * @param {{ requestedModelSlug: string, requestedThinkingEffort: string, requestedServiceTier: string, verifyDirectWorkChat?: boolean }} requestInfo
     * @param {{ modelSlug: string, thinkingEffort: string, serviceTier: string }} responseInfo
     */
    function displayBackendInfo(requestInfo, responseInfo) {
        if (responseInfo.modelSlug) {
            state.lastResolvedModelSlug = responseInfo.modelSlug;
        }

        const details = [];
        let type = responseInfo.modelSlug ? 'success' : 'warning';

        if (responseInfo.modelSlug) {
            if (requestInfo.requestedModelSlug && responseInfo.modelSlug !== requestInfo.requestedModelSlug) {
                details.push(`модель ${requestInfo.requestedModelSlug} → ${responseInfo.modelSlug}`);
                type = 'warning';
            } else {
                details.push(`модель ${responseInfo.modelSlug}`);
            }
        }

        if (responseInfo.thinkingEffort) {
            details.push(`thinking ${responseInfo.thinkingEffort}`);
        }

        if (responseInfo.serviceTier) {
            details.push(`speed ${responseInfo.serviceTier}`);
        }

        updateBackendStatus(
            details.length > 0
                ? `Backend: ${details.join('; ')}`
                : 'Backend: HTTP 200; модель и параметры потоком не раскрыты — выбор не подтверждён',
            type
        );
    }

    /**
     * Читает копию потокового ответа и отображает параметры, раскрытые backend.
     *
     * @param {Response} response
     * @param {{ requestedModelSlug: string, requestedThinkingEffort: string, requestedServiceTier: string }} requestInfo
     */
    async function observeConversationResponse(response, requestInfo) {
        if (!response.ok) {
            updateBackendStatus(`Backend: HTTP ${response.status}; модель ${requestInfo.requestedModelSlug || 'штатная'}`, 'error');
            return;
        }

        const responseBody = response.clone().body;

        if (!responseBody) {
            updateBackendStatus(`Backend: HTTP ${response.status}; поток данных отсутствует — выбор не подтверждён`, 'warning');
            return;
        }

        const reader = responseBody.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let responseInfo = {
            modelSlug: '',
            thinkingEffort: '',
            serviceTier: ''
        };

        try {
            while (true) {
                const { value, done } = await reader.read();
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

                const lines = buffer.split(/\r?\n/);
                buffer = done ? '' : lines.pop() || '';
                const currentInfo = extractResponseInfo(lines.join('\n'));

                responseInfo = {
                    modelSlug: currentInfo.modelSlug || responseInfo.modelSlug,
                    thinkingEffort: currentInfo.thinkingEffort || responseInfo.thinkingEffort,
                    serviceTier: currentInfo.serviceTier || responseInfo.serviceTier
                };

                if (currentInfo.modelSlug || currentInfo.thinkingEffort || currentInfo.serviceTier) {
                    displayBackendInfo(requestInfo, responseInfo);
                }

                if (done) {
                    break;
                }
            }

            if (buffer) {
                const tailInfo = extractResponseInfo(buffer);
                responseInfo = {
                    modelSlug: tailInfo.modelSlug || responseInfo.modelSlug,
                    thinkingEffort: tailInfo.thinkingEffort || responseInfo.thinkingEffort,
                    serviceTier: tailInfo.serviceTier || responseInfo.serviceTier
                };
            }

            displayBackendInfo(requestInfo, responseInfo);
        } catch (error) {
            if (responseInfo.modelSlug || responseInfo.thinkingEffort || responseInfo.serviceTier) {
                displayBackendInfo(requestInfo, responseInfo);
                log('response stream closed after backend data detection', error);
            } else if (error?.name === 'AbortError' || /aborted/i.test(String(error?.message || ''))) {
                updateBackendStatus('Backend: HTTP 200; поток закрыт ChatGPT, параметры не раскрыты — выбор не подтверждён', 'warning');
                log('response stream aborted before backend data detection', error);
            } else {
                updateBackendStatus(`Backend: ошибка чтения ответа: ${error.message}`, 'error');
                log('response inspection failed', error);
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Возвращает название этапа backend-запроса.
     *
     * @param {string} requestPath
     * @returns {string}
     */
    function getRequestStageName(requestPath) {
        if (requestPath === config.conversationInitPath) {
            return 'init';
        }

        if (requestPath === config.conversationPreparePath) {
            return 'prepare';
        }

        return 'conversation';
    }

    /**
     * Формирует строку параметров, применённых к исходящему запросу.
     *
     * Диагностика показывает исходные и финальные режимные поля после UI-пресета,
     * Chat Mode и независимых ручных backend-переопределений.
     *
     * @param {ReturnType<typeof updateRequestBody>} requestInfo
     * @returns {string}
     */
    function formatRequestStatus(requestInfo) {
        const originText = requestInfo.originalConversationOrigin || 'null/absent';
        const requestedOriginText = requestInfo.requestedConversationOrigin || 'null/absent';
        const conversationModeText = requestInfo.originalConversationMode || 'absent';
        const requestedConversationModeText = requestInfo.requestedConversationMode || 'absent';
        const chatModeText = requestInfo.originalChatMode || 'absent';
        const requestedChatModeText = requestInfo.requestedChatMode || 'absent';
        const turnOriginText = requestInfo.originalTurnOrigin || 'absent';
        const requestedTurnOriginText = requestInfo.requestedTurnOrigin || 'absent';
        const handoffText = requestInfo.originalHasTppWorkHandoffConversion ? 'yes' : 'no';
        const requestedHandoffText = requestInfo.requestedHasTppWorkHandoffConversion ? 'yes' : 'no';
        const executionTargetText = requestInfo.originalConversationExecutionTarget === undefined
            ? 'absent'
            : JSON.stringify(requestInfo.originalConversationExecutionTarget);
        const requestedExecutionTargetText = requestInfo.requestedConversationExecutionTarget === undefined
            ? 'absent'
            : JSON.stringify(requestInfo.requestedConversationExecutionTarget);

        if (requestInfo.bypass) {
            const modelText = requestInfo.originalModelSlug || 'штатный slug';
            const thinkingText = requestInfo.originalThinkingEffort || 'штатный';
            const speedText = requestInfo.originalServiceTier || 'штатная';

            return `Запрос [${getRequestStageName(requestInfo.requestPath)}]: bypass без изменений; модель ${modelText}; thinking ${thinkingText}; скорость ${speedText}; origin ${originText}; conversation_mode ${conversationModeText}; chat_mode ${chatModeText}; turn_origin ${turnOriginText}; work_handoff ${handoffText}; execution_target ${executionTargetText}`;
        }

        const modelText = requestInfo.originalModelSlug && requestInfo.originalModelSlug !== requestInfo.requestedModelSlug
            ? `${requestInfo.originalModelSlug} → ${requestInfo.requestedModelSlug}`
            : requestInfo.requestedModelSlug;
        const thinkingText = state.selectedThinkingEffort === 'auto'
            ? `thinking Auto${requestInfo.requestedThinkingEffort ? ` (${requestInfo.requestedThinkingEffort})` : ''}`
            : `thinking ${requestInfo.requestedThinkingEffort}`;
        const speedText = state.fastModeEnabled
            ? 'скорость 1.5x (priority)'
            : `скорость штатная${requestInfo.requestedServiceTier ? ` (${requestInfo.requestedServiceTier})` : ''}`;
        const uiModeText = requestInfo.requestedConversationExperience === 'auto'
            ? `UI Auto; origin ${originText} → ${requestedOriginText}`
            : `UI ${requestInfo.requestedConversationExperience === 'work' ? 'Work' : 'Chat'}; origin ${originText} → ${requestedOriginText}`;
        const forceChatText = requestInfo.forceChatApplied ? 'Chat Mode ON' : 'Chat Mode OFF';
        const manualText = requestInfo.manualBackendOverrideSummary.length > 0
            ? `manual [${requestInfo.manualBackendOverrideSummary.join(', ')}]`
            : 'manual none';

        return `Запрос [${getRequestStageName(requestInfo.requestPath)}]: ${modelText}; ${thinkingText}; ${speedText}; ${uiModeText}; ${forceChatText}; conversation_mode ${conversationModeText} → ${requestedConversationModeText}; chat_mode ${chatModeText} → ${requestedChatModeText}; turn_origin ${turnOriginText} → ${requestedTurnOriginText}; work_handoff ${handoffText} → ${requestedHandoffText}; execution_target ${executionTargetText} → ${requestedExecutionTargetText}; ${manualText}`;
    }

    /**
     * Перехватывает этапы инициализации, подготовки и создания хода, применяет
     * независимые ручные настройки модели, thinking effort, service tier и режима Chat/Work
     * для явно выбранной модели и наблюдает поток финального ответа.
     * В режиме bypass исходный запрос передаётся без изменения payload.
     *
     * @param {RequestInfo | URL} input
     * @param {RequestInit | undefined} init
     * @returns {Promise<Response>}
     */
    async function fetchWithSelectedModel(input, init) {
        if (state.downstreamCallDepth > 0) {
            return state.baseFetch.call(window, input, init);
        }

        const requestPath = getRequestPath(input);
        const controlledPaths = [
            config.conversationInitPath,
            config.conversationPreparePath,
            config.conversationPath
        ];

        if (state.stopped || !controlledPaths.includes(requestPath)) {
            return callDownstreamFetch(input, init);
        }

        const requestBody = await readRequestBody(input, init);
        let requestInfo = null;

        try {
            requestInfo = requestBody && updateRequestBody(requestBody.body, requestPath);
        } catch (error) {
            updateRequestStatus(
                `Запрос [${getRequestStageName(requestPath)}]: ${error.message}`,
                'error'
            );
            throw error;
        }

        if (!requestBody || !requestInfo) {
            updateRequestStatus(
                `Запрос [${getRequestStageName(requestPath)}]: JSON payload не прочитан`,
                'error'
            );

            return callDownstreamFetch(input, init);
        }

        const rebuilt = requestInfo.changed
            ? requestBody.rebuild(requestInfo.body)
            : null;
        const responsePromise = rebuilt
            ? Array.isArray(rebuilt)
                ? callDownstreamFetch(rebuilt[0], rebuilt[1])
                : callDownstreamFetch(rebuilt)
            : callDownstreamFetch(input, init);

        updateRequestStatus(formatRequestStatus(requestInfo), 'success');
        log(`${getRequestStageName(requestPath)} request parameters`, requestInfo);

        if (requestPath !== config.conversationPath) {
            return responsePromise;
        }

        state.lastRequestedModelSlug = requestInfo.requestedModelSlug;
        state.lastResolvedModelSlug = '';
        updateBackendStatus('Backend: ожидание ответа…', 'neutral');

        const response = await responsePromise;
        observeConversationResponse(response, requestInfo);

        return response;
    }

    /**
     * Создает DOM-элемент с атрибутами и текстом.
     *
     * @param {string} tagName
     * @param {Record<string, string>} attributes
     * @param {string} [text]
     * @returns {HTMLElement}
     */
    function createElement(tagName, attributes, text) {
        const element = document.createElement(tagName);

        for (const [name, value] of Object.entries(attributes)) {
            element.setAttribute(name, value);
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    /**
     * Записывает текст и визуальный тип строки состояния.
     *
     * @param {HTMLElement | null} element
     * @param {string} message
     * @param {'neutral' | 'success' | 'warning' | 'error'} type
     */
    function setStatus(element, message, type) {
        if (element) {
            element.textContent = message;
            element.dataset.statusType = type;
        }
    }

    /** Возвращает защищённый перехватчик при чтении window.fetch. */
    function getGuardedFetch() {
        return fetchWithSelectedModel;
    }

    /**
     * Принимает новую штатную обёртку fetch как нижний слой перехватчика.
     *
     * @param {Function} value
     */
    function setGuardedFetch(value) {
        if (typeof value === 'function' && value !== fetchWithSelectedModel) {
            state.downstreamFetch = value;
            state.downstreamReplacementCount += 1;
            log('downstream fetch replaced', state.downstreamReplacementCount);
        }

        updateHookStatus();
    }

    /** Устанавливает accessor, сохраняющий перехватчик поверх штатных обёрток. */
    function installFetchGuard() {
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            enumerable: state.originalFetchDescriptor?.enumerable ?? true,
            get: getGuardedFetch,
            set: setGuardedFetch
        });
        state.fetchGuardInstalled = true;
        updateHookStatus();
    }

    /** Обновляет состояние защищённого перехватчика window.fetch. */
    function updateHookStatus() {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
        const isActive = descriptor?.get === getGuardedFetch && descriptor?.set === setGuardedFetch;

        setStatus(
            state.hookStatus,
            isActive
                ? `\u041f\u0435\u0440\u0435\u0445\u0432\u0430\u0442 fetch: \u0437\u0430\u0449\u0438\u0449\u0451\u043d; \u0448\u0442\u0430\u0442\u043d\u044b\u0445 \u0437\u0430\u043c\u0435\u043d ${state.downstreamReplacementCount}`
                : '\u041f\u0435\u0440\u0435\u0445\u0432\u0430\u0442 fetch: \u0437\u0430\u0449\u0438\u0442\u0430 \u043d\u0435\u0430\u043a\u0442\u0438\u0432\u043d\u0430',
            isActive ? 'success' : 'error'
        );
    }

    /**
     * Обновляет строку последнего исходящего запроса.
     *
     * @param {string} message
     * @param {'neutral' | 'success' | 'warning' | 'error'} type
     */
    function updateRequestStatus(message, type) {
        setStatus(state.requestStatus, message, type);
    }

    /**
     * Обновляет строку результата backend.
     *
     * @param {string} message
     * @param {'neutral' | 'success' | 'warning' | 'error'} type
     */
    function updateBackendStatus(message, type) {
        setStatus(state.backendStatus, message, type);
    }

    /** Обновляет строку выбранных параметров панели и показывает состояние полного bypass. */
    function updateSelectedStatus() {
        const thinkingText = state.selectedThinkingEffort === 'auto'
            ? 'Auto'
            : state.selectedThinkingEffort;
        const speedText = state.fastModeEnabled ? '1.5x / priority' : 'штатная';
        const modeText = state.selectedConversationExperience === 'auto'
            ? 'UI Auto / штатный'
            : state.selectedConversationExperience === 'work'
                ? 'UI Work'
                : 'UI Chat';
        const chatModeText = state.forceChatEnabled ? 'Chat Mode ON' : 'Chat Mode OFF';
        const manualBackendCount = backendFieldDefinitions.filter((definition) => {
            return getBackendOverrideSetting(definition.key).mode !== 'preserve';
        }).length;
        const manualBackendText = `backend manual ${manualBackendCount}/${backendFieldDefinitions.length}`;

        if (state.selectedModelSlug === config.autoModelSlug) {
            setStatus(
                state.selectedStatus,
                `Выбрано: Не изменять модель — bypass; панель: thinking ${thinkingText}; скорость ${speedText}; ${modeText}; ${chatModeText}; ${manualBackendText}`,
                'warning'
            );
            return;
        }

        setStatus(
            state.selectedStatus,
            `Выбрано: ${state.selectedModelSlug}; thinking ${thinkingText}; скорость ${speedText}; ${modeText}; ${chatModeText}; ${manualBackendText}`,
            'success'
        );
    }

    /**
     * Устанавливает модель и сохраняет её идентификатор.
     *
     * Внутреннее значение auto соответствует пункту «Не изменять модель» и включает полный bypass
     * всех преобразований исходящего payload. Панель продолжает отображать выбранные настройки
     * и фактические параметры перехваченных запросов.
     *
     * @param {string} modelSlug
     * @param {boolean} persist
     */
    function setSelectedModel(modelSlug, persist) {
        const normalizedSlug = String(modelSlug || '').trim() || config.autoModelSlug;

        state.selectedModelSlug = normalizedSlug;

        if (persist) {
            localStorage.setItem(config.storageKey, normalizedSlug);
        }

        if (state.select) {
            state.select.value = normalizedSlug;
        }

        if (state.input && state.input.value !== normalizedSlug) {
            state.input.value = normalizedSlug;
        }

        renderThinkingEfforts();
        updateSelectedStatus();
        restoreHook();
    }

    /**
     * Устанавливает доступную для любой модели глубину рассуждения и сохраняет её значение.
     *
     * Значение auto сохраняет штатный thinking_effort исходящего запроса. Значения, отсутствующие
     * в объявленном каталожном списке выбранной модели, остаются доступными и выделяются цветом.
     *
     * @param {string} thinkingEffort
     * @param {boolean} persist
     */
    function setSelectedThinkingEffort(thinkingEffort, persist) {
        const normalizedEffort = thinkingEffortOptions.some((option) => option.value === thinkingEffort)
            ? thinkingEffort
            : 'auto';

        state.selectedThinkingEffort = normalizedEffort;

        if (persist) {
            localStorage.setItem(config.thinkingEffortStorageKey, normalizedEffort);
        }

        if (state.thinkingSelect) {
            state.thinkingSelect.value = normalizedEffort;
        }

        updateSelectedStatus();
    }

    /**
     * Включает или выключает запрос ускоренного service tier и сохраняет состояние.
     *
     * @param {boolean} enabled
     * @param {boolean} persist
     */
    function setFastModeEnabled(enabled, persist) {
        state.fastModeEnabled = Boolean(enabled);

        if (persist) {
            localStorage.setItem(config.fastModeStorageKey, String(state.fastModeEnabled));
        }

        if (state.fastCheckbox) {
            state.fastCheckbox.checked = state.fastModeEnabled;
        }

        updateSelectedStatus();
    }


    /**
     * Нормализует внутреннее значение ChatGPT surface в режим панели.
     *
     * @param {unknown} value
     * @returns {'chat' | 'work' | ''}
     */
    function normalizeNativeChatSurfaceValue(value) {
        if (value === 'work') {
            return 'work';
        }

        if (value === 'chat' || value === 'chatgpt') {
            return 'chat';
        }

        return '';
    }

    /**
     * Возвращает React Fiber, которому принадлежит DOM-элемент ChatGPT.
     *
     * React добавляет production-ключи с динамическими суффиксами. Функция
     * поддерживает Fiber, legacy internal instance и root container, но не
     * изменяет найденные структуры.
     *
     * @param {Element} element
     * @returns {object | null}
     */
    function getReactFiber(element) {
        const fiberKey = Reflect.ownKeys(element).find((key) => {
            const name = String(key);

            return name.startsWith('__reactFiber$')
                || name.startsWith('__reactInternalInstance$')
                || name.startsWith('__reactContainer$');
        });
        const fiber = fiberKey ? element[fiberKey] : null;

        return fiber?.current || fiber || null;
    }

    /**
     * Возвращает ближайший React Fiber для элемента или его родителей.
     *
     * @param {Element | null} element
     * @returns {object | null}
     */
    function getNearestReactFiber(element) {
        for (let current = element; current instanceof Element; current = current.parentElement) {
            const fiber = getReactFiber(current);

            if (fiber) {
                return fiber;
            }
        }

        return null;
    }

    /**
     * Собирает DOM-точки текущего composer и страницы, от которых можно выйти к React Fiber.
     *
     * @returns {Element[]}
     */
    function getChatSurfaceFiberAnchors() {
        const selectors = [
            '[data-composer-surface="true"] button.__composer-pill[aria-haspopup="menu"]',
            '[data-composer-surface="true"] button[aria-haspopup="menu"]',
            '[data-composer-surface="true"]',
            'form[data-type="unified-composer"]',
            '#prompt-textarea',
            '#composer-submit-button',
            '#thread-bottom-container',
            'main',
            'body'
        ];
        const anchors = [];

        for (const selector of selectors) {
            const element = document.querySelector(selector);

            if (element instanceof Element && !anchors.includes(element)) {
                anchors.push(element);
            }
        }

        return anchors;
    }

    /**
     * Собирает React root Fiber из DOM, не полагаясь на конкретный id контейнера.
     *
     * @returns {object[]}
     */
    function getReactRootFibers() {
        const roots = [];
        const seen = new Set();
        const rootsQuery = 'html, body, main, #__next, [id], [data-testid], [data-composer-surface="true"]';

        for (const element of document.querySelectorAll(rootsQuery)) {
            if (!(element instanceof Element)) {
                continue;
            }

            for (const key of Reflect.ownKeys(element)) {
                if (!String(key).startsWith('__reactContainer$')) {
                    continue;
                }

                const root = element[key]?.current || element[key];

                if (root && !seen.has(root)) {
                    seen.add(root);
                    roots.push(root);
                }
            }
        }

        for (const anchor of getChatSurfaceFiberAnchors()) {
            const fiber = getNearestReactFiber(anchor);

            if (!fiber) {
                continue;
            }

            let root = fiber;

            while (root.return) {
                root = root.return;
            }

            if (root && !seen.has(root)) {
                seen.add(root);
                roots.push(root);
            }
        }

        return roots;
    }

    /**
     * Определяет фактически отрисованный Chat/Work composer.
     *
     * Work-пикер содержит структурный slider marker, которого нет у Chat-пикера.
     * Это проверка результата рендера, а не сохранённого localStorage/cookie.
     *
     * @returns {'chat' | 'work' | ''}
     */
    function getRenderedChatSurfaceMode() {
        const composer = document.querySelector('[data-composer-surface="true"]')
            || document.querySelector('form[data-type="unified-composer"]')
            || document.querySelector('#thread-bottom-container');
        const modelTrigger = document.querySelector(
            '[data-composer-surface="true"] button.__composer-pill[aria-haspopup="menu"], '
            + '[data-composer-surface="true"] button[aria-haspopup="menu"], '
            + 'button[data-testid="model-switcher-dropdown-button"], '
            + 'button[data-testid="Model-switCher-dropdown-button"]'
        );

        if (modelTrigger instanceof Element) {
            return modelTrigger.querySelector(
                '[data-animated-slider-trigger="true"], [data-work-model-picker="true"]'
            )
                ? 'work'
                : 'chat';
        }

        return composer instanceof Element ? 'chat' : '';
    }

    /**
     * Возвращает основной composer, к которому применяется визуальная проекция Chat/Work.
     *
     * @returns {Element | null}
     */
    function getSurfaceComposerRoot() {
        return document.querySelector('[data-composer-surface="true"]')
            || document.querySelector('form[data-type="unified-composer"]')
            || document.querySelector('#thread-bottom-container')
            || null;
    }

    /**
     * Возвращает поле ввода текущего composer.
     *
     * @returns {HTMLElement | null}
     */
    function getSurfacePromptEditor() {
        const editor = document.querySelector('#prompt-textarea')
            || getSurfaceComposerRoot()?.querySelector('[contenteditable="true"], textarea');

        return editor instanceof HTMLElement ? editor : null;
    }

    /**
     * Возвращает видимые кнопки выбора модели текущего composer.
     *
     * @returns {HTMLElement[]}
     */
    function getSurfaceModelButtons() {
        const selectors = [
            '[data-composer-surface="true"] button.__composer-pill[aria-haspopup="menu"]',
            '[data-composer-surface="true"] button[aria-haspopup="menu"]',
            'button[data-testid="model-switcher-dropdown-button"]',
            'button[data-testid="Model-switCher-dropdown-button"]'
        ];

        return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
            .filter((element, index, list) => {
                return element instanceof HTMLElement
                    && list.indexOf(element) === index
                    && element.closest('#gpt-model-picker-panel') == null;
            });
    }

    /**
     * Возвращает видимые кнопки отправки/остановки composer.
     *
     * @returns {HTMLElement[]}
     */
    function getSurfaceActionButtons() {
        const selectors = [
            '#composer-submit-button',
            '[data-composer-surface="true"] button[data-testid="send-button"]',
            '[data-composer-surface="true"] button[aria-label*="Send"]',
            '[data-composer-surface="true"] button[aria-label*="Stop"]'
        ];

        return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
            .filter((element, index, list) => {
                return element instanceof HTMLElement
                    && list.indexOf(element) === index
                    && element.closest('#gpt-model-picker-panel') == null;
            });
    }

    /**
     * Сохраняет исходное значение DOM-атрибута для последующего восстановления.
     *
     * @param {HTMLElement} element
     * @param {string} attributeName
     */
    function rememberOriginalAttribute(element, attributeName) {
        const storageKey = `gptModelPickerOriginal${attributeName.replace(/[^a-z0-9]/gi, '')}`;

        if (Object.prototype.hasOwnProperty.call(element.dataset, storageKey)) {
            return;
        }

        element.dataset[storageKey] = element.getAttribute(attributeName) ?? '';
    }

    /**
     * Восстанавливает сохранённое значение DOM-атрибута.
     *
     * @param {HTMLElement} element
     * @param {string} attributeName
     */
    function restoreOriginalAttribute(element, attributeName) {
        const storageKey = `gptModelPickerOriginal${attributeName.replace(/[^a-z0-9]/gi, '')}`;

        if (!Object.prototype.hasOwnProperty.call(element.dataset, storageKey)) {
            return;
        }

        const originalValue = element.dataset[storageKey];

        if (originalValue) {
            element.setAttribute(attributeName, originalValue);
        } else {
            element.removeAttribute(attributeName);
        }

        delete element.dataset[storageKey];
    }

    /**
     * Добавляет или обновляет бейдж поверхности на кнопке выбора модели.
     *
     * @param {HTMLElement} button
     * @param {'chat' | 'work'} experience
     */
    function setSurfaceBadge(button, experience) {
        let badge = button.querySelector(':scope > .gpt-model-picker-surface-badge');

        if (!(badge instanceof HTMLElement)) {
            badge = document.createElement('span');
            badge.className = 'gpt-model-picker-surface-badge';
            badge.setAttribute('aria-hidden', 'true');
            button.append(badge);
        }

        badge.textContent = experience === 'work' ? 'Work UI' : 'Chat UI';
    }

    /** Удаляет добавленные расширением бейджи поверхности. */
    function clearSurfaceBadges() {
        for (const badge of document.querySelectorAll('.gpt-model-picker-surface-badge')) {
            badge.remove();
        }
    }

    /**
     * Применяет визуальное состояние Chat/Work к уже отрисованному composer.
     *
     * Это fallback-слой результата: он не нажимает штатный toggle и не зависит от
     * расположения React state. Расширение помечает html и composer, меняет
     * placeholder поля ввода, добавляет бейдж к model picker и подсвечивает action button.
     * Backend-поля продолжают задаваться fetch-перехватом независимо от этой проекции.
     *
     * @param {'chat' | 'work'} experience
     * @returns {{ composerFound: boolean, promptFound: boolean, modelButtons: number, actionButtons: number }}
     */
    function applySurfaceProjection(experience) {
        state.projectedChatSurfaceMode = experience;
        state.surfaceProjectionApplying = true;

        try {
            document.documentElement.dataset.gptModelPickerSurface = experience;
            document.body?.setAttribute('data-gpt-model-picker-surface', experience);

            const composer = getSurfaceComposerRoot();
            const promptEditor = getSurfacePromptEditor();
            const modelButtons = getSurfaceModelButtons();
            const actionButtons = getSurfaceActionButtons();

            if (composer instanceof HTMLElement) {
                composer.dataset.gptModelPickerSurface = experience;
            }

            if (promptEditor) {
                rememberOriginalAttribute(promptEditor, 'data-placeholder');
                rememberOriginalAttribute(promptEditor, 'aria-placeholder');
                rememberOriginalAttribute(promptEditor, 'placeholder');

                if (experience === 'work') {
                    promptEditor.setAttribute('data-placeholder', 'What should we work on?');
                    promptEditor.setAttribute('aria-placeholder', 'What should we work on?');
                    promptEditor.setAttribute('placeholder', 'What should we work on?');
                } else {
                    restoreOriginalAttribute(promptEditor, 'data-placeholder');
                    restoreOriginalAttribute(promptEditor, 'aria-placeholder');
                    restoreOriginalAttribute(promptEditor, 'placeholder');
                }
            }

            clearSurfaceBadges();

            for (const button of modelButtons) {
                button.dataset.gptModelPickerSurface = experience;
                setSurfaceBadge(button, experience);
            }

            for (const button of actionButtons) {
                button.dataset.gptModelPickerSurface = experience;
            }

            return {
                composerFound: composer instanceof Element,
                promptFound: Boolean(promptEditor),
                modelButtons: modelButtons.length,
                actionButtons: actionButtons.length
            };
        } finally {
            state.surfaceProjectionApplying = false;
        }
    }

    /** Планирует повторное применение визуальной проекции после React-render. */
    function scheduleSurfaceProjection() {
        if (!state.projectedChatSurfaceMode || state.surfaceProjectionApplying) {
            return;
        }

        if (state.surfaceProjectionTimer !== null) {
            window.clearTimeout(state.surfaceProjectionTimer);
        }

        state.surfaceProjectionTimer = window.setTimeout(() => {
            state.surfaceProjectionTimer = null;
            applySurfaceProjection(state.projectedChatSurfaceMode);
        }, 50);
    }

    /** Запускает наблюдение за composer, чтобы React-render не стирал визуальную проекцию. */
    function startSurfaceProjectionObserver() {
        if (state.surfaceProjectionObserver || typeof MutationObserver !== 'function') {
            return;
        }

        state.surfaceProjectionObserver = new MutationObserver(scheduleSurfaceProjection);
        state.surfaceProjectionObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    /** Очищает визуальную проекцию поверхности Chat/Work. */
    function clearSurfaceProjection() {
        state.projectedChatSurfaceMode = '';
        document.documentElement.removeAttribute('data-gpt-model-picker-surface');
        document.body?.removeAttribute('data-gpt-model-picker-surface');
        clearSurfaceBadges();

        const promptEditor = getSurfacePromptEditor();

        if (promptEditor) {
            restoreOriginalAttribute(promptEditor, 'data-placeholder');
            restoreOriginalAttribute(promptEditor, 'aria-placeholder');
            restoreOriginalAttribute(promptEditor, 'placeholder');
        }

        for (const element of document.querySelectorAll('[data-gpt-model-picker-surface]')) {
            if (element instanceof HTMLElement && element.id !== 'gpt-model-picker-panel') {
                delete element.dataset.gptModelPickerSurface;
            }
        }
    }

    /**
     * Находит React state-dispatcher, который владеет текущим Chat/Work surface.
     *
     * Поиск начинается от composer и принимает только hook с распознаваемым
     * значением surface и React queue.dispatch. Если найдено несколько разных
     * dispatch-функций, функция не угадывает нужную и завершает переключение
     * явной ошибкой.
     *
     * @returns {{dispatch: Function, value: 'chat' | 'chatgpt' | 'work'} | null}
     */
    function findChatSurfaceReactDispatcher() {
        const renderedMode = getRenderedChatSurfaceMode();
        const candidates = [];
        const seenCandidateDispatchers = new Set();

        /**
         * @param {object} fiber
         * @param {string} scope
         * @param {number} score
         */
        function collectHooks(fiber, scope, score) {
            let hook = fiber?.memoizedState;

            for (let hookIndex = 0; hook && hookIndex < 120; hookIndex += 1, hook = hook.next) {
                const dispatch = hook.queue?.dispatch;

                if (typeof dispatch !== 'function' || seenCandidateDispatchers.has(dispatch)) {
                    continue;
                }

                const stateValue = hook.queue?.lastRenderedState ?? hook.memoizedState;
                const normalizedMode = normalizeNativeChatSurfaceValue(stateValue);

                if (!normalizedMode) {
                    continue;
                }

                seenCandidateDispatchers.add(dispatch);
                candidates.push({
                    dispatch,
                    value: stateValue,
                    mode: normalizedMode,
                    scope,
                    score: score + (renderedMode && normalizedMode === renderedMode ? 20 : 0)
                });
            }
        }

        const anchors = getChatSurfaceFiberAnchors();
        const seenAncestors = new Set();

        for (const anchor of anchors) {
            let fiber = getNearestReactFiber(anchor);

            for (let depth = 0; fiber && depth < 160; depth += 1, fiber = fiber.return) {
                if (seenAncestors.has(fiber)) {
                    continue;
                }

                seenAncestors.add(fiber);
                collectHooks(fiber, 'ancestor', 100 - depth);
            }
        }

        if (candidates.length === 0) {
            const seenFibers = new Set();
            const roots = getReactRootFibers();

            for (const root of roots) {
                const stack = [root];

                while (stack.length > 0) {
                    const fiber = stack.pop();

                    if (!fiber || seenFibers.has(fiber)) {
                        continue;
                    }

                    seenFibers.add(fiber);
                    collectHooks(fiber, 'root', renderedMode ? 20 : 0);

                    for (let child = fiber.child; child; child = child.sibling) {
                        stack.push(child);
                    }
                }
            }
        }

        if (candidates.length === 0) {
            return null;
        }

        const sortedCandidates = candidates.sort((left, right) => right.score - left.score);
        const bestScore = sortedCandidates[0].score;
        const bestCandidates = sortedCandidates.filter((candidate) => candidate.score === bestScore);

        if (bestCandidates.length > 1) {
            const values = bestCandidates.map((candidate) => `${candidate.scope}:${String(candidate.value)}`).join(', ');

            throw new Error(
                `Найдено несколько React Chat/Work state-dispatchers (${bestCandidates.length}: ${values}); UI не изменён`
            );
        }

        return bestCandidates[0];
    }

    /**
     * Переключает уже отрисованный ChatGPT composer между Chat и Work in-place.
     *
     * Функция не ищет и не нажимает штатный Chat/Work toggle. Когда удаётся найти
     * React state-dispatcher, вызывается штатный React render. Если dispatcher не
     * найден, применяется визуальная проекция результата: composer, model picker,
     * поле ввода и action button получают видимое состояние выбранной поверхности.
     *
     * @param {'chat' | 'work'} experience
     * @returns {'already-rendered' | 'react-dispatch'}
     */
    function applyRenderedChatSurfaceMode(experience) {
        const renderedMode = getRenderedChatSurfaceMode();
        const candidate = renderedMode === experience ? null : findChatSurfaceReactDispatcher();

        if (candidate) {
            const nextValue = experience === 'work'
                ? 'work'
                : candidate.value === 'chatgpt'
                    ? 'chatgpt'
                    : 'chat';

            candidate.dispatch(nextValue);
            const projection = applySurfaceProjection(experience);
            startSurfaceProjectionObserver();

            return `react-dispatch; projection composer=${projection.composerFound ? 'yes' : 'no'} prompt=${projection.promptFound ? 'yes' : 'no'} model=${projection.modelButtons} action=${projection.actionButtons}`;
        }

        const projection = applySurfaceProjection(experience);
        startSurfaceProjectionObserver();

        return `visual-projection; rendered=${renderedMode || 'unknown'} composer=${projection.composerFound ? 'yes' : 'no'} prompt=${projection.promptFound ? 'yes' : 'no'} model=${projection.modelButtons} action=${projection.actionButtons}`;
    }

    /**
     * Синхронизирует поверхность штатного web-клиента с Chat или Work без reload.
     *
     * Сначала записываются те же persisted surface-значения, которыми пользуется
     * ChatGPT. Затем напрямую обновляется React state текущего composer; штатный
     * Chat/Work toggle для этого не требуется и не вызывается. URL, history,
     * navigation, reload, branch, handoff и backend-конвертация не используются.
     *
     * @param {'chat' | 'work'} experience
     */
    function syncNativeChatSurfaceMode(experience) {
        if (!['chat', 'work'].includes(experience)) {
            throw new Error(`Unsupported native chat surface: ${experience}`);
        }

        const surfaceMode = experience === 'work' ? 'work' : 'chat';
        const serializedMode = JSON.stringify(surfaceMode);

        localStorage.setItem(config.nativeChatSurfaceStorageKey, serializedMode);
        document.cookie = [
            `${config.nativeChatSurfaceCookieName}=${encodeURIComponent(surfaceMode)}`,
            'Path=/',
            `Max-Age=${config.nativeChatSurfaceMaxAgeSeconds}`,
            'Secure',
            'SameSite=Lax'
        ].join('; ');

        if (experience === 'chat') {
            const expiresAt = Date.now() + config.nativeChatOverrideDurationMs;

            document.cookie = [
                `${config.nativeChatOverrideCookieName}=${expiresAt}`,
                'Path=/',
                `Max-Age=${Math.floor(config.nativeChatOverrideDurationMs / 1000)}`,
                'Secure',
                'SameSite=Lax'
            ].join('; ');
        } else {
            document.cookie = [
                `${config.nativeChatOverrideCookieName}=`,
                'Path=/',
                'Max-Age=0',
                'Secure',
                'SameSite=Lax'
            ].join('; ');
        }

        return applyRenderedChatSurfaceMode(experience);
    }

    /**
     * Устанавливает режим UI Chat/Work и сохраняет состояние панели.
     *
     * Auto не трогает штатную поверхность и сохраняет conversation_origin исходного
     * запроса. Chat и Work после явного выбора синхронизируют persisted surface,
     * React state текущего composer и соответствующий conversation_origin запросов.
     * Chat Mode и Backend fields могут затем задать другое финальное backend-значение.
     * Инициализация панели только восстанавливает сохранённое значение контрола.
     *
     * @param {'auto' | 'chat' | 'work'} experience
     * @param {boolean} persist
     */
    function setSelectedConversationExperience(experience, persist) {
        if (!['auto', 'chat', 'work'].includes(experience)) {
            throw new Error(`Unsupported conversation experience: ${experience}`);
        }

        state.selectedConversationExperience = experience;

        let surfaceSyncError = null;
        let surfaceSyncResult = '';

        if (persist) {
            localStorage.setItem(config.conversationExperienceStorageKey, experience);

            if (experience !== 'auto') {
                try {
                    surfaceSyncResult = syncNativeChatSurfaceMode(experience);
                } catch (error) {
                    surfaceSyncError = error;
                }
            } else {
                clearSurfaceProjection();
            }
        }

        if (state.conversationExperienceSelect) {
            state.conversationExperienceSelect.value = experience;
        }

        updateSelectedStatus();

        if (surfaceSyncError) {
            updateRequestStatus(`UI ${experience.toUpperCase()}: ${surfaceSyncError.message}`, 'error');
        } else if (surfaceSyncResult) {
            updateRequestStatus(`UI ${experience.toUpperCase()}: ${surfaceSyncResult}`, 'success');
        } else if (experience === 'auto' && persist) {
            updateRequestStatus('UI AUTO: визуальная проекция очищена', 'neutral');
        }

        restoreHook();
    }

    /**
     * Устанавливает отдельный backend-переключатель Chat Mode и сохраняет состояние.
     *
     * Включённый режим добавляет к явно выбранной модели Chat-сигналы исходящего
     * payload независимо от визуальной поверхности Chat/Work. Ручные значения
     * блока Backend fields применяются после этого пресета и могут переопределить
     * любой его сигнал. Переключатель не выполняет navigation, reload, branch
     * или backend-конвертацию.
     *
     * @param {boolean} enabled
     * @param {boolean} persist
     */
    function setForceChatEnabled(enabled, persist) {
        state.forceChatEnabled = Boolean(enabled);

        if (persist) {
            localStorage.setItem(config.forceChatStorageKey, String(state.forceChatEnabled));
        }

        if (state.forceChatCheckbox) {
            state.forceChatCheckbox.checked = state.forceChatEnabled;
        }

        updateSelectedStatus();
        restoreHook();
    }

    /**
     * Читает сохранённые ручные backend-переопределения и отбрасывает неизвестные ключи.
     *
     * @returns {Record<string, { mode: string, customValue: string }>}
     */
    function loadBackendOverrides() {
        let stored;

        try {
            stored = JSON.parse(localStorage.getItem(config.backendOverridesStorageKey) || '{}');
        } catch (error) {
            log('stored backend overrides are invalid', error);
            return {};
        }

        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
            return {};
        }

        const result = {};

        for (const definition of backendFieldDefinitions) {
            const setting = stored[definition.key];
            const allowedModes = new Set(definition.options.map(([mode]) => mode));

            if (!setting || typeof setting !== 'object' || !allowedModes.has(setting.mode)) {
                continue;
            }

            result[definition.key] = {
                mode: setting.mode,
                customValue: typeof setting.customValue === 'string' ? setting.customValue : ''
            };
        }

        return result;
    }

    /**
     * Обновляет JSON-поле одного backend-контрола.
     *
     * В Auto поле read-only показывает фактическое значение последнего исходящего
     * payload. Для фиксированных ручных режимов оно показывает итоговое значение,
     * которое будет записано. При Custom это же поле становится редактируемым и
     * используется как источник точного JSON. Отсутствующее поле отображается
     * пустым значением с поясняющим placeholder, чтобы не смешивать отсутствие с null.
     *
     * @param {string} key
     */
    function renderBackendOverrideControl(key) {
        const controls = state.backendOverrideControls[key];

        if (!controls) {
            return;
        }

        const definition = backendFieldDefinitions.find((item) => item.key === key);
        const setting = getBackendOverrideSetting(key);
        const snapshot = state.backendFieldSnapshots[key];

        controls.select.value = setting.mode;
        controls.input.readOnly = setting.mode !== 'custom';
        controls.input.disabled = false;
        controls.input.classList.remove('has-invalid-value');

        if (setting.mode === 'custom') {
            controls.input.value = setting.customValue;
            controls.input.placeholder = 'Custom JSON';
            controls.input.title = 'Введите валидный JSON: строку в кавычках, число, boolean, null, объект или массив';
            return;
        }

        if (setting.mode === 'delete') {
            controls.input.value = '';
            controls.input.placeholder = 'поле будет удалено';
            controls.input.title = 'Ручной режим удалит поле из исходящего payload';
            return;
        }

        if (setting.mode !== 'preserve') {
            const value = resolveBackendOverrideValue(setting, definition?.label || key);

            controls.input.value = JSON.stringify(value);
            controls.input.placeholder = '';
            controls.input.title = 'Финальное ручное JSON-значение исходящего payload';
            return;
        }

        if (!snapshot?.observed) {
            controls.input.value = '';
            controls.input.placeholder = 'ещё не наблюдалось';
            controls.input.title = 'Значение появится после перехвата подходящего исходящего запроса';
            return;
        }

        if (!snapshot.present) {
            controls.input.value = '';
            controls.input.placeholder = 'поле отсутствует';
            controls.input.title = 'В последнем исходящем payload это поле отсутствовало';
            return;
        }

        controls.input.value = JSON.stringify(snapshot.value);
        controls.input.placeholder = '';
        controls.input.title = 'Фактическое JSON-значение в последнем исходящем payload';
    }

    /**
     * Сохраняет независимое ручное backend-переопределение.
     *
     * @param {string} key
     * @param {string} mode
     * @param {string} customValue
     * @param {boolean} persist
     */
    function setBackendOverride(key, mode, customValue, persist) {
        const definition = backendFieldDefinitions.find((item) => item.key === key);

        if (!definition || !definition.options.some(([optionMode]) => optionMode === mode)) {
            throw new Error(`Unsupported backend override: ${key} / ${mode}`);
        }

        const normalizedCustomValue = mode === 'custom'
            ? String(customValue || 'null')
            : String(customValue || '');

        if (mode === 'custom') {
            resolveBackendOverrideValue(
                { mode, customValue: normalizedCustomValue },
                definition.label
            );
        }

        state.backendOverrides[key] = {
            mode,
            customValue: normalizedCustomValue
        };

        if (persist) {
            localStorage.setItem(config.backendOverridesStorageKey, JSON.stringify(state.backendOverrides));
        }

        renderBackendOverrideControl(key);
        updateSelectedStatus();
        restoreHook();
    }

    /**
     * Возвращает компактный снимок модели для постоянной истории каталогов.
     *
     * Снимок содержит slug, название, источник, временные метки и объявленный
     * список thinking effort. Остальные поля каталога в localStorage не сохраняются.
     *
     * @param {Record<string, any>} model
     * @param {'work' | 'chat'} source
     * @param {Record<string, any> | null} previous
     * @param {string} seenAt
     * @returns {Record<string, any> | null}
     */
    function createModelHistorySnapshot(model, source, previous, seenAt) {
        const slug = String(model?.slug || '').trim();

        if (!slug) {
            return null;
        }

        const catalogEfforts = getModelThinkingEfforts(model);
        const thinkingEfforts = catalogEfforts === null
            ? null
            : catalogEfforts
                .filter((effort) => typeof effort === 'object' && effort?.thinking_effort)
                .map((effort) => ({
                    thinking_effort: String(effort.thinking_effort),
                    short_label: String(effort.short_label || ''),
                    full_label: String(effort.full_label || ''),
                    mobile_full_label: String(effort.mobile_full_label || '')
                }));

        return {
            slug,
            title: String(model.title || previous?.title || slug),
            source,
            thinking_efforts: thinkingEfforts,
            first_seen_at: String(previous?.first_seen_at || seenAt),
            last_seen_at: seenAt
        };
    }

    /**
     * Читает сохранённую историю моделей и возвращает только записи с непустым slug.
     *
     * @returns {Array<Record<string, any>>}
     */
    function loadModelHistory() {
        try {
            const storedHistory = JSON.parse(localStorage.getItem(config.modelHistoryStorageKey) || '[]');

            return Array.isArray(storedHistory)
                ? storedHistory.filter((model) => typeof model?.slug === 'string' && model.slug)
                : [];
        } catch (error) {
            log('stored model history is invalid', error);
            return [];
        }
    }

    /**
     * Объединяет текущие UI-каталоги с постоянной историей.
     *
     * Каждая модель из успешного ответа обновляет свой снимок. Записи, отсутствующие
     * в текущих Work и ChatGPT каталогах, переходят в historicalModels и сохраняют
     * возможность ручного выбора.
     */
    function updateModelHistory() {
        const seenAt = new Date().toISOString();
        const snapshotsBySlug = new Map(
            loadModelHistory().map((model) => [model.slug, model])
        );

        for (const [source, models] of [
            ['work', state.workModels],
            ['chat', state.chatModels]
        ]) {
            for (const model of models) {
                const snapshot = createModelHistorySnapshot(
                    model,
                    source,
                    snapshotsBySlug.get(model.slug) || null,
                    seenAt
                );

                if (snapshot) {
                    snapshotsBySlug.set(snapshot.slug, snapshot);
                }
            }
        }

        state.modelHistory = [...snapshotsBySlug.values()]
            .sort((left, right) => String(right.last_seen_at).localeCompare(String(left.last_seen_at)));

        localStorage.setItem(config.modelHistoryStorageKey, JSON.stringify(state.modelHistory));

        const currentSlugs = new Set(
            [...state.workModels, ...state.chatModels]
                .map((model) => model.slug)
                .filter(Boolean)
        );

        state.historicalModels = state.modelHistory.filter((model) => !currentSlugs.has(model.slug));
    }

    /**
     * Добавляет модели одной группы в select и помечает происхождение каждого пункта.
     *
     * @param {HTMLSelectElement} select
     * @param {string} label
     * @param {Array<{ slug?: string, title?: string }>} models
     * @param {'current' | 'historical' | 'experimental'} kind
     */
    function appendModelGroup(select, label, models, kind) {
        const group = createElement('optgroup', { label });

        for (const model of models) {
            if (!model.slug) {
                continue;
            }

            const option = createElement('option', { value: model.slug });
            const suffix = kind === 'historical'
                ? ' [история]'
                : kind === 'experimental'
                    ? ' [API-only]'
                    : '';

            option.textContent = `${model.title || model.slug} — ${model.slug}${suffix}`;
            option.dataset.modelKind = kind;
            option.classList.toggle('is-historical-model', kind === 'historical');
            option.classList.toggle('is-experimental-model', kind === 'experimental');
            option.title = kind === 'historical'
                ? 'Модель присутствовала в UI-каталоге раньше, но отсутствует сейчас'
                : kind === 'experimental'
                    ? 'Экспериментальный slug из каталога OpenAI API, отсутствующий в UI'
                    : 'Модель присутствует в текущем UI-каталоге';
            group.append(option);
        }

        if (group.children.length > 0) {
            select.append(group);
        }
    }

    /** Обновляет цвет model select в соответствии с происхождением выбранного slug. */
    function updateModelSelectAppearance() {
        if (!state.select) {
            return;
        }

        const selectedOption = state.select.selectedOptions[0];
        const kind = selectedOption?.dataset.modelKind || 'current';

        state.select.classList.toggle('has-historical-model', kind === 'historical');
        state.select.classList.toggle('has-experimental-model', kind === 'experimental');
        state.select.title = selectedOption?.title || '';
    }

    /** Возвращает описание выбранной модели из текущих, исторических и экспериментальных источников. */
    function getSelectedModel() {
        if (state.selectedModelSlug === config.autoModelSlug) {
            return null;
        }

        return [
            ...state.workModels,
            ...state.chatModels,
            ...state.historicalModels,
            ...state.experimentalModels
        ].find((model) => model.slug === state.selectedModelSlug) || null;
    }

    /**
     * Возвращает объявленный моделью список thinking effort или null, если каталог не содержит список.
     *
     * @param {Record<string, any> | null} model
     * @returns {Array<Record<string, any>> | null}
     */
    function getModelThinkingEfforts(model) {
        if (!model) {
            return null;
        }

        if (Array.isArray(model.thinking_efforts)) {
            return model.thinking_efforts;
        }

        if (Array.isArray(model.thinkingEfforts)) {
            return model.thinkingEfforts;
        }

        return null;
    }

    /**
     * Возвращает описание thinking effort из объявленного каталожного списка выбранной модели.
     *
     * @param {Array<Record<string, any>> | null} efforts
     * @param {string} value
     * @returns {Record<string, any> | null}
     */
    function getModelThinkingEffortDetails(efforts, value) {
        if (!efforts) {
            return null;
        }

        return efforts.find((effort) => {
            return typeof effort === 'object' && effort?.thinking_effort === value;
        }) || null;
    }

    /**
     * Заполняет доступный для любой модели список thinking effort.
     *
     * Каталожные подписи отображаются для объявленных режимов. Режимы, отсутствующие
     * в явно переданном моделью списке, сохраняют возможность выбора и получают
     * предупреждающий цвет. При отсутствии самого списка поддержка не предполагается.
     */
    function renderThinkingEfforts() {
        if (!state.thinkingSelect) {
            return;
        }

        const selectedModel = getSelectedModel();
        const catalogEfforts = getModelThinkingEfforts(selectedModel);
        const catalogDefinesEfforts = catalogEfforts !== null;
        state.thinkingSelect.disabled = false;
        state.thinkingSelect.replaceChildren();

        for (const effort of thinkingEffortOptions) {
            const details = getModelThinkingEffortDetails(catalogEfforts, effort.value);
            const catalogLabel = details?.short_label || details?.full_label || details?.mobile_full_label;
            const unsupported = effort.value !== 'auto' && catalogDefinesEfforts && !details;
            const optionLabel = catalogLabel ? `${catalogLabel} — ${effort.value}` : effort.label;
            const option = createElement('option', { value: effort.value }, optionLabel);

            option.disabled = false;
            option.classList.toggle('is-unsupported', unsupported);

            if (unsupported) {
                option.title = 'Режим отсутствует в каталоге модели, но доступен для ручной передачи';
            }

            state.thinkingSelect.append(option);
        }

        state.thinkingSelect.value = state.selectedThinkingEffort;

        const selectedUnsupported = state.selectedThinkingEffort !== 'auto'
            && catalogDefinesEfforts
            && !getModelThinkingEffortDetails(catalogEfforts, state.selectedThinkingEffort);

        state.thinkingSelect.classList.toggle('has-unsupported-value', selectedUnsupported);
        state.thinkingSelect.title = selectedUnsupported
            ? 'Выбранный режим отсутствует в каталоге модели, но будет передан вручную'
            : '';
    }

    /**
     * Заполняет model select текущими UI-моделями, историей и экспериментальными API-only slug.
     *
     * Текущие UI-модели имеют штатный цвет. Исторические и API-only пункты остаются
     * выбираемыми и получают отдельные цвета. Неизвестный ручной slug отображается
     * в собственной группе без предположений о происхождении.
     */
    function renderModels() {
        if (!state.select) {
            return;
        }

        const currentSlugs = new Set(
            [...state.workModels, ...state.chatModels]
                .map((model) => model.slug)
                .filter(Boolean)
        );
        const historicalSlugs = new Set(state.historicalModels.map((model) => model.slug));
        const visibleExperimentalModels = state.experimentalModels.filter((model) => {
            return !currentSlugs.has(model.slug) && !historicalSlugs.has(model.slug);
        });

        state.select.replaceChildren();

        const bypassOption = createElement('option', { value: config.autoModelSlug }, 'Не изменять модель');
        bypassOption.dataset.modelKind = 'current';
        bypassOption.title = 'Полный bypass без изменения исходящего payload';
        state.select.append(bypassOption);

        appendModelGroup(state.select, 'Модели Work / TPP', state.workModels, 'current');
        appendModelGroup(state.select, 'Обычный ChatGPT', state.chatModels, 'current');
        appendModelGroup(state.select, 'Исторические модели', state.historicalModels, 'historical');
        appendModelGroup(state.select, 'Экспериментальные модели OpenAI API', visibleExperimentalModels, 'experimental');

        const allModels = [
            ...state.workModels,
            ...state.chatModels,
            ...state.historicalModels,
            ...visibleExperimentalModels
        ];

        if (
            state.selectedModelSlug
            && state.selectedModelSlug !== config.autoModelSlug
            && !allModels.some((model) => model.slug === state.selectedModelSlug)
        ) {
            const group = createElement('optgroup', { label: 'Ручной slug' });
            const option = createElement('option', { value: state.selectedModelSlug }, `${state.selectedModelSlug} — вручную`);

            option.dataset.modelKind = 'current';
            group.append(option);
            state.select.append(group);
        }

        state.select.value = state.selectedModelSlug;
        updateModelSelectAppearance();
        renderThinkingEfforts();
    }

    /**
     * Возвращает bearer-токен текущей сессии ChatGPT.
     *
     * Значение используется только в памяти и не записывается в состояние
     * расширения, DOM, console или localStorage.
     *
     * @returns {Promise<string>}
     */
    async function loadSessionAccessToken() {
        const response = await state.baseFetch.call(window, '/api/auth/session', {
            credentials: 'include',
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`/api/auth/session: HTTP ${response.status}`);
        }

        const session = await response.json();
        const accessToken = session?.accessToken;

        if (typeof accessToken !== 'string' || !accessToken) {
            throw new Error('/api/auth/session: accessToken отсутствует');
        }

        return accessToken;
    }

    /**
     * Загружает и возвращает JSON backend-метода.
     *
     * @param {string} url
     * @returns {Promise<Record<string, any>>}
     */
    async function loadJson(url) {
        let response = await state.baseFetch.call(window, url, {
            credentials: 'include'
        });

        if (url === config.workModelsUrl && response.status === 404) {
            const accessToken = await loadSessionAccessToken();

            response = await state.baseFetch.call(window, url, {
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`
                }
            });
        }

        if (!response.ok) {
            throw new Error(`${url}: HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * Загружает отдельные каталоги Work и обычного ChatGPT.
     *
     * После ошибки автоматически повторяет загрузку ограниченное число раз.
     *
     * @param {number} [attempt]
     */
    async function loadModels(attempt = 0) {
        setStatus(state.catalogStatus, 'Каталоги: загрузка…', 'neutral');

        const [workResult, chatResult] = await Promise.allSettled([
            loadJson(config.workModelsUrl),
            loadJson(config.chatModelsUrl)
        ]);
        const errors = [];

        if (workResult.status === 'fulfilled') {
            state.workModels = Array.isArray(workResult.value.models) ? workResult.value.models : [];
            state.workDefaultModelSlug = String(workResult.value.default_model_slug || '');
        } else {
            state.workModels = [];
            errors.push(workResult.reason.message);
        }

        if (chatResult.status === 'fulfilled') {
            state.chatModels = Array.isArray(chatResult.value.models) ? chatResult.value.models : [];
        } else {
            state.chatModels = [];
            errors.push(chatResult.reason.message);
        }

        updateModelHistory();

        if (!state.selectedModelSlug) {
            setSelectedModel(
                localStorage.getItem(config.storageKey) || config.autoModelSlug,
                false
            );
        }

        renderModels();

        if (errors.length > 0) {
            if (attempt < config.catalogRetryCount) {
                setStatus(
                    state.catalogStatus,
                    `Каталоги: повтор ${attempt + 1}/${config.catalogRetryCount}…`,
                    'warning'
                );
                window.setTimeout(() => loadModels(attempt + 1), config.catalogRetryDelayMs);
            } else {
                setStatus(state.catalogStatus, `Каталоги: ${errors.join('; ')}`, 'error');
            }
        } else {
            setStatus(
                state.catalogStatus,
                `Каталоги: Work ${state.workModels.length}; ChatGPT ${state.chatModels.length}; история ${state.historicalModels.length}; API ${state.experimentalModels.length}`,
                'success'
            );
        }

        log('model catalogs loaded', {
            workModels: state.workModels,
            chatModels: state.chatModels,
            historicalModels: state.historicalModels,
            experimentalModels: state.experimentalModels,
            workDefaultModelSlug: state.workDefaultModelSlug,
            attempt
        });
    }

    /** Возвращает защитный accessor после его удаления сторонним JavaScript. */
    function restoreHook() {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');

        if (descriptor?.get !== getGuardedFetch || descriptor?.set !== setGuardedFetch) {
            const currentFetch = window.fetch;

            if (typeof currentFetch === 'function' && currentFetch !== fetchWithSelectedModel) {
                state.downstreamFetch = currentFetch;
            }

            installFetchGuard();
        }

        updateHookStatus();
    }

    /**
     * Ограничивает координаты панели видимой областью окна.
     *
     * @param {number} left
     * @param {number} top
     * @returns {{ left: number, top: number }}
     */
    function clampPanelPosition(left, top) {
        const rect = state.panel.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);

        return {
            left: Math.min(Math.max(0, left), maxLeft),
            top: Math.min(Math.max(0, top), maxTop)
        };
    }

    /**
     * Устанавливает фиксированную позицию панели.
     *
     * @param {number} left
     * @param {number} top
     */
    function setPanelPosition(left, top) {
        const position = clampPanelPosition(left, top);

        state.panel.style.left = `${position.left}px`;
        state.panel.style.top = `${position.top}px`;
        state.panel.style.right = 'auto';
        state.panel.style.bottom = 'auto';
    }

    /** Сохраняет текущую позицию панели в localStorage. */
    function savePanelPosition() {
        const rect = state.panel.getBoundingClientRect();

        localStorage.setItem(config.positionStorageKey, JSON.stringify({
            left: rect.left,
            top: rect.top
        }));
    }

    /** Восстанавливает сохранённую позицию панели. */
    function restorePanelPosition() {
        const storedPosition = localStorage.getItem(config.positionStorageKey);

        if (!storedPosition) {
            return;
        }

        try {
            const position = JSON.parse(storedPosition);

            if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
                setPanelPosition(position.left, position.top);
            }
        } catch (error) {
            log('stored panel position is invalid', error);
        }
    }

    /** Сохраняет пользовательский размер развёрнутой панели. */
    function savePanelSize() {
        if (!state.panel || state.collapsed) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();

        localStorage.setItem(config.sizeStorageKey, JSON.stringify({
            width: rect.width,
            height: rect.height
        }));
    }

    /** Восстанавливает сохранённый размер панели с учётом текущего viewport. */
    function restorePanelSize() {
        const storedSize = localStorage.getItem(config.sizeStorageKey);

        if (!storedSize) {
            return;
        }

        try {
            const size = JSON.parse(storedSize);

            if (Number.isFinite(size?.width) && Number.isFinite(size?.height)) {
                const maxWidth = Math.max(260, window.innerWidth - 16);
                const maxHeight = Math.max(220, window.innerHeight - 16);
                const width = Math.min(Math.max(260, size.width), maxWidth);
                const height = Math.min(Math.max(220, size.height), maxHeight);

                state.panel.style.width = `${width}px`;
                state.panel.style.height = `${height}px`;
            }
        } catch (error) {
            log('stored panel size is invalid', error);
        }
    }

    /** Сохраняет размер после ручного изменения панели и удерживает её в viewport. */
    function handlePanelResize() {
        if (!state.panel || state.collapsed) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top);
        savePanelSize();
    }

    /**
     * Сворачивает или разворачивает панель и сохраняет состояние.
     *
     * @param {boolean} collapsed
     * @param {boolean} persist
     */
    function setPanelCollapsed(collapsed, persist) {
        state.collapsed = collapsed;
        state.panel.classList.toggle('is-collapsed', collapsed);
        state.collapseButton.textContent = collapsed ? '+' : '\u2212';
        state.collapseButton.setAttribute('aria-label', collapsed ? '\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c' : '\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0430\u043d\u0435\u043b\u044c');
        state.collapseButton.setAttribute('aria-expanded', String(!collapsed));

        if (persist) {
            localStorage.setItem(config.collapsedStorageKey, String(collapsed));
        }

        const rect = state.panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top);
    }

    /** Начинает перемещение панели за шапку. */
    function handleHeaderPointerDown(event) {
        if (event.button !== 0 || event.target.closest('button')) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();

        state.dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startLeft: rect.left,
            startTop: rect.top
        };
        state.header.classList.add('is-dragging');
        state.header.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    /** Перемещает панель вслед за активным указателем. */
    function handleHeaderPointerMove(event) {
        if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
            return;
        }

        setPanelPosition(
            state.dragState.startLeft + event.clientX - state.dragState.startX,
            state.dragState.startTop + event.clientY - state.dragState.startY
        );
    }

    /** Завершает перемещение панели и сохраняет позицию. */
    function handleHeaderPointerUp(event) {
        if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
            return;
        }

        state.header.classList.remove('is-dragging');

        if (state.header.hasPointerCapture(event.pointerId)) {
            state.header.releasePointerCapture(event.pointerId);
        }

        state.dragState = null;
        savePanelPosition();
    }

    /** Возвращает панель в видимую область после изменения размера окна. */
    function handleWindowResize() {
        if (!state.panel) {
            return;
        }

        const rect = state.panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top);
        savePanelPosition();
    }

    /** Применяет ручной slug после каждого изменения поля ввода. */
    function handleManualModelInput() {
        setSelectedModel(state.input.value, true);
        renderModels();
    }

    /**
     * Добавляет компактную изменяемую по размеру панель управления и диагностики.
     *
     * Шапка содержит иконку, название и версию и служит областью перемещения.
     * Модель, thinking effort, скорость, UI Chat/Work, Chat Mode и независимые backend-поля
     * применяются сразу после подтверждения значения, кроме полного bypass пункта
     * «Не изменять модель». Размер и положение панели
     * сохраняются между перезагрузками страницы.
     */
    function createPanel() {
        const panel = createElement('section', {
            id: 'gpt-model-picker-panel',
            role: 'dialog',
            'aria-label': 'Выбор и контроль модели ChatGPT'
        });
        const header = createElement('div', { class: 'gpt-model-picker-header' });
        const identity = createElement('div', { class: 'gpt-model-picker-identity' });
        const icon = createElement('div', { class: 'gpt-model-picker-app-icon', 'aria-hidden': 'true' });
        const titleCopy = createElement('div', { class: 'gpt-model-picker-title-copy' });
        const title = createElement('div', { class: 'gpt-model-picker-title' }, 'GPT Models');
        const version = createElement('div', { class: 'gpt-model-picker-version' }, `ChatGPT · v${config.version}`);
        const collapseButton = createElement('button', {
            class: 'gpt-model-picker-collapse',
            type: 'button',
            'aria-label': 'Свернуть панель',
            'aria-expanded': 'true'
        }, '−');
        const content = createElement('div', { class: 'gpt-model-picker-content' });
        const modelLabel = createElement('label', { class: 'gpt-model-picker-field' });
        const modelLabelText = createElement('span', { class: 'gpt-model-picker-field-label' }, 'Модель');
        const select = createElement('select', {
            class: 'gpt-model-picker-select',
            'aria-label': 'Модель ChatGPT'
        });
        const inputLabel = createElement('label', { class: 'gpt-model-picker-field' });
        const inputLabelText = createElement('span', { class: 'gpt-model-picker-field-label' }, 'Ручной slug');
        const input = createElement('input', {
            class: 'gpt-model-picker-input',
            type: 'text',
            placeholder: 'model_slug вручную',
            'aria-label': 'Идентификатор модели вручную'
        });
        const thinkingLabel = createElement('label', { class: 'gpt-model-picker-field' });
        const thinkingLabelText = createElement('span', { class: 'gpt-model-picker-field-label' }, 'Как сильно думать');
        const thinkingSelect = createElement('select', {
            class: 'gpt-model-picker-select',
            'aria-label': 'Глубина рассуждения'
        });
        const conversationExperienceLabel = createElement('label', { class: 'gpt-model-picker-field' });
        const conversationExperienceLabelText = createElement('span', { class: 'gpt-model-picker-field-label' }, 'UI Chat / Work');
        const conversationExperienceSelect = createElement('select', {
            class: 'gpt-model-picker-select',
            'aria-label': 'Режим разговора Chat или Work'
        });
        const toggles = createElement('div', { class: 'gpt-model-picker-toggles' });
        const fastLabel = createElement('label', { class: 'gpt-model-picker-toggle' });
        const fastCheckbox = createElement('input', {
            class: 'gpt-model-picker-checkbox',
            type: 'checkbox',
            'aria-label': 'Скорость 1.5x'
        });
        const fastText = createElement('span', {}, 'Скорость 1.5x');
        const forceChatLabel = createElement('label', { class: 'gpt-model-picker-toggle' });
        const forceChatCheckbox = createElement('input', {
            class: 'gpt-model-picker-checkbox',
            type: 'checkbox',
            'aria-label': 'Chat Mode'
        });
        const forceChatText = createElement('span', {}, 'Chat Mode');
        const backendOverrides = createElement('div', { class: 'gpt-model-picker-backend-overrides' });
        const backendOverridesTitle = createElement(
            'div',
            { class: 'gpt-model-picker-backend-title' },
            'Backend fields — текущее / ручное JSON'
        );
        const backendOverrideControls = {};

        backendOverrides.append(backendOverridesTitle);

        for (const definition of backendFieldDefinitions) {
            const field = createElement('label', { class: 'gpt-model-picker-backend-field' });
            const label = createElement('span', { class: 'gpt-model-picker-field-label' }, definition.label);
            const row = createElement('div', { class: 'gpt-model-picker-backend-row' });
            const overrideSelect = createElement('select', {
                class: 'gpt-model-picker-select gpt-model-picker-backend-select',
                'aria-label': `Ручное значение ${definition.label}`
            });
            const customInput = createElement('input', {
                class: 'gpt-model-picker-input gpt-model-picker-backend-input',
                type: 'text',
                placeholder: 'Custom JSON',
                'aria-label': `Текущее или ручное JSON-значение ${definition.label}`
            });

            for (const [value, optionLabel] of definition.options) {
                overrideSelect.append(createElement('option', { value }, optionLabel));
            }

            row.append(overrideSelect, customInput);
            field.append(label, row);
            backendOverrides.append(field);
            backendOverrideControls[definition.key] = {
                select: overrideSelect,
                input: customInput
            };
        }

        const diagnostics = createElement('div', { class: 'gpt-model-picker-diagnostics' });
        const hookStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status' });
        const catalogStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status' }, 'Каталоги: инициализация…');
        const selectedStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status' }, 'Выбрано: инициализация…');
        const requestStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status' }, 'Запрос: ещё не отправлялся');
        const backendStatus = createElement('div', { class: 'gpt-model-picker-status', role: 'status' }, 'Backend: ещё не проверен');
        const hint = createElement('div', { class: 'gpt-model-picker-hint' }, 'JSON-поле показывает фактическое/итоговое значение. В режиме Custom оно становится редактором. Порядок: UI Chat/Work → Chat Mode → Backend fields; ручные backend-поля имеют максимальный приоритет. Расширение не делает redirect, branch, handoff или конвертацию conversation.');

        icon.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#69afed"/><path d="M9 11.5h14M9 16h9M9 20.5h12" fill="none" stroke="#0f1720" stroke-width="2.2" stroke-linecap="round"/><circle cx="23" cy="20.5" r="2.2" fill="#f2f5f8"/></svg>';
        titleCopy.append(title, version);
        identity.append(icon, titleCopy);
        header.append(identity, collapseButton);
        modelLabel.append(modelLabelText, select);
        inputLabel.append(inputLabelText, input);
        thinkingLabel.append(thinkingLabelText, thinkingSelect);
        conversationExperienceLabel.append(conversationExperienceLabelText, conversationExperienceSelect);
        for (const option of [
            { value: 'auto', label: 'Auto — не вмешиваться' },
            { value: 'chat', label: 'Chat' },
            { value: 'work', label: 'Work' }
        ]) {
            conversationExperienceSelect.append(createElement('option', { value: option.value }, option.label));
        }
        fastLabel.append(fastCheckbox, fastText);
        forceChatLabel.append(forceChatCheckbox, forceChatText);
        toggles.append(fastLabel, forceChatLabel);
        diagnostics.append(hookStatus, catalogStatus, selectedStatus, requestStatus, backendStatus);
        content.append(modelLabel, inputLabel, thinkingLabel, conversationExperienceLabel, toggles, backendOverrides, diagnostics, hint);
        panel.append(header, content);
        document.body.append(panel);

        Object.assign(state, {
            panel,
            header,
            collapseButton,
            select,
            input,
            thinkingSelect,
            fastCheckbox,
            conversationExperienceSelect,
            forceChatCheckbox,
            backendOverrideControls,
            hookStatus,
            catalogStatus,
            selectedStatus,
            requestStatus,
            backendStatus
        });

        select.addEventListener('change', () => {
            setSelectedModel(select.value, true);
            renderModels();
        });
        input.addEventListener('input', handleManualModelInput);
        thinkingSelect.addEventListener('change', () => setSelectedThinkingEffort(thinkingSelect.value, true));
        conversationExperienceSelect.addEventListener('change', () => setSelectedConversationExperience(conversationExperienceSelect.value, true));
        fastCheckbox.addEventListener('change', () => setFastModeEnabled(fastCheckbox.checked, true));
        forceChatCheckbox.addEventListener('change', () => setForceChatEnabled(forceChatCheckbox.checked, true));

        for (const definition of backendFieldDefinitions) {
            const controls = backendOverrideControls[definition.key];

            controls.select.addEventListener('change', () => {
                try {
                    setBackendOverride(
                        definition.key,
                        controls.select.value,
                        controls.input.value,
                        true
                    );
                } catch (error) {
                    controls.select.value = getBackendOverrideSetting(definition.key).mode;
                    setStatus(state.requestStatus, error.message, 'error');
                }
            });
            controls.input.addEventListener('change', () => {
                if (controls.select.value !== 'custom') {
                    return;
                }

                try {
                    setBackendOverride(definition.key, 'custom', controls.input.value, true);
                } catch (error) {
                    controls.input.classList.add('has-invalid-value');
                    controls.input.title = error.message;
                    setStatus(state.requestStatus, error.message, 'error');
                }
            });
        }

        collapseButton.addEventListener('click', () => setPanelCollapsed(!state.collapsed, true));
        header.addEventListener('pointerdown', handleHeaderPointerDown);
        header.addEventListener('pointermove', handleHeaderPointerMove);
        header.addEventListener('pointerup', handleHeaderPointerUp);
        header.addEventListener('pointercancel', handleHeaderPointerUp);
        window.addEventListener('resize', handleWindowResize);

        state.selectedThinkingEffort = localStorage.getItem(config.thinkingEffortStorageKey) || 'auto';
        state.fastModeEnabled = localStorage.getItem(config.fastModeStorageKey) === 'true';
        state.selectedConversationExperience = localStorage.getItem(config.conversationExperienceStorageKey) || 'chat';
        state.forceChatEnabled = localStorage.getItem(config.forceChatStorageKey) !== 'false';
        state.backendOverrides = loadBackendOverrides();

        for (const definition of backendFieldDefinitions) {
            renderBackendOverrideControl(definition.key);
        }

        setSelectedThinkingEffort(state.selectedThinkingEffort, false);
        setSelectedConversationExperience(state.selectedConversationExperience, false);
        setFastModeEnabled(state.fastModeEnabled, false);
        setForceChatEnabled(state.forceChatEnabled, false);

        restorePanelSize();
        setPanelCollapsed(localStorage.getItem(config.collapsedStorageKey) === 'true', false);
        restorePanelPosition();

        if (typeof ResizeObserver === 'function') {
            state.resizeObserver = new ResizeObserver(handlePanelResize);
            state.resizeObserver.observe(panel);
        }
    }

    /**
     * Добавляет компактный оконный стиль панели с изменяемым размером.
     *
     * Палитра и структура шапки повторяют подход DropMe: отдельная title bar,
     * иконка приложения, название, вторичная строка версии и плоская кнопка справа.
     */
    function addStyles() {
        const style = document.createElement('style');

        style.id = 'gpt-model-picker-styles';
        style.textContent = `
            #gpt-model-picker-panel {
                position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
                display: flex; width: min(380px, calc(100vw - 16px)); height: min(720px, calc(100vh - 16px));
                min-width: 260px; min-height: 220px; max-width: calc(100vw - 8px); max-height: calc(100vh - 8px);
                box-sizing: border-box; flex-direction: column; overflow: hidden; resize: both;
                color: #f2f5f8; background: #111418; border: 1px solid #34404b; border-radius: 10px;
                box-shadow: 0 10px 32px rgb(0 0 0 / 38%); font: 11px/1.3 Arial, sans-serif;
            }
            #gpt-model-picker-panel.is-collapsed {
                height: 44px !important; min-height: 0; max-height: 44px; resize: none;
            }
            #gpt-model-picker-panel.is-collapsed .gpt-model-picker-content { display: none; }
            .gpt-model-picker-header {
                display: flex; min-height: 44px; flex: 0 0 44px; align-items: center; justify-content: space-between;
                gap: 8px; box-sizing: border-box; padding: 6px 7px 6px 8px; touch-action: none; user-select: none;
                background: #252d36; border-bottom: 1px solid #34404b; cursor: grab;
            }
            #gpt-model-picker-panel.is-collapsed .gpt-model-picker-header { border-bottom: 0; }
            .gpt-model-picker-header.is-dragging { cursor: grabbing; }
            .gpt-model-picker-identity {
                display: flex; min-width: 0; flex: 1 1 auto; align-items: center; gap: 8px; pointer-events: none;
            }
            .gpt-model-picker-app-icon { width: 30px; height: 30px; flex: 0 0 30px; }
            .gpt-model-picker-app-icon svg { display: block; width: 100%; height: 100%; }
            .gpt-model-picker-title-copy { min-width: 0; }
            .gpt-model-picker-title {
                overflow: hidden; color: #f2f5f8; font-size: 12px; font-weight: 700; line-height: 1.15;
                text-overflow: ellipsis; white-space: nowrap;
            }
            .gpt-model-picker-version {
                margin-top: 2px; overflow: hidden; color: #aeb2b6; font-size: 9px; line-height: 1.1;
                text-overflow: ellipsis; white-space: nowrap;
            }
            .gpt-model-picker-collapse {
                display: grid; width: 26px; height: 26px; flex: 0 0 26px; place-items: center; padding: 0;
                color: #dce2e8; background: transparent; border: 1px solid transparent; border-radius: 6px;
                font: 700 16px/1 Arial, sans-serif; cursor: pointer;
            }
            .gpt-model-picker-collapse:hover { background: #283f4d; border-color: #34404b; }
            .gpt-model-picker-content {
                display: flex; min-height: 0; flex: 1 1 auto; flex-direction: column; gap: 5px;
                box-sizing: border-box; padding: 7px; overflow: auto;
            }
            .gpt-model-picker-field { display: grid; flex: 0 0 auto; gap: 2px; min-width: 0; }
            .gpt-model-picker-field-label { color: #aeb2b6; font-size: 9px; }
            .gpt-model-picker-select, .gpt-model-picker-input {
                width: 100%; min-height: 28px; box-sizing: border-box; padding: 4px 6px;
                color: #f2f5f8; background: #222732; border: 1px solid #34404b;
                border-radius: 6px; font: 10.5px/1.2 Arial, sans-serif;
            }
            .gpt-model-picker-input.has-invalid-value { border-color: #e16b6b; }
            .gpt-model-picker-select option.is-unsupported { color: #e3a12f; }
            .gpt-model-picker-select option.is-historical-model { color: #c084fc; }
            .gpt-model-picker-select option.is-experimental-model { color: #22d3ee; }
            .gpt-model-picker-select.has-unsupported-value {
                color: #e3a12f; border-color: #e3a12f;
            }
            .gpt-model-picker-select.has-historical-model {
                color: #c084fc; border-color: #c084fc;
            }
            .gpt-model-picker-select.has-experimental-model {
                color: #22d3ee; border-color: #22d3ee;
            }
            .gpt-model-picker-backend-overrides {
                display: grid; flex: 0 0 auto; gap: 4px; padding: 6px;
                background: #171c22; border: 1px solid #2a323b; border-radius: 6px;
            }
            .gpt-model-picker-backend-title { color: #dce2e8; font-size: 9.5px; font-weight: 700; }
            .gpt-model-picker-backend-field { display: grid; gap: 2px; min-width: 0; }
            .gpt-model-picker-backend-row {
                display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 4px;
            }
            .gpt-model-picker-backend-select, .gpt-model-picker-backend-input { min-height: 25px; font-size: 9.5px; }
            .gpt-model-picker-backend-input[readonly] { opacity: 0.78; cursor: default; }
            .gpt-model-picker-surface-badge {
                display: inline-grid; margin-left: 6px; padding: 1px 5px; place-items: center;
                border-radius: 999px; background: #283f4d; color: #d7f3ff;
                font: 700 9px/1.4 Arial, sans-serif; white-space: nowrap; vertical-align: middle;
            }
            html[data-gpt-model-picker-surface='work'] [data-gpt-model-picker-surface='work'] {
                --gpt-model-picker-surface-accent: #69afed;
            }
            html[data-gpt-model-picker-surface='work'] [data-composer-surface='true'],
            html[data-gpt-model-picker-surface='work'] form[data-type='unified-composer'],
            html[data-gpt-model-picker-surface='work'] #thread-bottom-container {
                outline: 1px solid rgb(105 175 237 / 38%); outline-offset: 2px;
            }
            html[data-gpt-model-picker-surface='work'] #prompt-textarea {
                caret-color: #69afed;
            }
            html[data-gpt-model-picker-surface='work'] button[data-gpt-model-picker-surface='work'] {
                border-color: rgb(105 175 237 / 65%) !important;
                box-shadow: 0 0 0 1px rgb(105 175 237 / 22%) inset;
            }
            html[data-gpt-model-picker-surface='chat'] .gpt-model-picker-surface-badge {
                background: #2d3440; color: #f2f5f8;
            }
            .gpt-model-picker-toggles {
                display: grid; flex: 0 0 auto; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px;
            }
            .gpt-model-picker-toggle {
                display: flex; min-width: 0; min-height: 27px; align-items: center; gap: 6px; box-sizing: border-box;
                padding: 3px 5px; color: #f2f5f8; background: #1d232a; border: 1px solid #2a323b;
                border-radius: 6px; cursor: pointer; user-select: none;
            }
            .gpt-model-picker-toggle span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .gpt-model-picker-checkbox { width: 14px; height: 14px; flex: 0 0 14px; margin: 0; accent-color: #69afed; }
            .gpt-model-picker-diagnostics {
                display: grid; min-height: 150px; max-height: 260px; flex: 0 0 auto; align-content: start; gap: 3px;
                box-sizing: border-box; padding: 6px; overflow: auto; background: #0b0e11;
                border: 1px solid #2a323b; border-radius: 6px; font-size: 9.5px; line-height: 1.25;
            }
            .gpt-model-picker-status {
                min-width: 0; color: #c7ccd1; overflow-wrap: anywhere; word-break: break-word; white-space: normal;
            }
            .gpt-model-picker-status[data-status-type='success'] { color: #45c97a; }
            .gpt-model-picker-status[data-status-type='warning'] { color: #e3a12f; }
            .gpt-model-picker-status[data-status-type='error'] { color: #e16b6b; }
            .gpt-model-picker-hint {
                flex: 0 0 auto; color: #8d949c; font-size: 9px; line-height: 1.2;
            }
        `;

        document.head.append(style);
    }
    /** Останавливает проверку, возвращает исходный fetch и удаляет панель. */
    function stop() {
        state.stopped = true;
        document.removeEventListener('DOMContentLoaded', mountPanel);
        window.removeEventListener('resize', handleWindowResize);

        if (state.hookTimer !== null) {
            window.clearInterval(state.hookTimer);
            state.hookTimer = null;
        }

        if (state.resizeObserver) {
            state.resizeObserver.disconnect();
            state.resizeObserver = null;
        }

        if (state.surfaceProjectionTimer !== null) {
            window.clearTimeout(state.surfaceProjectionTimer);
            state.surfaceProjectionTimer = null;
        }

        if (state.surfaceProjectionObserver) {
            state.surfaceProjectionObserver.disconnect();
            state.surfaceProjectionObserver = null;
        }

        clearSurfaceProjection();

        const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');

        if (descriptor?.get === getGuardedFetch && descriptor?.set === setGuardedFetch) {
            Object.defineProperty(window, 'fetch', {
                configurable: state.originalFetchDescriptor?.configurable ?? true,
                enumerable: state.originalFetchDescriptor?.enumerable ?? true,
                writable: state.originalFetchDescriptor?.writable ?? true,
                value: state.downstreamFetch
            });
        }

        state.fetchGuardInstalled = false;

        state.panel?.remove();
        document.querySelector('#gpt-model-picker-styles')?.remove();
    }

    /**
     * Создаёт панель после появления document.body и загружает каталоги моделей.
     *
     * Повторный вызов не создаёт вторую панель.
     */
    function mountPanel() {
        if (state.stopped || state.panel || !(document.body instanceof HTMLElement)) {
            return;
        }

        addStyles();
        createPanel();
        loadModels();
    }

    /**
     * Устанавливает page-world перехват fetch до запуска интерфейса ChatGPT.
     *
     * Панель монтируется сразу при готовом body либо по DOMContentLoaded. Такой порядок
     * сохраняет ранний перехват запросов и не требует фонового service worker.
     */
    function start() {
        state.stopped = false;
        installFetchGuard();
        state.hookTimer = window.setInterval(restoreHook, config.hookCheckIntervalMs);

        if (document.body instanceof HTMLElement) {
            mountPanel();
        } else {
            document.addEventListener('DOMContentLoaded', mountPanel, { once: true });
        }
    }

    window[GLOBAL_KEY] = {
        config,
        state,
        start,
        stop,
        mountPanel,
        loadModels,
        updateModelHistory,
        setSelectedModel,
        setSelectedThinkingEffort,
        setFastModeEnabled,
        setSelectedConversationExperience,
        setForceChatEnabled,
        setBackendOverride,
        getRenderedChatSurfaceMode,
        findChatSurfaceReactDispatcher,
        getChatSurfaceFiberAnchors,
        getReactRootFibers,
        updateRequestBody,
        restoreHook
    };

    start();
})();
