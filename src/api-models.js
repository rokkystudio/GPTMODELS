// Experimental OpenAI API model slugs for GPT Models extension v1.0.0
(() => {
    'use strict';

    /**
     * Модели общего назначения и кодовые модели из публичного каталога OpenAI API.
     *
     * Эти slug не считаются подтверждёнными для backend ChatGPT. Page script отображает
     * их отдельным цветом и передаёт только при явном выборе пользователя.
     */
    window.__gptModelPickerApiModels = [
        { slug: 'gpt-6-astra', title: 'GPT-6 Astra' },
        { slug: 'gpt-6-sol', title: 'GPT-6 Sol' },
        { slug: 'gpt-6-luna', title: 'GPT-6 Luna' },
        { slug: 'gpt-5.6-sol', title: 'GPT-5.6 Sol' },
        { slug: 'gpt-5.6-terra', title: 'GPT-5.6 Terra' },
        { slug: 'gpt-5.6-luna', title: 'GPT-5.6 Luna' },
        { slug: 'gpt-5.5', title: 'GPT-5.5' },
        { slug: 'gpt-5.5-pro', title: 'GPT-5.5 Pro' },
        { slug: 'gpt-5.4', title: 'GPT-5.4' },
        { slug: 'gpt-5.4-pro', title: 'GPT-5.4 Pro' },
        { slug: 'gpt-5.4-mini', title: 'GPT-5.4 Mini' },
        { slug: 'gpt-5.4-nano', title: 'GPT-5.4 Nano' },
        { slug: 'gpt-5.3-codex', title: 'GPT-5.3 Codex' },
        { slug: 'gpt-5.2', title: 'GPT-5.2' },
        { slug: 'gpt-5.2-pro', title: 'GPT-5.2 Pro' },
        { slug: 'gpt-5.1', title: 'GPT-5.1' },
        { slug: 'gpt-5', title: 'GPT-5' },
        { slug: 'gpt-5-mini', title: 'GPT-5 Mini' },
        { slug: 'gpt-5-nano', title: 'GPT-5 Nano' },
        { slug: 'gpt-5-pro', title: 'GPT-5 Pro' },
        { slug: 'o3-pro', title: 'o3 Pro' },
        { slug: 'o3', title: 'o3' },
        { slug: 'gpt-4.1', title: 'GPT-4.1' },
        { slug: 'gpt-4.1-mini', title: 'GPT-4.1 Mini' },
        { slug: 'gpt-4o-mini', title: 'GPT-4o Mini' },
        { slug: 'gpt-4o', title: 'GPT-4o' }
    ];
})();
