import { showToast, showMessageBox } from './ui.js';

export let appConfig = {
    geminiApiKey: '',
    alphaVantageApiKey: '',
    fmpApiKey: '',
    finnhubApiKey: '',
    cacheSize: 10, // Default cache size
    cacheExpire: 60 // Default expiration in minutes
};

const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
const alphaVantageApiKeyInput = document.getElementById('alpha-vantage-api-key-input');
const fmpApiKeyInput = document.getElementById('fmp-api-key-input');
const finnhubApiKeyInput = document.getElementById('finnhub-api-key-input');

export const initializeAppConfig = async () => {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const serverConfig = await response.json();
            appConfig.geminiApiKey = serverConfig.geminiApiKey || '';
            appConfig.alphaVantageApiKey = serverConfig.alphaVantageApiKey || '';
            appConfig.fmpApiKey = serverConfig.fmpApiKey || '';
            appConfig.finnhubApiKey = serverConfig.finnhubApiKey || '';
            appConfig.cacheSize = serverConfig.cacheSize || 10;
            appConfig.cacheExpire = serverConfig.cacheExpire || 60;

            if (appConfig.geminiApiKey)
                document.querySelector('[data-key="gemini"]').classList.add('hidden');
            if (appConfig.alphaVantageApiKey)
                document.querySelector('[data-key="alpha-vantage"]').classList.add('hidden');
            if (appConfig.fmpApiKey)
                document.querySelector('[data-key="fmp"]').classList.add('hidden');
            if (appConfig.finnhubApiKey)
                document.querySelector('[data-key="finnhub"]').classList.add('hidden');

        } else {
            console.warn('Failed to fetch config from server. Falling back to local storage and defaults.');
        }
    } catch (error) {
        console.error('Network error fetching server config, falling back to local storage and defaults:', error);
    } finally {
        appConfig.geminiApiKey = appConfig.geminiApiKey || localStorage.getItem('geminiApiKey') || '';
        appConfig.alphaVantageApiKey = appConfig.alphaVantageApiKey || localStorage.getItem('alphaVantageApiKey') || '';
        appConfig.fmpApiKey = appConfig.fmpApiKey || localStorage.getItem('fmpApiKey') || '';
    }
};

export const saveApiKeys = () => {
    const geminiKey = geminiApiKeyInput.value.trim();
    const alphaVantageKey = alphaVantageApiKeyInput.value.trim();
    const fmpKey = fmpApiKeyInput.value.trim();
    const finnhubKey = finnhubApiKeyInput.value.trim();

    if (!geminiApiKeyInput.closest('div').classList.contains('hidden'))
        localStorage.setItem('geminiApiKey', geminiKey);
    if (!alphaVantageApiKeyInput.closest('div').classList.contains('hidden'))
        localStorage.setItem('alphaVantageApiKey', alphaVantageKey);
    if (!fmpApiKeyInput.closest('div').classList.contains('hidden'))
        localStorage.setItem('fmpApiKey', fmpKey);
    if (!finnhubApiKeyInput.closest('div').classList.contains('hidden'))
        localStorage.setItem('finnhubApiKey', finnhubKey);

    appConfig.geminiApiKey = geminiKey;
    appConfig.alphaVantageApiKey = alphaVantageKey;
    appConfig.fmpApiKey = fmpKey;
    appConfig.finnhubApiKey = finnhubKey;

    showToast('API Keys saved successfully!');
};

export const getApiKeys = () => ({
    geminiApiKey: appConfig.geminiApiKey,
    alphaVantageApiKey: appConfig.alphaVantageApiKey,
    fmpApiKey: appConfig.fmpApiKey,
    finnhubApiKey: appConfig.finnhubApiKey
});


export const fetchFinnhubQuote = async (symbol) => {
    if (!appConfig.finnhubApiKey) {
        showMessageBox('Please provide API Key(s).');
        return null;
    }
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${appConfig.finnhubApiKey}`);
    if (!response.ok) {
        console.error('Failed to fetch quote from Finnhub');
        return null;
    }
    const data = await response.json();
    return {
        current: data.c,
        change: data.d,
        percent_change: data.dp,
        high: data.h,
        low: data.l,
        open: data.o,
        previous_close: data.pc
    };
};

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