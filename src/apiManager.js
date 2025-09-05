import { showToast, showMessageBox } from './ui.js';

export let appConfig = {
    geminiApiKey: '',
    cacheSize: 10,
    cacheExpire: 60
};

const geminiApiKeyInput = document.getElementById('gemini-api-key-input');

export const initializeAppConfig = async () => {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const serverConfig = await response.json();
            appConfig.geminiApiKey = serverConfig.geminiApiKey || '';
            appConfig.cacheSize = serverConfig.cacheSize || 10;
            appConfig.cacheExpire = serverConfig.cacheExpire || 60;

            if (appConfig.geminiApiKey)
                document.querySelector('[data-key="gemini"]').classList.add('hidden');

        } else {
            console.warn('Failed to fetch config from server. Falling back to local storage and defaults.');
        }
    } catch (error) {
        console.error('Network error fetching server config, falling back to local storage and defaults:', error);
    } finally {
        appConfig.geminiApiKey = appConfig.geminiApiKey || localStorage.getItem('geminiApiKey') || '';
    }
};

export const saveApiKeys = () => {
    const geminiKey = geminiApiKeyInput.value.trim();

    if (!geminiApiKeyInput.closest('div').classList.contains('hidden'))
        localStorage.setItem('geminiApiKey', geminiKey);

    appConfig.geminiApiKey = geminiKey;

    showToast('API Keys saved successfully!');
};

export const getApiKeys = () => ({
    geminiApiKey: appConfig.geminiApiKey
});

export const analyzeStrategyWithGemini = async (symbol) => {
    if (!appConfig.geminiApiKey) {
        showMessageBox('Please provide your Gemini API Key in the Data Management section to use this feature.');
        return;
    }

    const transactionsForSymbol = getTransactionsForSymbol(symbol);
    const transactionListPrompt = transactionsForSymbol.map(t => {
        const displayName = t.name && t.name.trim() !== '' ? t.name : t.symbol;
        if (t.assetType === 'Stock') {
            return `a ${t.action} of ${t.quantity} shares of ${displayName} at a price of ${t.transactionPrice} ${t.currency}`;
        } else {
            return `a ${t.action} of ${t.quantity} ${t.assetType.replace(' Option', '')} options on ${displayName} with a strike price of ${t.strikePrice} ${t.currency} and a premium of ${t.premium} ${t.currency}`;
        }
    }).join(', ');

    const prompt = `Based on the following list of transactions, identify the type of options trading strategy being employed and provide a short, simple explanation of its characteristics, including its risk profile and potential for profit and loss. Do not include financial advice, just a general explanation. Transactions: ${transactionListPrompt}.`;

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${appConfig.geminiApiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            return 'Unable to analyze the strategy. The response from the API was empty or invalid.';
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return 'An error occurred while analyzing the strategy. Please try again later.';
    }
};