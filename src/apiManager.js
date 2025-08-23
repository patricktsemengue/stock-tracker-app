import { showToast, showMessageBox } from './ui.js';

export let apiKeys = {
    geminiApiKey: '',
    alphaVantageApiKey: '',
    fmpApiKey: ''
};

const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
const alphaVantageApiKeyInput = document.getElementById('alpha-vantage-api-key-input');
const fmpApiKeyInput = document.getElementById('fmp-api-key-input');

export const initializeApiKeys = async () => {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const serverKeys = await response.json();
            apiKeys.geminiApiKey = serverKeys.geminiApiKey || '';
            apiKeys.alphaVantageApiKey = serverKeys.alphaVantageApiKey || '';
            apiKeys.fmpApiKey = serverKeys.fmpApiKey || '';

            if (apiKeys.geminiApiKey) {
                document.querySelector('[data-key="gemini"]').classList.add('hidden');
            }
            if (apiKeys.alphaVantageApiKey) {
                document.querySelector('[data-key="alpha-vantage"]').classList.add('hidden');
            }
            if (apiKeys.fmpApiKey) {
                document.querySelector('[data-key="fmp"]').classList.add('hidden');
            }

            if (serverKeys.geminiApiKey || serverKeys.alphaVantageApiKey || serverKeys.fmpApiKey) {
                showToast('(°_°)');
            } else {
                showToast('Failed to get keys from server, please enter them manually.');
            }
        } else {
            console.warn('Failed to fetch keys from server. Falling back to local storage.');
        }
    } catch (error) {
        console.error('Network error fetching server keys, falling back to local storage:', error);
    } finally {
        apiKeys.geminiApiKey = apiKeys.geminiApiKey || localStorage.getItem('geminiApiKey') || '';
        apiKeys.alphaVantageApiKey = apiKeys.alphaVantageApiKey || localStorage.getItem('alphaVantageApiKey') || '';
        apiKeys.fmpApiKey = apiKeys.fmpApiKey || localStorage.getItem('fmpApiKey') || '';
    }
};

export const saveApiKeys = () => {
    const geminiKey = geminiApiKeyInput.value.trim();
    const alphaVantageKey = alphaVantageApiKeyInput.value.trim();
    const fmpKey = fmpApiKeyInput.value.trim(); 

    if (!geminiApiKeyInput.closest('div').classList.contains('hidden')) {
        localStorage.setItem('geminiApiKey', geminiKey);
    }
    if (!alphaVantageApiKeyInput.closest('div').classList.contains('hidden')) {
        localStorage.setItem('alphaVantageApiKey', alphaVantageKey);
    }
    if (!fmpApiKeyInput.closest('div').classList.contains('hidden')) {
        localStorage.setItem('fmpApiKey', fmpKey); 
    }

    apiKeys.geminiApiKey = geminiKey;
    apiKeys.alphaVantageApiKey = alphaVantageKey;
    apiKeys.fmpApiKey = fmpKey; 

    showToast('API Keys saved successfully!');
};

export const getApiKeys = () => apiKeys;

export const analyzeStrategyWithGemini = async (symbol) => {
    if (!apiKeys.geminiApiKey) {
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
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKeys.geminiApiKey}`;
        
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