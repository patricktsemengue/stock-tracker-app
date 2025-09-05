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
    const cachedMatches = recentlySearched.filter(s => s.symbol.toUpperCase().includes(upperCaseQuery) || (s.name && s.name.toUpperCase().includes(upperCaseQuery)));
    if (cachedMatches.length > 0) {
        resultsContainer.innerHTML = cachedMatches.map(match => {
            const price = match.quote ? match.quote.current : null;
            return `
            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.name}" data-quote='${JSON.stringify(match.quote)}'>
                <div class="flex flex-col flex-grow">
                    <div class="flex items-baseline gap-2">
                        <span class="font-bold text-gray-800">${match.symbol}</span>
                        <span class="text-gray-600 truncate">${match.name}</span>
                    </div>
                    <div class="flex items-baseline gap-2 text-xs text-gray-500">
                        ${price ? `<span>Price: ${price.toFixed(2)}</span>` : ''}
                    </div>
                </div>
                <span class="text-sm text-gray-400 ml-auto flex-shrink-0">(Recent)</span>
            </div>
            `
        }).join('');
        return;
    }
/*
    // 2. Search Local Transactions
    const transactions = getTransactions();
    const localMatches = transactions.filter(t => (t.symbol.toUpperCase().includes(upperCaseQuery) || (t.name && t.name.toUpperCase().includes(upperCaseQuery))) && t.name && t.name.trim() !== '');
    const uniqueLocalMatches = [...new Map(localMatches.map(item => [item.symbol, item])).values()];
    if (uniqueLocalMatches.length > 0) {
        resultsContainer.innerHTML = uniqueLocalMatches.map(match => `
             <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-symbol="${match.symbol}" data-name="${match.name}">
                <div class="flex flex-col flex-grow">
                     <div class="flex items-baseline gap-2">
                        <span class="font-bold text-gray-800">${match.symbol}</span>
                        <span class="text-gray-600 truncate">${match.name}</span>
                    </div>
                </div>
                <span class="text-sm text-gray-400 ml-auto flex-shrink-0">(Existing)</span>
            </div>
        `).join('');
        return;
    }
*/
    // 3. Fallback to customized API sequentially
    try {
        //const encodedQuery = encodeURIComponent(query + '%');
        const encodedQuery = encodeURIComponent(query);
        let apiResults = [];
        
        // 3a. By Symbol
        resultsContainer.innerHTML = `<p class="text-gray-500 italic">Searching by symbol...</p>`;
        let response = await fetch(`/api/search?query=${encodedQuery}&by=symbol`);
        if(response.ok) apiResults = await response.json();

        // 3b. By Name (if no symbol results)
        if (!apiResults || apiResults.length === 0) {
            resultsContainer.innerHTML = `<p class="text-gray-500 italic">No symbol match. Searching by name...</p>`;
            response = await fetch(`/api/search?query=${encodedQuery}&by=name`);
            if(response.ok) apiResults = await response.json();
        }

        // 3c. By ISIN (if no name results)
        if (!apiResults || apiResults.length === 0) {
            resultsContainer.innerHTML = `<p class="text-gray-500 italic">No name match. Searching by ISIN...</p>`;
            response = await fetch(`/api/search?query=${encodedQuery}&by=isin`);
            if(response.ok) apiResults = await response.json();
        }
        
        // Process and display results
        if (apiResults && apiResults.length > 0) {
            const uniqueResults = [...new Map(apiResults.map(item => [item.data.Symbol, item])).values()];

            resultsContainer.innerHTML = uniqueResults.map(match => {
                const stock = match.data;
                const getValue = (keys) => {
                    for (const key of keys) {
                        const actualKey = Object.keys(stock).find(k => k.toLowerCase() === key.toLowerCase());
                        if (stock[actualKey]) {
                            let value = stock[actualKey];
                            if (typeof value === 'string') {
                                value = value.replace('$', '').trim();
                            }
                            const parsedValue = parseFloat(value);
                            return !isNaN(parsedValue) ? parsedValue : null;
                        }
                    }
                    return null;
                };

                const quote = {
                    current: getValue(['last Price', 'Last Sale']),
                    open: getValue(['Open Price']),
                    high: getValue(['High Price']),
                    low: getValue(['low Price'])
                };
                
                const lastSale = quote.current;
                const currency = stock.Currency || '';

                // Attach the full quote object to the element's data-quote attribute
                return `
                <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" 
                     data-symbol="${stock.Symbol}" 
                     data-name="${stock.Name}" 
                     data-quote='${JSON.stringify(quote)}'>
                    <div class="flex flex-col flex-grow min-w-0">
                        <div class="flex items-baseline gap-2">
                            <span class="font-bold text-gray-800">${stock.Symbol}</span>
                            <span class="text-gray-600 truncate" title="${stock.Name}">${stock.Name}</span>
                        </div>
                        <div class="flex items-baseline gap-2 text-xs text-gray-500 mt-1">
                            ${lastSale ? `<span>${lastSale.toFixed(2)} ${currency}</span>` : 'Price N/A'}
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            resultsContainer.innerHTML = `<p class="text-gray-500 italic">No matches found for "${query}".</p>`;
        }
    } catch (error) {
        console.error('Error during API search:', error);
        resultsContainer.innerHTML = `<p class="text-logo-red italic">An error occurred during search.</p>`;
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

export const addSelectedSymbol = (symbol, name, quote, options = {}) => {
    const { showCard = true } = options;

    // Only cache the symbol if a valid quote object is provided
    if (quote) {
        saveRecentlySearched(symbol, name, quote);
    }
    
    renderSelectedSymbols();
    
    if (showCard) {
        showDiscoveryCard(symbol, name);
    }
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
            symbolCard.dataset.symbol = s.symbol;
            symbolCard.dataset.name = s.name;
            
            const price = s.quote ? s.quote.current : null;
            const priceHTML = price ? `<span class="text-sm text-gray-800 font-bold">$${price.toFixed(2)}</span>` : '';
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