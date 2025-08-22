document.addEventListener('DOMContentLoaded', () => {

    // --- Custom helper functions for UI ---
    const showMessageBox = (message) => {
        const messageBox = document.getElementById('message-box');
        document.getElementById('message-text').textContent = message;
        messageBox.classList.remove('hidden');
        messageBox.classList.add('flex');
    };

    document.getElementById('message-ok-btn').addEventListener('click', () => {
        const messageBox = document.getElementById('message-box');
        messageBox.classList.add('hidden');
        messageBox.classList.remove('flex');
    });

    document.getElementById('clear-all-data-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all transactions and API keys? This action cannot be undone.')) {
            localStorage.clear();
            transactions = []; // Clear the in-memory array as well
            renderTransactionList();
            showToast('All data cleared successfully!');
            // You may also want to close the modal here
            document.getElementById('data-management-modal').classList.add('hidden');
            document.getElementById('data-management-modal').classList.remove('flex');
        }
    });

    const showToast = (message) => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, 3000);
    };

    // --- Core Application Logic ---
    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    let editingTransactionId = null;
    let selectedSymbols = [];

    // Modals and FABs
    const addTransactionFab = document.getElementById('add-transaction-fab');
    const addTransactionModal = document.getElementById('add-transaction-modal');
    const closeTransactionModalBtn = document.getElementById('close-transaction-modal');
    const transactionModalTitle = document.getElementById('transaction-modal-title');

    const dataManagementFab = document.getElementById('data-management-fab');
    const dataManagementModal = document.getElementById('data-management-modal');
    const closeDataManagementModalBtn = document.getElementById('close-data-management-modal');

    // API Key Management elements
    const toggleApiKeyFormBtn = document.getElementById('toggle-api-key-form');
    const apiKeyFormContainer = document.getElementById('api-key-form-container');
    const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
    const alphaVantageApiKeyInput = document.getElementById('alpha-vantage-api-key-input');
    const fmpApiKeyInput = document.getElementById('fmp-api-key-input');

    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    
    // API keys will be managed here, fetched from server or local storage
    let apiKeys = {
        geminiApiKey: '',
        alphaVantageApiKey: '',
        fmpApiKey: ''
    };

    // This is an async function to fetch keys from the server
    const hideApiKeyInput = (inputElement) => {
        if (inputElement) {
            inputElement.closest('div').classList.add('hidden');
        }
    };
    const initializeApiKeys = async () => {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const serverKeys = await response.json();
                
                apiKeys.geminiApiKey = serverKeys.geminiApiKey || '';
                apiKeys.alphaVantageApiKey = serverKeys.alphaVantageApiKey || '';
                apiKeys.fmpApiKey = serverKeys.fmpApiKey || '';

                // Check for keys and hide inputs if they are present on the server
                if (apiKeys.geminiApiKey) {
                    document.querySelector('[data-key="gemini"]').classList.add('hidden');
                } else {
                    document.querySelector('[data-key="gemini"]').classList.remove('hidden');
                }

                if (apiKeys.alphaVantageApiKey) {
                    document.querySelector('[data-key="alpha-vantage"]').classList.add('hidden');
                } else {
                    document.querySelector('[data-key="alpha-vantage"]').classList.remove('hidden');
                }

                if (apiKeys.fmpApiKey) {
                    document.querySelector('[data-key="fmp"]').classList.add('hidden');
                } else {
                    document.querySelector('[data-key="fmp"]').classList.remove('hidden');
                }

                if (serverKeys.geminiApiKey || serverKeys.alphaVantageApiKey || serverKeys.fmpApiKey) {
                    showToast('(°_°)');
                } else {
                    showToast('Failed to get keys from server, please enter them manually.');
                }

            } else {
                // If fetching from server fails, show all inputs
                console.warn('Failed to fetch keys from server. Falling back to local storage and showing all inputs.');
                document.querySelector('[data-key="gemini"]').classList.remove('hidden');
                document.querySelector('[data-key="alpha-vantage"]').classList.remove('hidden');
                document.querySelector('[data-key="fmp"]').classList.remove('hidden');
            }
        } catch (error) {
            // Network error, show all inputs
            console.error('Network error fetching server keys, falling back to local storage and showing all inputs:', error);
            document.querySelector('[data-key="gemini"]').classList.remove('hidden');
            document.querySelector('[data-key="alpha-vantage"]').classList.remove('hidden');
            document.querySelector('[data-key="fmp"]').classList.remove('hidden');
        } finally {
            // After trying to fetch from server, check local storage
            apiKeys.geminiApiKey = apiKeys.geminiApiKey || localStorage.getItem('geminiApiKey') || '';
            apiKeys.alphaVantageApiKey = apiKeys.alphaVantageApiKey || localStorage.getItem('alphaVantageApiKey') || '';
            apiKeys.fmpApiKey = apiKeys.fmpApiKey || localStorage.getItem('fmpApiKey') || '';
        }
    };

    const transactionForm = document.getElementById('transaction-form');
    const assetTypeSelect = document.getElementById('asset-type');
    const currencySelect = document.getElementById('currency');
    const transactionListDiv = document.getElementById('transaction-list');
    const stockFields = document.getElementById('stock-fields');
    const optionFields = document.getElementById('option-fields');
    const stockFeesInput = document.getElementById('stock-fees');
    const optionFeesInput = document.getElementById('option-fees');

    const pnlSimulationModal = document.getElementById('pnl-simulation-modal');
    const closePnlModalBtn = document.getElementById('close-pnl-modal');
    const pnlChartsContainer = document.getElementById('pnl-charts-container');

    const strategySimulationModal = document.getElementById('strategy-simulation-modal');
    const closeStrategyModalBtn = document.getElementById('close-strategy-modal');
    const strategySymbolSelect = document.getElementById('strategy-symbol');
    const strategyPriceInput = document.getElementById('strategy-price');
    const strategyBtnContainer = document.getElementById('strategy-btn-container');

    const transactionDateInput = document.getElementById('transaction-date');
    const nameInput = document.getElementById('name');
    const strategyMaxProfitSpan = document.getElementById('strategy-max-profit');
    const strategyMaxLossSpan = document.getElementById('strategy-max-loss');
    const strategyBreakevenRangeSpan = document.getElementById('strategy-breakeven-range');

    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    let transactionToDeleteId = null;

    // Symbol Search elements (main page)
    const symbolSearchInput = document.getElementById('symbol-search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const selectedSymbolsContainer = document.getElementById('selected-symbols-container');
    let searchTimeout = null;

    // Symbol Search elements (add/edit modal)
    const transactionSymbolInput = document.getElementById('symbol');
    const transactionNameInput = document.getElementById('name');
    const transactionSymbolSearchResults = document.getElementById('transaction-symbol-search-results');


    const today = new Date().toISOString().split('T')[0];
    transactionDateInput.value = today;

    // Function to get the 3rd Friday of the next month
    const getThirdFridayOfNextMonth = () => {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth() + 1; // Next month (0-indexed, so +1 for actual month number)

        if (month > 11) { // If current month is December, next month is January of next year
            month = 0; // January
            year++;
        }

        let firstDayOfNextMonth = new Date(year, month, 1);
        let fridayCount = 0;
        let day = 1;
        let thirdFriday = null;

        // Loop through days of the month to find the 3rd Friday
        while (fridayCount < 3) {
            const currentDate = new Date(year, month, day);
            if (currentDate.getDay() === 5) { // Friday is day 5 (0 for Sunday, 1 for Monday, etc.)
                fridayCount++;
                if (fridayCount === 3) {
                    thirdFriday = currentDate;
                }
            }
            day++;
        }

        return thirdFriday.toISOString().split('T')[0];
    };

    // Set default expiry date for options
    const optionExpiryInput = document.getElementById('option-expiry');
    optionExpiryInput.value = getThirdFridayOfNextMonth();

    const setDefaultFees = () => {
        const assetType = assetTypeSelect.value;
        const currency = currencySelect.value;
        let fee = 0;

        if (assetType === 'Stock') {
            fee = currency === 'EUR' ? 0.02 : 0.00;
        } else {
            if (currency === 'EUR') {
                fee = 0.75;
            } else if (currency === 'CHF') {
                fee = 3.02;
            } else if (currency === 'USD') {
                fee = 2.02; // Corrected USD option fee
            }
        }

        if (assetType === 'Stock') {
            stockFeesInput.value = fee.toFixed(2);
        } else {
            optionFeesInput.value = fee.toFixed(2);
        }
    };

    const toggleFields = () => {
        if (assetTypeSelect.value === 'Stock') {
            stockFields.classList.remove('hidden');
            optionFields.classList.add('hidden');
        } else {
            stockFields.classList.add('hidden');
            optionFields.classList.remove('hidden');
            // Set underlying asset price to strike price by default for options
            document.getElementById('option-underlying').value = document.getElementById('option-strike').value;
            // Set default expiry date for options
            optionExpiryInput.value = getThirdFridayOfNextMonth();
        }
        setDefaultFees();
    };

    assetTypeSelect.addEventListener('change', toggleFields);
    currencySelect.addEventListener('change', setDefaultFees);
    
    // Event listener for closing Add Transaction Modal
    closeTransactionModalBtn.addEventListener('click', () => {
        addTransactionModal.classList.add('hidden');
        addTransactionModal.classList.remove('flex');
        transactionSymbolSearchResults.innerHTML = '';
    });

    // Event listener for Data Management FAB
    dataManagementFab.addEventListener('click', () => {
        dataManagementModal.classList.remove('hidden');
        dataManagementModal.classList.add('flex');
        geminiApiKeyInput.value = apiKeys.geminiApiKey;
        alphaVantageApiKeyInput.value = apiKeys.alphaVantageApiKey;
        fmpApiKeyInput.value = apiKeys.fmpApiKey;
    });

    // Event listener for closing Data Management Modal
    closeDataManagementModalBtn.addEventListener('click', () => {
        dataManagementModal.classList.add('hidden');
        dataManagementModal.classList.remove('flex');
        apiKeyFormContainer.classList.add('hidden');
        toggleApiKeyFormBtn.querySelector('svg').style.transform = 'rotate(0deg)';
    });

    // Toggle API Key Form visibility
    toggleApiKeyFormBtn.addEventListener('click', () => {
        apiKeyFormContainer.classList.toggle('hidden');
        const icon = toggleApiKeyFormBtn.querySelector('svg');
        if (apiKeyFormContainer.classList.contains('hidden')) {
            icon.style.transform = 'rotate(0deg)';
        } else {
            icon.style.transform = 'rotate(-90deg)';
        }
    });

    // Save API Keys to local storage
    saveApiKeyBtn.addEventListener('click', () => {
        // Get the values from the input fields
        const geminiKey = geminiApiKeyInput.value.trim();
        const alphaVantageKey = alphaVantageApiKeyInput.value.trim();
        const fmpKey = fmpApiKeyInput.value.trim(); 

        // Save each key to local storage only if it's not hidden
        if (!geminiApiKeyInput.closest('div').classList.contains('hidden')) {
            localStorage.setItem('geminiApiKey', geminiKey);
        }
        if (!alphaVantageApiKeyInput.closest('div').classList.contains('hidden')) {
            localStorage.setItem('alphaVantageApiKey', alphaVantageKey);
        }
        if (!fmpApiKeyInput.closest('div').classList.contains('hidden')) {
            localStorage.setItem('fmpApiKey', fmpKey); 
        }

        // Update the in-memory keys for immediate use
        apiKeys.geminiApiKey = geminiKey;
        apiKeys.alphaVantageApiKey = alphaVantageKey;
        apiKeys.fmpApiKey = fmpKey; 

        // Show a confirmation toast and close the modal section
        showToast('API Keys saved successfully!');
        apiKeyFormContainer.classList.add('hidden');
        toggleApiKeyFormBtn.querySelector('svg').style.transform = 'rotate(0deg)';
    });


    // Centralized search function to avoid code duplication
    const performSearch = async (query, resultsContainer) => {
        resultsContainer.innerHTML = '';
        if (query.length < 1) {
            return;
        }

        // --- Step 1: Search within existing transactions first ---
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

        //--- Step 2: Search with Alpha Vantage API as a fallback ---
        if (apiKeys.alphaVantageApiKey) {
            resultsContainer.innerHTML = `<p class="text-gray-500 italic">Searching via Alpha Vantage...</p>`;
            try {
                const alphaVantageUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${apiKeys.alphaVantageApiKey}`;
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

        // --- Step 3: Search with FMP API ---
        if (apiKeys.fmpApiKey) {
            resultsContainer.innerHTML = `<p class="text-gray-500 italic">Searching via Financial Modeling Prep...</p>`;
            try {
                const fmpApiUrl = `https://financialmodelingprep.com/api/v3/search?query=${query}&limit=10&apikey=${apiKeys.fmpApiKey}`;
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
                    return; // Return after finding results from FMP
                }
            } catch (error) {
                console.error('Error during FMP symbol search:', error);
                resultsContainer.innerHTML = `<p class="text-logo-red text-sm">An error occurred while searching FMP. Trying Alpha Vantage...</p>`;
            }
        } else {
            resultsContainer.innerHTML = `<p class="text-logo-red text-sm">Please provide your FMP API Key in the Data Management section to use this feature.</p>`;
        }
        
    };

    // searchSymbol function for the main search bar
    const searchSymbol = async (query) => {
        performSearch(query, searchResultsContainer);
    };

    //  lookupSymbol function for the transaction modal
    const lookupSymbol = async (query) => {
        performSearch(query, transactionSymbolSearchResults);
    };

    const calculateStockPNL = (price, transaction) => {
        const { action, quantity, transactionPrice, fees } = transaction;
        const direction = action === 'Buy' ? 1 : -1;
        return ((price - transactionPrice) * quantity * direction) - (fees * quantity);
    };

    const calculateOptionPNL = (underlyingPrice, transaction) => {
        const { action, quantity, strikePrice, premium, fees, assetType } = transaction;
        const direction = action === 'Buy' ? 1 : -1;
        let intrinsicValue = 0;
        if (assetType === 'Call Option') {
            intrinsicValue = Math.max(0, underlyingPrice - strikePrice);
        } else if (assetType === 'Put Option') {
            intrinsicValue = Math.max(0, strikePrice - underlyingPrice);
        }
        return ((intrinsicValue - premium) * quantity * 100 * direction) - (fees * quantity);
    };

    const calculateTransactionMetrics = (transaction) => {
        if (transaction.assetType === 'Stock') {
            const { action, transactionPrice, fees, quantity } = transaction;
            const direction = action === 'Buy' ? 1 : -1;
            const totalCost = (transactionPrice * quantity) + (fees * quantity);
            let maxProfit = Infinity;
            if (action === 'Sell') {
                maxProfit = totalCost;
            }
            let maxLoss = -Infinity;
            if (action === 'Buy') {
                maxLoss = -totalCost;
            }
            let breakEven = transactionPrice + (direction * fees);
            return { maxProfit: maxProfit, maxLoss: maxLoss, breakEven: breakEven };
        } else {
            const { action, assetType, strikePrice, premium, fees, quantity } = transaction;
            const direction = action === 'Buy' ? 1 : -1;
            let maxProfit = 0;
            if (action === 'Buy') {
                if (assetType === 'Call Option') {
                    maxProfit = Infinity;
                } else { // Put Option
                    maxProfit = (strikePrice - premium) * quantity * 100 - (fees * quantity);
                }
            } else { // Sell
                maxProfit = (premium * quantity * 100) - (fees * quantity);
            }
            let maxLoss = 0;
            if (action === 'Buy') {
                maxLoss = -((premium * quantity * 100) + (fees * quantity));
            } else { // Sell
                if (assetType === 'Call Option') {
                    maxLoss = -Infinity;
                } else { // Put Option
                    maxLoss = -((strikePrice - premium) * quantity * 100 + (fees * quantity));
                }
            }
            let breakEven = 0;
            if (assetType === 'Call Option') {
                breakEven = strikePrice + premium;
            } else { // Put Option
                breakEven = strikePrice - premium;
            }
            return { maxProfit, maxLoss: maxLoss, breakEven };
        }
    };


    const renderTransactionList = () => {
        transactionListDiv.innerHTML = '';
        const transactionCounts = {};

        transactions.forEach(t => {
            transactionCounts[t.symbol] = (transactionCounts[t.symbol] || 0) + 1;
        });

        transactions.forEach(t => {
            const metrics = calculateTransactionMetrics(t);
            
            let assetTypeClass = '';
            if (t.assetType === 'Stock') {
                assetTypeClass = 'text-logo-blue bg-blue-100';
            } else if (t.assetType === 'Call Option') {
                assetTypeClass = 'text-logo-green bg-green-100';
            } else {
                assetTypeClass = 'text-logo-red bg-red-100';
            }

            // Determine the distinguishing price information
            let priceInfo = '';
            if (t.assetType === 'Stock') {
                priceInfo = `Price: ${t.transactionPrice} ${t.currency}`;
            } else {
                priceInfo = `Strike: ${t.strikePrice} ${t.currency} | Prem: ${t.premium} ${t.currency}`;
            }

            // Get the display name, prioritizing 'name' over 'symbol'
            const displayName = t.name && t.name.trim() !== '' ? t.name : t.symbol;
            
            const transactionItem = document.createElement('div');
            transactionItem.className = 'bg-neutral-card p-4 rounded-lg shadow-subtle space-y-4 cursor-pointer';
            transactionItem.innerHTML = `
                <div class="flex items-center justify-between" data-id="${t.id}" data-action="toggle-details">
                    <div class="flex flex-col">
                        <div class="flex items-center">
                            <span class="text-xl font-bold text-neutral-text">${displayName}</span>
                            <span class="ml-4 px-3 py-1 rounded-full text-xs font-semibold ${assetTypeClass}">${t.assetType} - ${t.action}</span>
                        </div>
                        <div class="text-sm text-gray-500 mt-1">
                             <span>Qty: ${t.quantity}</span> | <span>${priceInfo}</span> | <span>${t.transactionDate}</span> 
                        </div>
                    </div>
                    <div class="flex items-center text-gray-500">
                        <svg data-id="${t.id}" data-action="toggle-details" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform transition-transform" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </div>
                </div>
                <div id="details-${t.id}" class="collapsible-content">
                    <div class="grid grid-cols-2 gap-4 text-sm text-gray-600 border-t pt-4 mt-4">
                        <div><span class="font-bold text-neutral-text">Date:</span> ${t.transactionDate}</div>
                        <div><span class="font-bold text-neutral-text">Quantity:</span> ${t.quantity}</div>
                        ${t.assetType === 'Stock' ? `
                        <div><span class="font-bold text-neutral-text">Price:</span> ${t.transactionPrice} ${t.currency}</div>
                        <div><span class="font-bold text-neutral-text">Fees:</span> ${t.fees} ${t.currency}</div>
                        ` : `
                        <div><span class="font-bold text-neutral-text">Strike:</span> ${t.strikePrice} ${t.currency}</div>
                        <div><span class="font-bold text-neutral-text">Premium:</span> ${t.premium} ${t.currency}</div>
                        <div><span class="font-bold text-neutral-text">Expiry:</span> ${t.expiryDate}</div>
                        <div><span class="font-bold text-neutral-text">Fees:</span> ${t.fees} ${t.currency}</div>
                        `}
                    </div>

                    <div class="mt-4 pt-4 border-t border-gray-200">
                        <h4 class="text-lg font-bold text-gray-700 mb-2">Key Metrics</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center">
                                <span class="text-sm text-gray-500">Max Profit</span>
                                <span class="font-bold text-base ${metrics.maxProfit > 0 || metrics.maxProfit === Infinity ? 'text-logo-green' : 'text-neutral-text'}">${metrics.maxProfit === Infinity ? '∞' : metrics.maxProfit.toFixed(2) + ' ' + t.currency}</span>
                            </div>
                            <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center">
                                <span class="text-sm text-gray-500">Max Loss</span>
                                <span class="font-bold text-base ${metrics.maxLoss < 0 || metrics.maxLoss === -Infinity ? 'text-logo-red' : 'text-neutral-text'}">${metrics.maxLoss === -Infinity ? '-∞' : metrics.maxLoss.toFixed(2) + ' ' + t.currency}</span>
                            </div>
                            <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center">
                                <span class="text-sm text-gray-500">Breakeven</span>
                                <span class="font-bold text-base text-neutral-text">${metrics.breakEven.toFixed(2)} ${t.currency}</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 flex justify-end gap-2">
                        <button data-id="${t.id}" class="simulate-btn bg-logo-primary text-white px-4 py-2 rounded-full shadow hover:bg-opacity-80 transition-colors text-sm font-bold">
                            Simulate P&L
                        </button>
                        <button data-id="${t.id}" class="edit-btn bg-gray-200 text-gray-700 px-4 py-2 rounded-full shadow hover:bg-gray-300 transition-colors text-sm font-bold">
                            Edit
                        </button>
                        <button data-id="${t.id}" class="delete-btn bg-logo-red text-white px-4 py-2 rounded-full shadow hover:bg-opacity-80 transition-colors text-sm font-bold">
                            Delete
                        </button>
                    </div>
                </div>
            `;
            transactionListDiv.appendChild(transactionItem);
        });

        const symbolsWithMultiple = Object.keys(transactionCounts).filter(s => transactionCounts[s] >= 2);
        if (symbolsWithMultiple.length > 0) {
            strategyBtnContainer.classList.remove('hidden');
            strategySymbolSelect.innerHTML = symbolsWithMultiple.map(s => `<option value="${s}">${s}</option>`).join('');
            if (!strategySimulationModal.classList.contains('hidden')) {
                updateStrategyPriceForSymbol(strategySymbolSelect.value);
                runStrategySimulation();
            }
        } else {
            strategyBtnContainer.classList.add('hidden');
        }
    };

    // Event listener for adding new transactions
    addTransactionFab.addEventListener('click', () => {
        editingTransactionId = null;
        transactionForm.reset();
        transactionDateInput.value = today;
        optionExpiryInput.value = getThirdFridayOfNextMonth();
        document.getElementById('submit-btn').textContent = 'Add Transaction';
        document.getElementById('cancel-btn').classList.add('hidden');
        transactionModalTitle.textContent = 'Add New Transaction';
        toggleFields();
        addTransactionModal.classList.remove('hidden');
        addTransactionModal.classList.add('flex');
        transactionSymbolSearchResults.innerHTML = '';
    });

    // Event listener for the main page search bar input
    symbolSearchInput.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchSymbol(e.target.value.trim());
        }, 500); // 500ms debounce
    });

    // Event listener for clicking on a main search result
    searchResultsContainer.addEventListener('click', (e) => {
        const resultDiv = e.target.closest('div[data-symbol]');
        if (resultDiv) {
            const symbol = resultDiv.dataset.symbol;
            const name = resultDiv.dataset.name;
            
            // Add the selected symbol to the array if it's not already there
            const existingIndex = selectedSymbols.findIndex(s => s.symbol === symbol);
            if (existingIndex === -1) {
                selectedSymbols.push({ symbol, name });
                renderSelectedSymbols();
            }

            // Clear the search results after selection
            searchResultsContainer.innerHTML = '';
            symbolSearchInput.value = '';
        }
    });
    
    // Render the selected symbols to the UI
    const renderSelectedSymbols = () => {
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
            // Make the section visible
            selectedSymbolsSection.classList.remove('hidden');
        } else {
            // Hide the section if no symbols are selected
            selectedSymbolsSection.classList.add('hidden');
        }
    };

    // Event listener for clicks on the selected symbol cards
    selectedSymbolsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const card = target.closest('div[data-symbol]');
        
        if (target.classList.contains('remove-symbol-btn') || target.closest('.remove-symbol-btn')) {
            // Handle remove button click
            const symbolToRemove = target.closest('.remove-symbol-btn').dataset.symbol;
            selectedSymbols = selectedSymbols.filter(s => s.symbol !== symbolToRemove);
            renderSelectedSymbols();
        } else if (card) {
            // Handle card click to populate form
            const symbol = card.dataset.symbol;
            const name = card.dataset.name;
            transactionSymbolInput.value = symbol;
            transactionNameInput.value = name;
            addTransactionFab.click(); // Open the transaction modal
        }
    });

    // Event listener for transaction modal symbol input
    transactionSymbolInput.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            lookupSymbol(e.target.value.trim());
        }, 500);
    });

    // Event listener for clicking on a transaction modal search result
    transactionSymbolSearchResults.addEventListener('click', (e) => {
        const resultDiv = e.target.closest('div[data-symbol]');
        if (resultDiv) {
            transactionSymbolInput.value = resultDiv.dataset.symbol;
            transactionNameInput.value = resultDiv.dataset.name;
            transactionSymbolSearchResults.innerHTML = '';
        }
    });

    const updateTransactionNamesBySymbol = (symbol, name) => {
        if (!name || name.trim() === '') {
            return; // Don't update if the new name is empty
        }
        transactions.forEach(t => {
            if (t.symbol === symbol && (!t.name || t.name.trim() === '')) {
                t.name = name;
            }
        });
    };


    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const assetType = document.getElementById('asset-type').value;
        const action = document.getElementById('action').value;
        const symbol = document.getElementById('symbol').value.toUpperCase();
        const name = nameInput.value.trim();
        const quantity = parseFloat(document.getElementById('quantity').value);
        const transactionDate = document.getElementById('transaction-date').value;
        const currency = document.getElementById('currency').value;

        let newTransaction = {
            id: editingTransactionId || Date.now(),
            assetType,
            action,
            symbol,
            name,
            quantity,
            transactionDate,
            currency,
        };

        if (assetType === 'Stock') {
            newTransaction.transactionPrice = parseFloat(document.getElementById('stock-price').value);
            newTransaction.fees = parseFloat(document.getElementById('stock-fees').value);
        } else {
            newTransaction.strikePrice = parseFloat(document.getElementById('option-strike').value);
            newTransaction.premium = parseFloat(document.getElementById('option-premium').value);
            // Set underlying asset price to strike price if not explicitly set
            newTransaction.underlyingAssetPrice = parseFloat(document.getElementById('option-underlying').value) || newTransaction.strikePrice;
            newTransaction.expiryDate = document.getElementById('option-expiry').value;
            newTransaction.fees = parseFloat(document.getElementById('option-fees').value);
        }

        if (editingTransactionId) {
            const index = transactions.findIndex(t => t.id == editingTransactionId);
            if (index !== -1) {
                transactions[index] = newTransaction;
            }
            editingTransactionId = null;
            showToast('Transaction updated successfully!');
        } else {
            transactions.push(newTransaction);
            showToast('Transaction added successfully!');
        }

        // Call  update names for matching symbols
        if (name) { // Only run if a name was provided
            updateTransactionNamesBySymbol(symbol, name);
        }

        saveTransactions();
        transactionForm.reset();
        transactionDateInput.value = today;
        optionExpiryInput.value = getThirdFridayOfNextMonth(); // Reset expiry for next new transaction
        addTransactionModal.classList.add('hidden'); // Hide modal after save
        addTransactionModal.classList.remove('flex');
        renderTransactionList();
    });
    
    const saveTransactions = () => {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    };


    transactionListDiv.addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        const action = target.dataset.action;
        const transaction = transactions.find(t => t.id == id);
        
        if (action === 'toggle-details') {
            const details = document.getElementById(`details-${id}`);
            const chevron = target.querySelector('svg');
            if (details.classList.contains('expanded')) {
                details.classList.remove('expanded');
                chevron.style.transform = 'rotate(0deg)';
            } else {
                details.classList.add('expanded');
                chevron.style.transform = 'rotate(180deg)';
            }
        } else if (target.classList.contains('edit-btn')) {
            editingTransactionId = id;
            transactionModalTitle.textContent = 'Edit Transaction';
            document.getElementById('submit-btn').textContent = 'Save Changes';
            document.getElementById('cancel-btn').classList.remove('hidden');

            document.getElementById('asset-type').value = transaction.assetType;
            document.getElementById('action').value = transaction.action;
            document.getElementById('symbol').value = transaction.symbol;
            nameInput.value = transaction.name || '';
            document.getElementById('quantity').value = transaction.quantity;
            document.getElementById('transaction-date').value = transaction.transactionDate;
            document.getElementById('currency').value = transaction.currency;

            if (transaction.assetType === 'Stock') {
                document.getElementById('stock-price').value = transaction.transactionPrice;
                document.getElementById('stock-fees').value = transaction.fees;
            } else {
                document.getElementById('option-strike').value = transaction.strikePrice;
                document.getElementById('option-premium').value = transaction.premium;
                document.getElementById('option-underlying').value = transaction.underlyingAssetPrice;
                document.getElementById('option-expiry').value = transaction.expiryDate;
                document.getElementById('option-fees').value = transaction.fees;
            }
            toggleFields(); // Ensure correct fields are shown and fees are set
            addTransactionModal.classList.remove('hidden'); // Show the modal for editing
            addTransactionModal.classList.add('flex');
            // Clear symbol search results when modal is opened for editing
            transactionSymbolSearchResults.innerHTML = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (target.classList.contains('delete-btn')) {
            transactionToDeleteId = id;
            deleteModal.classList.remove('hidden');
            deleteModal.classList.add('flex');
        } else if (target.classList.contains('simulate-btn')) {
            pnlSimulationModal.classList.remove('hidden');
            pnlSimulationModal.classList.add('flex');
            pnlChartsContainer.innerHTML = '';
            
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'bg-white rounded-lg p-4 mb-4 shadow-sm';
            const canvas = document.createElement('canvas');
            const canvasId = `pnl-chart-${id}`;
            canvas.id = canvasId;
            canvas.className = 'w-full h-[400px]';
            chartWrapper.appendChild(canvas);
            pnlChartsContainer.appendChild(chartWrapper);

            const relevantPrice = transaction.assetType === 'Stock' ? transaction.transactionPrice : (transaction.underlyingAssetPrice || transaction.strikePrice);
            const initialMinPrice = relevantPrice * 0;
            const initialMaxPrice = relevantPrice * 2;
            
            simulateAndDrawChart(transaction, canvasId, initialMinPrice, initialMaxPrice, relevantPrice);
        }
    });

    closePnlModalBtn.addEventListener('click', () => {
        pnlSimulationModal.classList.add('hidden');
    });
    document.getElementById('close-strategy-modal').addEventListener('click', () => {
        strategySimulationModal.classList.add('hidden');
    });

    confirmDeleteBtn.addEventListener('click', () => {
        transactions = transactions.filter(t => t.id != transactionToDeleteId);
        saveTransactions();
        renderTransactionList();
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
        showToast('Transaction deleted successfully!');
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
        transactionToDeleteId = null;
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
        editingTransactionId = null;
        transactionForm.reset();
        transactionDateInput.value = today;
        optionExpiryInput.value = getThirdFridayOfNextMonth();
        document.getElementById('submit-btn').textContent = 'Add Transaction';
        document.getElementById('cancel-btn').classList.add('hidden');
        addTransactionModal.classList.add('hidden'); // Hide modal on cancel
        addTransactionModal.classList.remove('flex');
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        const json = JSON.stringify(transactions, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Transactions exported successfully!');
    });

    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedTransactions = JSON.parse(event.target.result);
                if (Array.isArray(importedTransactions)) {
                    importedTransactions.forEach(importedTransaction => {
                        const existingIndex = transactions.findIndex(t => t.id === importedTransaction.id);
                        if (existingIndex !== -1) {
                            transactions[existingIndex] = importedTransaction;
                        } else {
                            //transactions.push(importedTransactions);
                            transactions.push(importedTransaction);
                        }
                    });
                    saveTransactions();
                    renderTransactionList();
                    showMessageBox('Transactions imported successfully!');
                } else {
                    showMessageBox('Invalid JSON file format. Please import a file containing an array of transactions.');
                }
            } catch (error) {
                showMessageBox('Error parsing JSON file. Please ensure the file is valid.');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    const chartInstances = {};

    const zoomChart = (chartId, relevantPrice, zoomFactor) => {
        const chartData = chartInstances[chartId].data;
        const currentLabels = chartData.labels.map(l => parseFloat(l));
        const currentMinPrice = currentLabels[0];
        const currentMaxPrice = currentLabels[currentLabels.length - 1];

        const centerPrice = relevantPrice;
        const newMinPrice = centerPrice + (currentMinPrice - centerPrice) * zoomFactor;
        const newMaxPrice = centerPrice + (currentMaxPrice - centerPrice) * zoomFactor;
        
        if (newMinPrice < 0) {
            simulateAndDrawChart(chartInstances[chartId].transactionData, chartId, 0, newMaxPrice, relevantPrice);
        } else {
            simulateAndDrawChart(chartInstances[chartId].transactionData, chartId, newMinPrice, newMaxPrice, relevantPrice);
        }
    };

    const zoomInPnlBtn = document.getElementById('zoom-in-pnl-btn');
    if (zoomInPnlBtn) {
        zoomInPnlBtn.addEventListener('click', () => {
            const pnlCanvas = pnlChartsContainer.querySelector('canvas');
            if (pnlCanvas) {
                const chartId = pnlCanvas.id;
                const transaction = chartInstances[chartId].transactionData;
                const relevantPrice = transaction.assetType === 'Stock' ? transaction.transactionPrice : (transaction.underlyingAssetPrice || transaction.strikePrice);
                zoomChart(chartId, relevantPrice, 0.9);
            }
        });
    }

    const zoomOutPnlBtn = document.getElementById('zoom-out-pnl-btn');
    if (zoomOutPnlBtn) {
        zoomOutPnlBtn.addEventListener('click', () => {
            const pnlCanvas = pnlChartsContainer.querySelector('canvas');
            if (pnlCanvas) {
                const chartId = pnlCanvas.id;
                const transaction = chartInstances[chartId].transactionData;
                const relevantPrice = transaction.assetType === 'Stock' ? transaction.transactionPrice : (transaction.underlyingAssetPrice || transaction.strikePrice);
                zoomChart(chartId, relevantPrice, 1.1);
            }
        });
    }

    const zoomInStrategyBtn = document.getElementById('zoom-in-strategy-btn');
    if (zoomInStrategyBtn) {
        zoomInStrategyBtn.addEventListener('click', () => {
            const chartId = 'strategy-chart';
            const relevantPrice = parseFloat(document.getElementById('strategy-price').value);
            if (!isNaN(relevantPrice) && chartInstances[chartId]) {
                 zoomChart(chartId, relevantPrice, 0.9);
            }
        });
    }

    const zoomOutStrategyBtn = document.getElementById('zoom-out-strategy-btn');
    if (zoomOutStrategyBtn) {
        zoomOutStrategyBtn.addEventListener('click', () => {
            const chartId = 'strategy-chart';
            const relevantPrice = parseFloat(document.getElementById('strategy-price').value);
            if (!isNaN(relevantPrice) && chartInstances[chartId]) {
                zoomChart(chartId, relevantPrice, 1.1);
            }
        });
    }
    
    const simulateAndDrawChart = (transactionOrArray, canvasId, minPrice, maxPrice, relevantPrice) => {
        const labels = [];
        const pnlData = [];
        const numDataPoints = 201; 
        const priceStep = (maxPrice - minPrice) / (numDataPoints - 1);
        let maxProfit = -Infinity;
        let maxLoss = Infinity;

        for (let i = 0; i < numDataPoints; i++) {
            const simulatedPrice = minPrice + (i * priceStep);
            labels.push(simulatedPrice.toFixed(2));
            let totalPnl = 0;

            if (Array.isArray(transactionOrArray)) {
                transactionOrArray.forEach(t => {
                    if (t.assetType === 'Stock') {
                        totalPnl += calculateStockPNL(simulatedPrice, t);
                    } else {
                        totalPnl += calculateOptionPNL(simulatedPrice, t);
                    }
                });
            } else {
                const transaction = transactionOrArray;
                if (transaction.assetType === 'Stock') {
                    totalPnl = calculateStockPNL(simulatedPrice, transaction);
                } else {
                    totalPnl = calculateOptionPNL(simulatedPrice, transaction);
                }
            }
            
            pnlData.push(totalPnl);
            if (totalPnl > maxProfit) maxProfit = totalPnl;
            if (totalPnl < maxLoss) maxLoss = totalPnl;
        }
        
        const title = (Array.isArray(transactionOrArray)) ? `Strategy P&L for ${transactionOrArray[0].symbol}` : `${transactionOrArray.symbol} P&L`;
        const currency = (Array.isArray(transactionOrArray)) ? transactionOrArray[0].currency : transactionOrArray.currency;
        
        drawChart(pnlData, labels, canvasId, title, [], maxProfit, maxLoss, relevantPrice, transactionOrArray);
    };

    const drawChart = (data, labels, canvasId, title, breakevenPrices, maxProfitValue, maxLossValue, relevantPrice, transactionData) => {
        const canvas = document.getElementById(canvasId);
        const chartInstance = chartInstances[canvasId];
        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        const breakevenAnnotations = {};
        if (breakevenPrices && breakevenPrices.length > 0) {
            breakevenPrices.forEach((price, index) => {
                breakevenAnnotations[`breakeven${index + 1}`] = {
                    type: 'line',
                    xMin: parseFloat(price),
                    xMax: parseFloat(price),
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 2,
                    borderDash: [6, 6],
                    label: {
                        content: `Breakeven: ${price}`,
                        enabled: true,
                        position: 'start',
                        backgroundColor: 'rgba(255, 99, 132, 0.7)'
                    }
                };
            });
        }

        const maxProfitIndex = data.indexOf(maxProfitValue);
        const maxLossIndex = data.indexOf(maxLossValue);
        
        const annotations = {
            annotations: {
                ...breakevenAnnotations,
                xMedianLine: {
                    type: 'line',
                    xMin: relevantPrice,
                    xMax: relevantPrice,
                    borderColor: 'rgba(128, 128, 128, 0.5)',
                    borderWidth: 2,
                    borderDash: [6, 6],
                    label: {
                        content: `Relevant Price: ${relevantPrice}`,
                        enabled: true,
                        position: 'end',
                        backgroundColor: 'rgba(128, 128, 128, 0.7)'
                    }
                },
                maxLossLabel: {
                     type: 'label',
                     xValue: labels[maxLossIndex] || labels[0],
                     yValue: maxLossValue,
                     content: `Max Loss: ${maxLossValue === -Infinity ? '−∞' : maxLossValue.toFixed(2)}`,
                     backgroundColor: 'rgba(248, 215, 218, 0.8)',
                     color: 'rgb(220, 53, 69)',
                     font: {
                        size: 14,
                        weight: 'bold'
                     },
                     position: 'top',
                     callout: {
                        display: true
                     }
                },
                maxProfitLabel: {
                    type: 'label',
                    xValue: labels[maxProfitIndex] || labels[labels.length - 1],
                    yValue: maxProfitValue,
                    content: `Max Profit: ${maxProfitValue === Infinity ? '∞' : maxProfitValue.toFixed(2)}`,
                    backgroundColor: 'rgba(212, 237, 218, 0.8)',
                    color: 'rgb(25, 135, 84)',
                    font: {
                        size: 14,
                        weight: 'bold'
                    },
                    position: 'top',
                    callout: {
                        display: true
                     }
                }
            }
        };
        
        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Profit/Loss',
                        data: data,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: (context) => {
                            const chart = context.chart;
                            const { ctx, chartArea, scales } = chart;
                            if (!chartArea) return;
                            const zeroY = scales.y.getPixelForValue(0);
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            const offset = (zeroY - chartArea.top) / (chartArea.bottom - chartArea.top);
                            gradient.addColorStop(0, '#d4edda');
                            gradient.addColorStop(offset, '#d4edda');
                            gradient.addColorStop(offset, '#f8d7da');
                            gradient.addColorStop(1, '#f8d7da');
                            return gradient;
                        },
                        fill: 'origin',
                        tension: 0.4,
                        pointRadius: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: title,
                        font: { size: 16 }
                    },
                    annotation: annotations,
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'xy'
                        },
                        zoom: {
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'xy'
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Price'
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            callback: function(val, index) {
                                const value = this.getLabelForValue(val);
                                return value !== '' ? parseFloat(value).toFixed(2) : '';
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Profit/Loss'
                        },
                        beginAtZero: true
                    }
                },
            },
        };
        chartInstances[canvasId] = new Chart(ctx, config);
        chartInstances[canvasId].transactionData = transactionData;
    };
    
    const runStrategySimulation = () => {
        const symbol = strategySymbolSelect.value;
        const relevantPrice = parseFloat(strategyPriceInput.value);

        if (!symbol || isNaN(relevantPrice)) {
            return;
        }

        const transactionsForSymbol = transactions.filter(t => t.symbol === symbol);
        
        const initialMinPrice = relevantPrice * 0;
        const initialMaxPrice = relevantPrice * 2;
        
        simulateAndDrawChart(transactionsForSymbol, 'strategy-chart', initialMinPrice, initialMaxPrice, relevantPrice);
        
        const currency = transactionsForSymbol[0].currency;
        const {maxProfit, maxLoss, breakevenPrices} = calculateStrategyMetrics(transactionsForSymbol);
        
        updateStrategyMetrics(maxProfit, maxLoss, breakevenPrices, currency);
    }

    const updateStrategyPriceForSymbol = (symbol) => {
         if (symbol) {
            const transactionsForSymbol = transactions.filter(t => t.symbol === symbol);
            let maxPrice = 0;
            transactionsForSymbol.forEach(t => {
                let price = 0;
                if (t.assetType === 'Stock') {
                    price = t.transactionPrice;
                } else {
                    price = Math.max(t.strikePrice, t.underlyingAssetPrice || 0);
                }
                if (price > maxPrice) {
                    maxPrice = price;
                }
            });
            strategyPriceInput.value = maxPrice.toFixed(2);
         }
    }

    document.getElementById('strategy-btn').addEventListener('click', () => {
        strategySimulationModal.classList.remove('hidden');
        strategySimulationModal.classList.add('flex');
        const symbol = strategySymbolSelect.value;
        if (symbol) {
            updateStrategyPriceForSymbol(symbol);
            runStrategySimulation();
        }
    });

    strategySymbolSelect.addEventListener('change', () => {
        const symbol = strategySymbolSelect.value;
        updateStrategyPriceForSymbol(symbol);
        runStrategySimulation();
    });

    strategyPriceInput.addEventListener('input', runStrategySimulation);
    
    const calculateStrategyMetrics = (transactionsForSymbol) => {
        const pnlData = [];
        const relevantPrice = parseFloat(strategyPriceInput.value);
        
        const minPrice = relevantPrice * 0;
        const maxPrice = relevantPrice * 2;
        const numDataPoints = 201; 
        const priceStep = (maxPrice - minPrice) / (numDataPoints - 1);

        let maxProfit = -Infinity;
        let maxLoss = Infinity;
        let breakevenPrices = [];

        for (let i = 0; i < numDataPoints; i++) {
            const simulatedPrice = minPrice + (i * priceStep);
            let totalPnl = 0;

            transactionsForSymbol.forEach(t => {
                if (t.assetType === 'Stock') {
                    totalPnl += calculateStockPNL(simulatedPrice, t);
                } else {
                    totalPnl += calculateOptionPNL(simulatedPrice, t);
                }
            });
            
            pnlData.push(totalPnl);
            if (totalPnl > maxProfit) maxProfit = totalPnl;
            if (totalPnl < maxLoss) maxLoss = totalPnl;
            
            if (i > 0 && (pnlData[i] * pnlData[i-1] < 0)) {
                const prevPrice = minPrice + ((i - 1) * priceStep);
                const prevPnl = pnlData[i - 1];
                const currPrice = simulatedPrice;
                const currPnl = pnlData[i];
                const exactBreakeven = prevPrice - (prevPnl * ((currPrice - prevPrice) / (currPnl - prevPnl)));
                breakevenPrices.push(exactBreakeven.toFixed(2));
            }
        }
        return {maxProfit, maxLoss, breakevenPrices};
    }

    const updateStrategyMetrics = (maxProfit, maxLoss, breakevenPrices, currency) => {
        const profitEl = document.getElementById('strategy-max-profit');
        const lossEl = document.getElementById('strategy-max-loss');
        const breakevenEl = document.getElementById('strategy-breakeven-range');

        profitEl.textContent = maxProfit === Infinity ? '∞' : `${maxProfit.toFixed(2)} ${currency}`;
        lossEl.textContent = maxLoss === -Infinity ? '-∞' : `${maxLoss.toFixed(2)} ${currency}`;
        breakevenEl.textContent = breakevenPrices.length > 0 ? breakevenPrices.join(' & ') : 'None';

        profitEl.className = `font-bold ${maxProfit > 0 || maxProfit === Infinity ? 'text-logo-green' : 'text-neutral-text'}`;
        lossEl.className = `font-bold ${maxLoss < 0 || maxLoss === -Infinity ? 'text-logo-red' : 'text-neutral-text'}`;
        breakevenEl.className = 'font-bold text-neutral-text';
    };

    const analyzeStrategyBtn = document.getElementById('analyze-strategy-btn');
    const analysisResultDiv = document.getElementById('strategy-analysis-result');
    const analysisStatusP = document.getElementById('analyze-strategy-status');

    analyzeStrategyBtn.addEventListener('click', async () => {
        const symbol = strategySymbolSelect.value;
        if (!symbol) {
            showMessageBox('Please select a symbol to analyze a strategy.');
            return;
        }

        if (!apiKeys.geminiApiKey) {
            showMessageBox('Please provide your Gemini API Key in the Data Management section to use this feature.');
            return;
        }

        analysisResultDiv.innerHTML = '';
        analysisStatusP.textContent = 'Analyzing your strategy...';
        analyzeStrategyBtn.disabled = true;

        const transactionsForSymbol = transactions.filter(t => t.symbol === symbol);
        
        const transactionListPrompt = transactionsForSymbol.map(t => {
            const displayName = t.name && t.name.trim() !== '' ? t.name : t.symbol;
            if (t.assetType === 'Stock') {
                return `a ${t.action} of ${t.quantity} shares of ${displayName} at a price of ${t.transactionPrice} ${t.currency}`;
            } else {
                return `a ${t.action} of ${t.quantity} ${t.assetType.replace(' Option', '')} options on ${displayName} with a strike price of ${t.strikePrice} ${t.currency} and a premium of ${t.premium} ${t.currency}`;
            }
        }).join(', ');

        const prompt = `Based on the following list of transactions, identify the type of options trading strategy being employed and provide a short, simple explanation of its characteristics, including its risk profile and potential for profit and loss. Do not include financial advice, just a general explanation.
        Transactions: ${transactionListPrompt}.`;

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
                const text = result.candidates[0].content.parts[0].text;
                analysisResultDiv.innerHTML = text.replace(/\n/g, '<br>');
                analysisStatusP.textContent = 'Analysis complete.';
            } else {
                analysisResultDiv.textContent = 'Unable to analyze the strategy. The response from the API was empty or invalid.';
                analysisStatusP.textContent = 'Error during analysis.';
            }

        } catch (error) {
            console.error('Error calling Gemini API:', error);
            analysisResultDiv.textContent = 'An error occurred while analyzing the strategy. Please try again later.';
            analysisStatusP.textContent = 'Error during analysis.';
        } finally {
            analyzeStrategyBtn.disabled = false;
        }
    });

    document.getElementById('close-pnl-modal').addEventListener('click', () => {
        pnlSimulationModal.classList.add('hidden');
    });
    document.getElementById('close-strategy-modal').addEventListener('click', () => {
        strategySimulationModal.classList.add('hidden');
    });

    window.addEventListener('load', async () => {
        await initializeApiKeys();
        toggleFields();
        renderTransactionList();
    });
});