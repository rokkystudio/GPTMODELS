const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'src', 'main.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Возвращает полное объявление именованной функции из исходного файла.
 *
 * Парсер считает фигурные скобки функции и учитывает строковые литералы,
 * template literals и комментарии, чтобы тест выполнял именно проектный код.
 *
 * @param {string} functionName
 * @returns {string}
 */
function extractFunction(functionName) {
    const marker = `function ${functionName}(`;
    const start = source.indexOf(marker);

    assert(start >= 0, `function ${functionName} is missing`);

    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    let quote = '';
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (let index = bodyStart; index < source.length; index += 1) {
        const character = source[index];
        const next = source[index + 1];

        if (lineComment) {
            if (character === '\n') {
                lineComment = false;
            }
            continue;
        }

        if (blockComment) {
            if (character === '*' && next === '/') {
                blockComment = false;
                index += 1;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (character === '\\') {
                escaped = true;
            } else if (character === quote) {
                quote = '';
            }
            continue;
        }

        if (character === '/' && next === '/') {
            lineComment = true;
            index += 1;
            continue;
        }

        if (character === '/' && next === '*') {
            blockComment = true;
            index += 1;
            continue;
        }

        if (character === "'" || character === '"' || character === '`') {
            quote = character;
            continue;
        }

        if (character === '{') {
            depth += 1;
        } else if (character === '}') {
            depth -= 1;

            if (depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }

    throw new Error(`function ${functionName} has no closing brace`);
}

assert(source.includes("version: '1.0.0'"), 'extension version is missing');
assert(source.includes("{ value: 'ultra', label: 'Ultra — ultra' }"), 'ultra option is missing');
assert(source.includes('state.thinkingSelect.disabled = false'), 'thinking select is not explicitly enabled');
assert(source.includes("option.classList.toggle('is-unsupported', unsupported)"), 'unsupported thinking marker is missing');
assert(source.includes("modelHistoryStorageKey: 'gpt-model-picker.model-history.v1'"), 'model history key is missing');
assert(source.includes("option.classList.toggle('is-historical-model'"), 'historical model marker is missing');
assert(source.includes("option.classList.toggle('is-experimental-model'"), 'experimental model marker is missing');
assert(source.includes("document.addEventListener('DOMContentLoaded', mountPanel, { once: true });"), 'document_start mounting is missing');

const context = {
    config: {
        autoModelSlug: 'auto',
        conversationInitPath: '/backend-api/conversation/init',
        conversationPreparePath: '/backend-api/f/conversation/prepare',
        conversationPath: '/backend-api/f/conversation'
    },
    state: {
        selectedModelSlug: 'auto',
        selectedThinkingEffort: 'ultra',
        fastModeEnabled: true,
        forceChatEnabled: true
    }
};

vm.createContext(context);
vm.runInContext([
    extractFunction('assignRequestField'),
    extractFunction('deleteRequestField'),
    extractFunction('updateRequestBody'),
    'globalThis.updateRequestBodyForTest = updateRequestBody;'
].join('\n'), context);

const bypassPayload = JSON.stringify({
    model: 'native-model',
    requested_default_model: 'native-default',
    thinking_effort: 'standard',
    service_tier: 'default',
    conversation_origin: 'tpp',
    conversation_mode: { kind: 'work' },
    tpp_work_handoff_conversion: true,
    conversation_execution_target: 'work'
});
const bypassResult = context.updateRequestBodyForTest(
    bypassPayload,
    context.config.conversationPath
);

assert(bypassResult.bypass === true, 'auto model does not enable bypass');
assert(bypassResult.changed === false, 'bypass reports a payload change');
assert(bypassResult.body === bypassPayload, 'bypass does not preserve the original payload bytes');
assert(bypassResult.requestedModelSlug === 'native-model', 'bypass does not report the native model');
assert(bypassResult.requestedThinkingEffort === 'standard', 'bypass does not report the native thinking effort');
assert(bypassResult.requestedServiceTier === 'default', 'bypass does not report the native service tier');
assert(bypassResult.requestedConversationMode === 'work', 'bypass does not report the native mode');

context.state.selectedModelSlug = 'gpt-6-astra';
const manualPayload = JSON.stringify({
    model: 'native-model',
    requested_default_model: 'native-default',
    thinking_effort: 'standard',
    service_tier: 'default',
    conversation_origin: 'tpp',
    conversation_mode: { kind: 'work', extra: true },
    tpp_work_handoff_conversion: true,
    conversation_execution_target: 'work',
    messages: [
        {
            author: { role: 'user' },
            metadata: { conversation_execution_target: 'work' }
        }
    ]
});
const manualResult = context.updateRequestBodyForTest(
    manualPayload,
    context.config.conversationPath
);
const manualBody = JSON.parse(manualResult.body);

assert(manualResult.bypass === false, 'explicit model remains in bypass');
assert(manualResult.changed === true, 'explicit model does not change the payload');
assert(manualBody.model === 'gpt-6-astra', 'explicit model is not applied');
assert(manualBody.requested_default_model === 'gpt-6-astra', 'requested_default_model is not applied');
assert(manualBody.thinking_effort === 'ultra', 'ultra thinking effort is not applied');
assert(manualBody.service_tier === 'priority', 'priority service tier is not applied');
assert(manualBody.conversation_origin === null, 'Chat Mode origin is not applied');
assert(manualBody.conversation_mode.kind === 'primary_assistant', 'Chat Mode conversation mode is not applied');
assert(!('tpp_work_handoff_conversion' in manualBody), 'Work handoff remains in Chat Mode');
assert(!('conversation_execution_target' in manualBody), 'execution target remains in Chat Mode');
assert(!('conversation_execution_target' in manualBody.messages[0].metadata), 'message execution target remains in Chat Mode');

const historyStorage = new Map();
const historyContext = {
    config: {
        modelHistoryStorageKey: 'gpt-model-picker.model-history.v1'
    },
    state: {
        workModels: [
            {
                slug: 'history-model',
                title: 'History Model',
                thinking_efforts: [
                    { thinking_effort: 'standard', short_label: 'Standard' }
                ]
            }
        ],
        chatModels: [],
        modelHistory: [],
        historicalModels: []
    },
    localStorage: {
        getItem(key) {
            return historyStorage.has(key) ? historyStorage.get(key) : null;
        },
        setItem(key, value) {
            historyStorage.set(key, String(value));
        }
    },
    log() {}
};

vm.createContext(historyContext);
vm.runInContext([
    extractFunction('getModelThinkingEfforts'),
    extractFunction('createModelHistorySnapshot'),
    extractFunction('loadModelHistory'),
    extractFunction('updateModelHistory'),
    'globalThis.updateModelHistoryForTest = updateModelHistory;'
].join('\n'), historyContext);

historyContext.updateModelHistoryForTest();
assert(historyContext.state.modelHistory.length === 1, 'current model is not stored in history');
assert(historyContext.state.historicalModels.length === 0, 'current model is incorrectly marked historical');

historyContext.state.workModels = [];
historyContext.updateModelHistoryForTest();
assert(historyContext.state.historicalModels.length === 1, 'missing model is not preserved as historical');
assert(historyContext.state.historicalModels[0].slug === 'history-model', 'historical model slug is not preserved');
assert(
    historyContext.state.historicalModels[0].thinking_efforts[0].thinking_effort === 'standard',
    'historical thinking effort is not preserved'
);

const apiSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'api-models.js'), 'utf8');
const apiSandbox = { window: {} };
vm.runInNewContext(apiSource, apiSandbox);

assert(Array.isArray(apiSandbox.window.__gptModelPickerApiModels), 'API model list is missing');
assert(apiSandbox.window.__gptModelPickerApiModels.some((model) => model.slug === 'gpt-6-astra'), 'GPT-6 Astra API slug is missing');

console.log(JSON.stringify({
    ok: true,
    checks: 32,
    apiModels: apiSandbox.window.__gptModelPickerApiModels.length,
    cases: ['bypass', 'manual-ultra-chat-priority', 'history-markers', 'api-models']
}));
