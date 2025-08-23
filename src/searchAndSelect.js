import { apiKeys, getApiKeys } from './apiManager.js';
import { getTransactions } from './storage.js';

let selectedSymbols = [];
let searchTimeout = null;

const searchResultsContainer = document.getElementById('search-results-container');
const selectedSymbolsContainer = document.getElementById('selected-symbols-container');

const performSearch = async (query, resultsContainer) => {
    const transactions = getTransactions();
    resultsContainer.innerHTML = '';
    if (query.length < 1) {
        return;
    }

    const localMatches = transactions.filter(t => t.symbol.includes(query.toUpperCase()) && t.name && t.name.trim() !== '');
    const uniqueLocalMatches = [...new Map(localMatches.map(item => [item.symbol, item])).values()];

    if (uniqueLocalMatches.length > 0) {
        const resultsHtml = uniqueLocalMatches.map(match => `
            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.name}">
                <span class="font-bold text-gray-800">${match.symbol}</span>
                <span class="text-gray-600">- ${match.name}</span>
                <span class="text-sm text-gray-400 ml-auto">(Existing)</span>
            </div>
        `).join('');
        resultsContainer.innerHTML = `<p class="text-sm font-semibold text-gray-700 mb-2">Suggestions from your transactions:</p>${resultsHtml}`;
        return;
    }

    const keys = getApiKeys();
    const alphaVantageKey = keys.alphaVantageApiKey;
    const fmpKey = keys.fmpApiKey;

    if (fmpKey) {
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">Searching via Financial Modeling Prep...</p>`;
        try {
            const fmpApiUrl = `https://financialmodelingprep.com/api/v3/search?query=${query}&limit=10&apikey=${fmpKey}`;
            const response = await fetch(fmpApiUrl);
            const data = await response.json();

            if (data && data.length > 0) {
                const resultsHtml = data.map(match => `
                    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.name}">
                        <span class="font-bold text-gray-800">${match.symbol}</span>
                        <span class="text-gray-600">- ${match.name}</span>
                        <span class="text-sm text-gray-400 ml-auto">${match.exchangeShortName}</span>
                    </div>
                `).join('');
                resultsContainer.innerHTML = resultsHtml;
                return;
            }
        } catch (error) {
            console.error('Error during FMP symbol search:', error);
            resultsContainer.innerHTML = `<p class="text-logo-red text-sm">An error occurred while searching FMP. Trying Alpha Vantage...</p>`;
        }
    } else {
        resultsContainer.innerHTML = `<p class="text-logo-red text-sm">Please provide your FMP API Key in the Data Management section to use this feature.</p>`;
    }

    if (alphaVantageKey) {
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">Searching via Alpha Vantage...</p>`;
        try {
            const alphaVantageUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${alphaVantageKey}`;
            const response = await fetch(alphaVantageUrl);
            const data = await response.json();

            if (data.bestMatches && data.bestMatches.length > 0) {
                const resultsHtml = data.bestMatches.map(match => `
                    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match['1. symbol']}" data-name="${match['2. name']}">
                        <span class="font-bold text-gray-800">${match['1. symbol']}</span>
                        <span class="text-gray-600">- ${match['2. name']}</span>
                        <span class="text-sm text-gray-400 ml-auto">${match['4. region']}</span>
                    </div>
                `).join('');
                resultsContainer.innerHTML = resultsHtml;
            } else if (data.Note) {
                resultsContainer.innerHTML = `<p class="text-logo-red text-sm">${data.Note}</p>`;
            } else {
                resultsContainer.innerHTML = `<p class="text-gray-500 italic">No matches found for "${query}".</p>`;
            }
        } catch (error) {
            console.error('Error during Alpha Vantage symbol search:', error);
            resultsContainer.innerHTML = `<p class="text-logo-red text-sm">An error occurred while searching. Please try again.</p>`;
        }
    } else {
        resultsContainer.innerHTML = `<p class="text-logo-red text-sm">Please provide your Alpha Vantage API Key in the Data Management section.</p>`;
    }
};

export const searchSymbol = (query) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch(query, searchResultsContainer);
    }, 500);
};

export const lookupSymbol = (query) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch(query, document.getElementById('transaction-symbol-search-results'));
    }, 500);
};

export const addSelectedSymbol = (symbol, name) => {
    const existingIndex = selectedSymbols.findIndex(s => s.symbol === symbol);
    if (existingIndex === -1) {
        selectedSymbols.push({ symbol, name });
        renderSelectedSymbols();
    }
};

export const removeSelectedSymbol = (symbolToRemove) => {
    selectedSymbols = selectedSymbols.filter(s => s.symbol !== symbolToRemove);
    renderSelectedSymbols();
};

export const getSelectedSymbols = () => selectedSymbols;

export const renderSelectedSymbols = () => {
    selectedSymbolsContainer.innerHTML = '';
    const selectedSymbolsSection = document.getElementById('selected-symbols-section');

    if (selectedSymbols.length > 0) {
        selectedSymbols.forEach(s => {
            const symbolCard = document.createElement('div');
            symbolCard.className = 'relative bg-gray-100 text-gray-800 px-4 py-2 rounded-full flex items-center gap-2 shadow-sm cursor-pointer';
            symbolCard.innerHTML = `
                <span class="font-semibold" data-symbol="${s.symbol}" data-name="${s.name}">${s.symbol}</span>
                <span class="text-sm text-gray-600 truncate max-w-[100px]" data-symbol="${s.symbol}" data-name="${s.name}">${s.name}</span>
                <button class="remove-symbol-btn text-gray-400 hover:text-red-500 transition-colors" data-symbol="${s.symbol}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            `;
            selectedSymbolsContainer.appendChild(symbolCard);
        });
        selectedSymbolsSection.classList.remove('hidden');
    } else {
        selectedSymbolsSection.classList.add('hidden');
    }
};