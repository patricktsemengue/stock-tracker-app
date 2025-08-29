import { getApiKeys } from './apiManager.js';
import { getTransactions, getRecentlySearched, saveRecentlySearched } from './storage.js';
import { showDiscoveryCard } from './ui.js';

let searchTimeout = null;

const searchResultsContainer = document.getElementById('search-results-container');
const selectedSymbolsContainer = document.getElementById('selected-symbols-container');

const performSearch = async (query, resultsContainer) => {
    resultsContainer.innerHTML = '';
    if (query.length < 1) return;

    const upperCaseQuery = query.toUpperCase();

    // 1. Search in recently searched cache
    const recentlySearched = getRecentlySearched();
    const cachedMatches = recentlySearched.filter(s => s.symbol.toUpperCase().includes(upperCaseQuery));
    if (cachedMatches.length > 0) {
        resultsContainer.innerHTML = cachedMatches.map(match => `
            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.name}" data-price="${match.price}">
                <span class="font-bold text-gray-800">${match.symbol}</span>
                <span class="text-gray-600">- ${match.name}</span>
                <span class="text-sm text-gray-400 ml-auto">(Recent)</span>
            </div>
        `).join('');
        return;
    }

    // 2. Search Local Transactions
    const transactions = getTransactions();
    const localMatches = transactions.filter(t => t.symbol.toUpperCase().includes(upperCaseQuery) && t.name && t.name.trim() !== '');
    const uniqueLocalMatches = [...new Map(localMatches.map(item => [item.symbol, item])).values()];
    if (uniqueLocalMatches.length > 0) {
        resultsContainer.innerHTML = uniqueLocalMatches.map(match => `
            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.name}">
                <span class="font-bold text-gray-800">${match.symbol}</span>
                <span class="text-gray-600">- ${match.name}</span>
                <span class="text-sm text-gray-400 ml-auto">(Existing)</span>
            </div>
        `).join('');
        return;
    }

    const keys = getApiKeys();
    let resultsFound = false;

    // 3. Search Finnhub API
    if (keys.finnhubApiKey) {
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">Searching via Finnhub...</p>`;
        try {
            const response = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${keys.finnhubApiKey}`);
            const data = await response.json();
            if (data.result && data.result.length > 0) {
                resultsContainer.innerHTML = data.result.map(match => `
                    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.description}">
                        <span class="font-bold text-gray-800">${match.symbol}</span> <span class="text-gray-600">- ${match.description}</span>
                    </div>`).join('');
                resultsFound = true;
            }
        } catch (error) { console.error('Error during Finnhub symbol search:', error); }
    }
    
    if (resultsFound) return;

    // 4. Fallback to FMP
    if (keys.fmpApiKey) {
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">Finnhub failed. Trying FMP...</p>`;
        try {
            const response = await fetch(`https://financialmodelingprep.com/api/v3/search?query=${query}&limit=10&apikey=${keys.fmpApiKey}`);
            const data = await response.json();
            if (data && data.length > 0) {
                resultsContainer.innerHTML = data.map(match => `
                    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.name}">
                        <span class="font-bold text-gray-800">${match.symbol}</span> <span class="text-gray-600">- ${match.name}</span> <span class="text-sm text-gray-400 ml-auto">${match.exchangeShortName}</span>
                    </div>`).join('');
                resultsFound = true;
            }
        } catch (error) {
            console.error('Error during FMP symbol search:', error);
        }
    }

    if (resultsFound) return;

    // 5. Fallback to Alpha Vantage
    if (keys.alphaVantageApiKey) {
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">FMP failed. Trying Alpha Vantage...</p>`;
        try {
            const response = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${keys.alphaVantageApiKey}`);
            const data = await response.json();
            if (data.bestMatches && data.bestMatches.length > 0) {
                resultsContainer.innerHTML = data.bestMatches.map(match => `
                    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match['1. symbol']}" data-name="${match['2. name']}">
                        <span class="font-bold text-gray-800">${match['1. symbol']}</span> <span class="text-gray-600">- ${match['2. name']}</span> <span class="text-sm text-gray-400 ml-auto">${match['4. region']}</span>
                    </div>`).join('');
                resultsFound = true;
            } else if (data.Note) {
                 resultsContainer.innerHTML = `<p class="text-logo-red text-sm">${data.Note}</p>`; // API limit reached
                 return;
            }
        } catch (error) {
            console.error('Error during Alpha Vantage symbol search:', error);
        }
    }

    if (!resultsFound) {
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">No matches found for "${query}". Please check your API keys.</p>`;
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

export const addSelectedSymbol = (symbol, name, price) => {
    // Save to cache immediately on selection
    if (price) {
        saveRecentlySearched(symbol, name, price);
    }
    renderSelectedSymbols();
    showDiscoveryCard(symbol, name);
};

export const removeSelectedSymbol = (symbolToRemove) => {
    let recentlySearched = getRecentlySearched();
    recentlySearched = recentlySearched.filter(s => s.symbol !== symbolToRemove);
    localStorage.setItem('recentlySearched', JSON.stringify(recentlySearched));
    renderSelectedSymbols();
};

export const getSelectedSymbols = () => getRecentlySearched();

export const renderSelectedSymbols = () => {
    selectedSymbolsContainer.innerHTML = '';
    const selectedSymbolsSection = document.getElementById('selected-symbols-section');
    const recentlySearched = getRecentlySearched();

    if (recentlySearched.length > 0) {
        recentlySearched.forEach(s => {
            const symbolCard = document.createElement('div');
            symbolCard.className = 'relative bg-gray-100 text-gray-800 px-4 py-2 rounded-full flex items-center gap-2 shadow-sm cursor-pointer';
            // **FIX**: Added data attributes to the parent div for the click listener to find
            symbolCard.dataset.symbol = s.symbol;
            symbolCard.dataset.name = s.name;
            
            const priceHTML = s.price ? `<span class="text-sm text-gray-800 font-bold">$${s.price.toFixed(2)}</span>` : '';
            symbolCard.innerHTML = `
                <span class="font-semibold">${s.symbol}</span>
                <span class="text-sm text-gray-600 truncate max-w-[100px]">${s.name}</span>
                ${priceHTML}
                <button class="remove-symbol-btn text-gray-400 hover:text-red-500 transition-colors" data-symbol="${s.symbol}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            `;
            selectedSymbolsContainer.appendChild(symbolCard);
        });
        selectedSymbolsSection.classList.remove('hidden');
    } else {
        selectedSymbolsSection.classList.add('hidden');
    }
};