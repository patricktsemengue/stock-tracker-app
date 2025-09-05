import { addOrUpdateTransaction, getTransactionById, setEditingTransactionId, renderTransactionList, exportTransactions, importTransactions, clearAllData, deleteTransaction } from './transactionManager.js';
import { runStrategySimulation, updateStrategyPriceForSymbol, simulateAndDrawTransactionPnlChart } from './simulator.js';
import { searchSymbol, lookupSymbol, addSelectedSymbol, removeSelectedSymbol, renderSelectedSymbols } from './searchAndSelect.js';
import { saveApiKeys, initializeAppConfig, analyzeStrategyWithGemini, getApiKeys } from './apiManager.js';
import { getForexRatesWithDate, saveForexRates, saveRecentlySearched, getRecentlySearched } from './storage.js';
import { calculateStockPNL, calculateOptionPNL } from './metrics.js';


// --- Helper Functions ---
export const showMessageBox = (message) => {
    const messageBox = document.getElementById('message-box');
    document.getElementById('message-text').textContent = message;
    messageBox.classList.remove('hidden');
    messageBox.classList.add('flex');
};

export const showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 3000);
};

const getThirdFridayOfNextMonth = () => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    if (month > 11) {
        month = 0;
        year++;
    }
    let firstDayOfNextMonth = new Date(year, month, 1);
    let fridayCount = 0;
    let day = 1;
    let thirdFriday = null;
    while (fridayCount < 3) {
        const currentDate = new Date(year, month, day);
        if (currentDate.getDay() === 5) {
            fridayCount++;
            if (fridayCount === 3) {
                thirdFriday = currentDate;
            }
        }
        day++;
    }
    return thirdFriday.toISOString().split('T')[0];
};

const setDefaultFees = (assetTypeSelect, currencySelect, stockFeesInput, optionFeesInput) => {
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
            fee = 2.02;
        }
    }
    if (assetType === 'Stock') {
        stockFeesInput.value = fee.toFixed(2);
    } else {
        optionFeesInput.value = fee.toFixed(2);
    }
};

const toggleFields = (assetTypeSelect, stockFields, optionFields) => {
    if (assetTypeSelect.value === 'Stock') {
        stockFields.classList.remove('hidden');
        optionFields.classList.add('hidden');
    } else {
        stockFields.classList.add('hidden');
        optionFields.classList.remove('hidden');
        document.getElementById('option-underlying').value = document.getElementById('option-strike').value;
        document.getElementById('option-expiry').value = getThirdFridayOfNextMonth();
    }
    setDefaultFees(assetTypeSelect, document.getElementById('currency'), document.getElementById('stock-fees'), document.getElementById('option-fees'));
};

// --- API Functions ---
export const getForexRates = async () => {
    const today = new Date().toISOString().split('T')[0];
    const cachedData = getForexRatesWithDate();

    // Use cached data if it's from today and not empty
    if (cachedData.date === today && Object.keys(cachedData.rates).length > 0) {
        return cachedData.rates;
    }

    const rates = {};
    // Map application symbols (e.g., EURUSD) to API symbols (e.g., EUR_USD)
    const symbolsToFetch = {
        EURUSD: 'EUR_USD',
        EURCHF: 'EUR_CHF'
    };

    try {
        const promises = Object.entries(symbolsToFetch).map(async ([appSymbol, apiSymbol]) => {
            const response = await fetch(`/api/rates?symbol=${apiSymbol}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch rate for ${apiSymbol} from proxy.`);
            }
            const data = await response.json();
            // According to swagger, API returns an array like [{"symbol":"EUR_USD","value":1.08...}]
            if (data && data.length > 0 && data[0].value) {
                rates[appSymbol] = data[0].value;
            }
        });

        await Promise.all(promises);

        if (Object.keys(rates).length > 0) {
            saveForexRates(rates);
            return rates;
        } else {
            // Fallback to old cached data if fetching fails
            return cachedData.rates || null;
        }
    } catch (error) {
        console.error('Error fetching forex rates via proxy:', error);
        // On error, return old cached data if available
        return cachedData.rates || null;
    }
};

// --- Discovery Card Logic ---
const discoveryCardModal = document.getElementById('discovery-card-modal');
const discoveryCardContent = document.getElementById('discovery-card-content');
let activeQuoteData = null; 

const createPnlChart = (canvasId, data, labels, breakEven) => {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window.discoveryCharts && window.discoveryCharts[canvasId]) {
        window.discoveryCharts[canvasId].destroy();
    }
    window.discoveryCharts = window.discoveryCharts || {};
    window.discoveryCharts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'P&L',
                data,
                borderColor: '#2a5a54',
                fill: true,
                tension: 0.1,
                pointRadius: 0,
                backgroundColor: context => {
                    const chart = context.chart;
                    const { ctx, chartArea, scales } = chart;
                    if (!chartArea) {
                        return null;
                    }
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    const zero = scales.y.getPixelForValue(0);
                    let yZero = (zero - chartArea.top) / (chartArea.bottom - chartArea.top);

                    // Clamp the value to the valid [0, 1] range to prevent the error
                    yZero = Math.max(0, Math.min(1, yZero));

                    gradient.addColorStop(0, 'rgba(75, 192, 192, 0.2)');
                    gradient.addColorStop(yZero, 'rgba(75, 192, 192, 0.2)');
                    gradient.addColorStop(yZero, 'rgba(255, 99, 132, 0.2)');
                    gradient.addColorStop(1, 'rgba(255, 99, 132, 0.2)');
                    return gradient;
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 0,
                            yMax: 0,
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 2,
                        },
                        breakeven: {
                            type: 'line',
                            xMin: breakEven,
                            xMax: breakEven,
                            borderColor: 'rgb(54, 162, 235)',
                            borderWidth: 2,
                            borderDash: [10, 5],
                            label: {
                                content: 'Breakeven',
                                enabled: true,
                                position: 'start'
                            }
                        }
                    }
                }
            },
            scales: {
                x: { display: true },
                y: { display: true }
            }
        }
    });
};

const updatePnlChart = (slide) => {
    const quantity = parseFloat(slide.querySelector('.quantity-input').value) || 0;
    const type = slide.dataset.type;
    const canvasId = slide.querySelector('canvas').id;
    
    let strikePrice = activeQuoteData.current; // Default strike for range calculation
    
    if(strikePrice === null) return; 

    const range = strikePrice * 0.5;
    const labels = Array.from({ length: 51 }, (_, i) => (strikePrice - range + (i * range / 25)).toFixed(2));
    let pnlData = [];
    let breakEven = 0;

    if (type === 'Buy Stock') {
        const transactionPrice = parseFloat(slide.querySelector('.transaction-price-input').value) || strikePrice;
        const transaction = { action: 'Buy', quantity, transactionPrice, fees: 0 };
        pnlData = labels.map(price => calculateStockPNL(parseFloat(price), transaction));
        breakEven = transactionPrice;
    } else {
        // For options, the strike price is read from its own input
        strikePrice = parseFloat(slide.querySelector('.strike-price-input').value) || activeQuoteData.current;
        const premium = parseFloat(slide.querySelector('.premium-input').value) || strikePrice * 0.05;
        let transaction;
        if (type === 'Sell Call') {
            transaction = { action: 'Sell', assetType: 'Call Option', quantity, strikePrice, premium, fees: 0 };
            breakEven = strikePrice + premium;
        } else if (type === 'Sell Put') {
            transaction = { action: 'Sell', assetType: 'Put Option', quantity, strikePrice, premium, fees: 0 };
            breakEven = strikePrice - premium;
        }
        pnlData = labels.map(price => calculateOptionPNL(parseFloat(price), transaction));
    }
    createPnlChart(canvasId, pnlData, labels, breakEven);
};


const updateDiscoveryCardMetrics = (slide) => {
    const quantity = parseFloat(slide.querySelector('.quantity-input').value) || 0;
    const type = slide.dataset.type;
    const price = activeQuoteData.current;

    if(price === null) {
        slide.querySelector('.metric-cash').textContent = 'N/A';
        slide.querySelector('.metric-loss').textContent = 'N/A';
        slide.querySelector('.metric-breakeven').textContent = 'N/A';
        return;
    };
    
    let cashImpact = 0, potentialLoss = 'N/A', breakEven = 'N/A';
    
    if (type === 'Buy Stock') {
        const transactionPrice = parseFloat(slide.querySelector('.transaction-price-input').value) || price;
        cashImpact = -(transactionPrice * quantity);
        potentialLoss = transactionPrice * quantity;
        breakEven = transactionPrice;
    } else if (type === 'Sell Call') {
        const strikePrice = parseFloat(slide.querySelector('.strike-price-input').value) || price;
        const premium = parseFloat(slide.querySelector('.premium-input').value) || strikePrice * 0.05;
        cashImpact = premium * 100 * quantity;
        potentialLoss = 'Unlimited';
        breakEven = strikePrice + premium;
    } else if (type === 'Sell Put') {
        const strikePrice = parseFloat(slide.querySelector('.strike-price-input').value) || price;
        const premium = parseFloat(slide.querySelector('.premium-input').value) || strikePrice * 0.05;
        cashImpact = premium * 100 * quantity;
        potentialLoss = (strikePrice - premium) * 100 * quantity;
        breakEven = strikePrice - premium;
    }

    const cashMetric = slide.querySelector('.metric-cash');
    const lossMetric = slide.querySelector('.metric-loss');
    
    if (type === 'Buy Stock') {
        cashMetric.textContent = `${Math.abs(cashImpact).toFixed(2)}`;
    } else {
        cashMetric.textContent = `${cashImpact.toFixed(2)}`;
    }
    
    cashMetric.classList.toggle('text-logo-green', cashImpact >= 0);
    cashMetric.classList.toggle('text-logo-red', cashImpact < 0);


    lossMetric.textContent = typeof potentialLoss === 'string' ? potentialLoss : potentialLoss.toFixed(2);
    lossMetric.classList.toggle('text-logo-red', potentialLoss === 'Unlimited' || potentialLoss > 0);

    slide.querySelector('.metric-breakeven').textContent = typeof breakEven === 'string' ? breakEven : breakEven.toFixed(2);
    
    updatePnlChart(slide);
};

const renderDiscoveryCardContent = (symbol, name, quote) => {
    const priceDisplay = quote.current ? `$${quote.current.toFixed(2)}` : 'N/A';
    
    let detailsHtml;
    // Conditionally render the OHLC section based on available data
    if (quote.open !== null && quote.high !== null && quote.low !== null) {
        const open = `$${quote.open.toFixed(2)}`;
        const high = `$${quote.high.toFixed(2)}`;
        const low = `$${quote.low.toFixed(2)}`;
        detailsHtml = `
            <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-center">
                <div><p class="text-gray-400">Open</p><p class="font-semibold text-gray-700">${open}</p></div>
                <div><p class="text-gray-400">High</p><p class="font-semibold text-gray-700">${high}</p></div>
                <div><p class="text-gray-400">Low</p><p class="font-semibold text-gray-700">${low}</p></div>
                <div><p class="text-gray-400">Last Price</p><p class="font-semibold text-gray-700">${priceDisplay}</p></div>
            </div>
        `;
    } else {
        // Render a simplified view if only the last price is available
        detailsHtml = `
            <div class="mt-4 text-sm text-center">
                <p class="text-gray-500">Detailed OHLC data not available for this source.</p>
            </div>
        `;
    }

    return `
        <div class="border-b pb-4">
            <div class="flex justify-between items-center">
                <div><h2 class="text-3xl font-bold text-gray-800">${symbol}</h2><p class="text-gray-500">${name}</p></div>
                <div class="text-right"><p class="text-3xl font-bold text-logo-primary">${priceDisplay}</p></div>
            </div>
            ${detailsHtml}
        </div>
        <div class="relative">
            <div id="discovery-carousel-wrapper"></div>
            <button id="discovery-prevBtn" class="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-8 bg-gray-200 p-2 rounded-full hover:bg-gray-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
            <button id="discovery-nextBtn" class="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-8 bg-gray-200 p-2 rounded-full hover:bg-gray-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></button>
        </div>
    `;
};

export const showDiscoveryCard = async (symbol, name) => {
    discoveryCardModal.classList.remove('hidden');
    discoveryCardModal.classList.add('flex');

    // Get the full data object from the "recently searched" cache
    const cachedSymbol = getRecentlySearched().find(s => s.symbol === symbol);

    // If the symbol isn't in the cache for some reason, show an error.
    if (!cachedSymbol || !cachedSymbol.quote) {
        discoveryCardContent.innerHTML = `<p class="text-center text-logo-red">Could not find cached data for ${symbol}.</p>`;
        return;
    }
    
    // The entire quote object is retrieved from the cache. No API call is made.
    const quote = cachedSymbol.quote;

    activeQuoteData = quote;
    discoveryCardContent.innerHTML = renderDiscoveryCardContent(symbol, name, quote);
    
    const carouselWrapper = document.getElementById('discovery-carousel-wrapper');
    carouselWrapper.innerHTML = ''; 

    if (activeQuoteData.current === null) {
        carouselWrapper.innerHTML = `<p class="text-center text-gray-500 mt-4">Price data not available, cannot simulate strategies.</p>`;
        return;
    }

    const slidesData = [
        { type: 'Buy Stock', color: 'text-logo-blue', chartId: 'pnlChartStock' },
        { type: 'Sell Call', color: 'text-logo-green', chartId: 'pnlChartCall' },
        { type: 'Sell Put', color: 'text-logo-red', chartId: 'pnlChartPut' }
    ];

    slidesData.forEach(slideData => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.dataset.type = slideData.type;
        
        const cashMetricLabel = slideData.type === 'Buy Stock' ? 'Invested Cash' : 'Premium Income';
        const defaultQuantity = slideData.type === 'Buy Stock' ? 100 : 1;
        const currentPrice = activeQuoteData.current;

        let editableField = '';
        if (slideData.type === 'Buy Stock') {
            editableField = `<div><label class="block text-sm font-medium text-gray-600 mb-1">Transaction Price</label><input type="number" class="w-full p-2 border border-gray-300 rounded-md transaction-price-input" value="${currentPrice.toFixed(2)}"></div>`;
        } else {
            let defaultStrike = currentPrice;
            if (slideData.type === 'Sell Call') {
                defaultStrike = currentPrice * 0.90; // Strike = price - 10%
            } else if (slideData.type === 'Sell Put') {
                defaultStrike = currentPrice * 1.10; // Strike = price + 10%
            }
            const defaultPremium = defaultStrike * 0.05;

            editableField = `
                <div><label class="block text-sm font-medium text-gray-600 mb-1">Strike Price</label><input type="number" class="w-full p-2 border border-gray-300 rounded-md strike-price-input" value="${defaultStrike.toFixed(2)}"></div>
                <div><label class="block text-sm font-medium text-gray-600 mb-1">Premium</label><input type="number" class="w-full p-2 border border-gray-300 rounded-md premium-input" value="${defaultPremium.toFixed(2)}"></div>
            `;
        }

        slide.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-xl font-bold text-center ${slideData.color}">${slideData.type}</h3>
                <div><label class="block text-sm font-medium text-gray-600 mb-1">Quantity</label><input type="number" class="w-full p-2 border border-gray-300 rounded-md quantity-input" value="${defaultQuantity}"></div>
                ${editableField}
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div><p class="text-xs text-gray-500">${cashMetricLabel}</p><p class="font-bold text-base metric-cash">--</p></div>
                    <div><p class="text-xs text-gray-500">Potential Loss</p><p class="font-bold text-base metric-loss">--</p></div>
                    <div><p class="text-xs text-gray-500">Break-even</p><p class="font-bold text-base metric-breakeven">--</p></div>
                </div>
                <div class="h-48"><canvas id="${slideData.chartId}"></canvas></div>
                <button class="w-full bg-logo-primary text-white py-3 rounded-lg font-bold hover:bg-opacity-90 transition record-btn">Record Transaction</button>
            </div>
        `;
        carouselWrapper.appendChild(slide);
        
        updateDiscoveryCardMetrics(slide);
    });
    
    const slides = document.querySelectorAll('.carousel-slide');
    let currentSlide = 0;
    const showSlide = (index) => {
        slides.forEach((s, i) => s.style.display = i === index ? 'block' : 'none');
        updateDiscoveryCardMetrics(slides[index]);
    };
    
    document.getElementById('discovery-nextBtn').addEventListener('click', () => { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); });
    document.getElementById('discovery-prevBtn').addEventListener('click', () => { currentSlide = (currentSlide - 1 + slides.length) % slides.length; showSlide(currentSlide); });
    
    carouselWrapper.addEventListener('input', (e) => {
        if (e.target.classList.contains('quantity-input') || e.target.classList.contains('transaction-price-input') || e.target.classList.contains('premium-input') || e.target.classList.contains('strike-price-input')) {
            updateDiscoveryCardMetrics(e.target.closest('.carousel-slide'));
        }
    });

    carouselWrapper.addEventListener('click', (e) => {
        if (e.target.classList.contains('record-btn')) {
            const slide = e.target.closest('.carousel-slide');
            const transactionType = slide.dataset.type;
            const quantity = slide.querySelector('.quantity-input').value;
            
            document.getElementById('add-transaction-fab').click();
            document.getElementById('symbol').value = symbol;
            document.getElementById('name').value = name;
            document.getElementById('quantity').value = quantity;

            if (transactionType === 'Buy Stock') {
                document.getElementById('stock-price').value = slide.querySelector('.transaction-price-input').value;
            } else {
                document.getElementById('option-premium').value = slide.querySelector('.premium-input').value;
                document.getElementById('option-strike').value = slide.querySelector('.strike-price-input').value;
            }

            discoveryCardModal.classList.add('hidden');
        }
    });

    showSlide(0);
};


// --- Event Listeners and DOM Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Wake up the backend API on load, but don't block the app
    fetch('/api/ping').catch(err => console.log('API service is starting...'));

    const addTransactionFab = document.getElementById('add-transaction-fab');
    const addTransactionModal = document.getElementById('add-transaction-modal');
    const closeTransactionModalBtn = document.getElementById('close-transaction-modal');
    const dataManagementFab = document.getElementById('data-management-fab');
    const dataManagementModal = document.getElementById('data-management-modal');
    const closeDataManagementModalBtn = document.getElementById('close-data-management-modal');
    const pnlSimulationModal = document.getElementById('pnl-simulation-modal');
    const closePnlModalBtn = document.getElementById('close-pnl-modal');
    const strategySimulationModal = document.getElementById('strategy-simulation-modal');
    const closeStrategyModalBtn = document.getElementById('close-strategy-modal');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const messageOkBtn = document.getElementById('message-ok-btn');

    const transactionForm = document.getElementById('transaction-form');
    const assetTypeSelect = document.getElementById('asset-type');
    const currencySelect = document.getElementById('currency');
    const stockFields = document.getElementById('stock-fields');
    const optionFields = document.getElementById('option-fields');
    const stockFeesInput = document.getElementById('stock-fees');
    const optionFeesInput = document.getElementById('option-fees');
    const transactionDateInput = document.getElementById('transaction-date');
    const optionExpiryInput = document.getElementById('option-expiry');
    const nameInput = document.getElementById('name');
    const transactionModalTitle = document.getElementById('transaction-modal-title');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    const symbolSearchInput = document.getElementById('symbol-search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const selectedSymbolsContainer = document.getElementById('selected-symbols-container');
    const transactionSymbolInput = document.getElementById('symbol');
    const transactionNameInput = document.getElementById('name');
    const transactionSymbolSearchResults = document.getElementById('transaction-symbol-search-results');
    const strategySymbolSelect = document.getElementById('strategy-symbol');
    const strategyPriceInput = document.getElementById('strategy-price');
    const analyzeStrategyBtn = document.getElementById('analyze-strategy-btn');
    const analysisResultDiv = document.getElementById('strategy-analysis-result');
    const analysisStatusP = document.getElementById('analyze-strategy-status');

    const today = new Date().toISOString().split('T')[0];
    transactionDateInput.value = today;
    optionExpiryInput.value = getThirdFridayOfNextMonth();

    await initializeAppConfig();
    renderSelectedSymbols();
    await renderTransactionList();

    addTransactionFab.addEventListener('click', () => {
        setEditingTransactionId(null);
        transactionForm.reset();
        transactionDateInput.value = today;
        optionExpiryInput.value = getThirdFridayOfNextMonth();
        submitBtn.textContent = 'Add Transaction';
        cancelBtn.classList.add('hidden');
        transactionModalTitle.textContent = 'Add New Transaction';
        toggleFields(assetTypeSelect, stockFields, optionFields);
        addTransactionModal.classList.remove('hidden');
        addTransactionModal.classList.add('flex');
        transactionSymbolSearchResults.innerHTML = '';
    });

    closeTransactionModalBtn.addEventListener('click', () => {
        addTransactionModal.classList.add('hidden');
        addTransactionModal.classList.remove('flex');
        transactionSymbolSearchResults.innerHTML = '';
    });

    dataManagementFab.addEventListener('click', () => {
        dataManagementModal.classList.remove('hidden');
        dataManagementModal.classList.add('flex');
    });

    closeDataManagementModalBtn.addEventListener('click', () => {
        dataManagementModal.classList.add('hidden');
        dataManagementModal.classList.remove('flex');
    });

    messageOkBtn.addEventListener('click', () => {
        const messageBox = document.getElementById('message-box');
        messageBox.classList.add('hidden');
        messageBox.classList.remove('flex');
    });

    document.getElementById('clear-all-data-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all transactions and API keys? This action cannot be undone.')) {
            clearAllData();
            showToast('All data cleared successfully!');
            document.getElementById('data-management-modal').classList.add('hidden');
        }
    });

    document.getElementById('toggle-api-key-form').addEventListener('click', () => {
        const apiKeyFormContainer = document.getElementById('api-key-form-container');
        apiKeyFormContainer.classList.toggle('hidden');
    });

    document.getElementById('save-api-key-btn').addEventListener('click', () => {
        saveApiKeys();
        document.getElementById('api-key-form-container').classList.add('hidden');
    });

    symbolSearchInput.addEventListener('keyup', (e) => searchSymbol(e.target.value.trim()));

    searchResultsContainer.addEventListener('click', (e) => {
        const resultDiv = e.target.closest('div[data-symbol]');
        if (resultDiv) {
            const symbol = resultDiv.dataset.symbol;
            const name = resultDiv.dataset.name;
            const quote = JSON.parse(resultDiv.dataset.quote);
            addSelectedSymbol(symbol, name, quote); 
            searchResultsContainer.innerHTML = '';
            symbolSearchInput.value = '';
        }
    });

    selectedSymbolsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const card = target.closest('div[data-symbol]');
        if (target.classList.contains('remove-symbol-btn') || target.closest('.remove-symbol-btn')) {
            const symbolToRemove = target.closest('.remove-symbol-btn').dataset.symbol;
            removeSelectedSymbol(symbolToRemove);
        } else if (card) {
            const symbol = card.dataset.symbol;
            const name = card.dataset.name;
            showDiscoveryCard(symbol, name);
        }
    });

    transactionSymbolInput.addEventListener('keyup', (e) => lookupSymbol(e.target.value.trim()));

    transactionSymbolSearchResults.addEventListener('click', (e) => {
        const resultDiv = e.target.closest('div[data-symbol]');
        if (resultDiv) {
            const symbol = resultDiv.dataset.symbol;
            const name = resultDiv.dataset.name;
            const quote = JSON.parse(resultDiv.dataset.quote);

            // Populate the form fields
            transactionSymbolInput.value = symbol;
            transactionNameInput.value = name;

            // Call with option to NOT show the card
            addSelectedSymbol(symbol, name, quote, { showCard: false });
            
            transactionSymbolSearchResults.innerHTML = '';
        }
    });

    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const assetType = assetTypeSelect.value;
        const transactionData = {
            id: null,
            assetType: assetType,
            action: document.getElementById('action').value,
            symbol: document.getElementById('symbol').value.toUpperCase(),
            name: nameInput.value.trim(),
            quantity: parseFloat(document.getElementById('quantity').value),
            transactionDate: transactionDateInput.value,
            currency: currencySelect.value
        };
        if (assetType === 'Stock') {
            transactionData.transactionPrice = parseFloat(document.getElementById('stock-price').value);
            transactionData.fees = parseFloat(document.getElementById('stock-fees').value);
        } else {
            transactionData.strikePrice = parseFloat(document.getElementById('option-strike').value);
            transactionData.premium = parseFloat(document.getElementById('option-premium').value);
            transactionData.underlyingAssetPrice = parseFloat(document.getElementById('option-underlying').value) || transactionData.strikePrice;
            transactionData.expiryDate = optionExpiryInput.value;
            transactionData.fees = parseFloat(document.getElementById('option-fees').value);
        }
        addOrUpdateTransaction(transactionData);
        addTransactionModal.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        setEditingTransactionId(null);
        transactionForm.reset();
        transactionDateInput.value = today;
        optionExpiryInput.value = getThirdFridayOfNextMonth();
        submitBtn.textContent = 'Add Transaction';
        cancelBtn.classList.add('hidden');
        addTransactionModal.classList.add('hidden');
        addTransactionModal.classList.remove('flex');
    });

    document.getElementById('transaction-list').addEventListener('click', (e) => {
        const target = e.target;
        const transactionItem = target.closest('[data-id]');

        if (!transactionItem) return;

        const id = transactionItem.dataset.id;
        const actionButton = target.closest('[data-action]');
        const action = actionButton ? actionButton.dataset.action : null;
        const tooltipIcon = target.closest('.tooltip-icon');

        if (action === 'toggle-details') {
            const details = document.getElementById(`details-${id}`);
            const chevron = actionButton.querySelector('svg');

            const currentExpanded = document.querySelector('.collapsible-content.expanded');
            if (currentExpanded && currentExpanded.id !== `details-${id}`) {
                currentExpanded.classList.remove('expanded');
                const otherChevron = currentExpanded.closest('.bg-neutral-card').querySelector('[data-action="toggle-details"] svg');
                if (otherChevron) otherChevron.style.transform = 'rotate(0deg)';
            }
            
            if (details.classList.contains('expanded')) {
                details.classList.remove('expanded');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            } else {
                details.classList.add('expanded');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
                const transaction = getTransactionById(id);
                if (transaction) {
                    simulateAndDrawTransactionPnlChart(transaction, `chart-${id}`);
                }
            }
        } else if (target.classList.contains('edit-btn')) {
            const transaction = getTransactionById(id);
            if (!transaction) {
                showMessageBox('Transaction not found. Please try again.');
                return;
            }
            setEditingTransactionId(id);
            transactionModalTitle.textContent = 'Edit Transaction';
            submitBtn.textContent = 'Save Changes';
            cancelBtn.classList.remove('hidden');
            document.getElementById('asset-type').value = transaction.assetType;
            document.getElementById('action').value = transaction.action;
            document.getElementById('symbol').value = transaction.symbol;
            nameInput.value = transaction.name || '';
            document.getElementById('quantity').value = transaction.quantity;
            transactionDateInput.value = transaction.transactionDate;
            currencySelect.value = transaction.currency;
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
            toggleFields(assetTypeSelect, stockFields, optionFields);
            addTransactionModal.classList.remove('hidden');
        } else if (target.classList.contains('delete-btn')) {
            confirmDeleteBtn.dataset.id = id;
            deleteModal.classList.remove('hidden');
        } else if (target.classList.contains('strategy-btn')) {
            const transaction = getTransactionById(id);
            if (transaction) {
                strategySimulationModal.classList.remove('hidden');
                strategySimulationModal.classList.add('flex');
                const symbol = transaction.symbol;
                strategySymbolSelect.value = symbol;
                updateStrategyPriceForSymbol(symbol);
                runStrategySimulation();
            } else {
                showMessageBox('Transaction not found. Please try again.');
            }
        } else if (tooltipIcon) {
            const tooltipContainer = tooltipIcon.closest('.tooltip-container');
            const otherOpenTooltips = document.querySelectorAll('.tooltip-container.show');
            otherOpenTooltips.forEach(tooltip => {
                if (tooltip !== tooltipContainer) {
                    tooltip.classList.remove('show');
                }
            });
            tooltipContainer.classList.toggle('show');
            e.stopPropagation();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tooltip-container')) {
            const openTooltips = document.querySelectorAll('.tooltip-container.show');
            openTooltips.forEach(tooltip => {
                tooltip.classList.remove('show');
            });
        }
    });

    confirmDeleteBtn.addEventListener('click', () => {
        const id = confirmDeleteBtn.dataset.id;
        deleteTransaction(id);
        deleteModal.classList.add('hidden');
        showToast('Transaction deleted successfully!');
    });

    cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));
    closePnlModalBtn.addEventListener('click', () => pnlSimulationModal.classList.add('hidden'));
    closeStrategyModalBtn.addEventListener('click', () => strategySimulationModal.classList.add('hidden'));


    if (strategySymbolSelect) {
        strategySymbolSelect.addEventListener('change', () => {
            const symbol = strategySymbolSelect.value;
            updateStrategyPriceForSymbol(symbol);
            runStrategySimulation();
        });
    }

    if (strategyPriceInput) {
        strategyPriceInput.addEventListener('input', runStrategySimulation);
    }
    
    if (document.getElementById('zoom-in-pnl-btn')) {
        document.getElementById('zoom-in-pnl-btn').addEventListener('click', () => {
            const pnlCanvas = document.querySelector('#pnl-simulation-modal canvas');
            if (pnlCanvas) {
                zoomChart(pnlCanvas.id, 0.9);
            }
        });
    }

    if (document.getElementById('zoom-out-pnl-btn')) {
        document.getElementById('zoom-out-pnl-btn').addEventListener('click', () => {
            const pnlCanvas = document.querySelector('#pnl-simulation-modal canvas');
            if (pnlCanvas) {
                zoomChart(pnlCanvas.id, 1.1);
            }
        });
    }

    if (analyzeStrategyBtn) {
        analyzeStrategyBtn.addEventListener('click', async () => {
            const symbol = strategySymbolSelect.value;
            if (!symbol) {
                showMessageBox('Please select a symbol to analyze a strategy.');
                return;
            }
            analysisResultDiv.innerHTML = '';
            analysisStatusP.textContent = 'Analyzing your strategy...';
            analyzeStrategyBtn.disabled = true;
            const analysis = await analyzeStrategyWithGemini(symbol);
            analysisResultDiv.innerHTML = analysis.replace(/\n/g, '<br>');
            analysisStatusP.textContent = 'Analysis complete.';
            analyzeStrategyBtn.disabled = false;
        });
    }

    document.getElementById('export-btn').addEventListener('click', () => {
        exportTransactions();
        showToast('Transactions exported successfully!');
    });

    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (Array.isArray(imported)) {
                    importTransactions(imported);
                    showMessageBox('Transactions imported successfully!');
                } else {
                    showMessageBox('Invalid JSON file format. Please import a file containing an array of transactions.');
                }
            } catch (error) {
                showMessageBox('Error parsing JSON file. Please ensure the file is valid.');
            }
        };
        reader.readAsText(file);
    });

    assetTypeSelect.addEventListener('change', () => toggleFields(assetTypeSelect, stockFields, optionFields));
    currencySelect.addEventListener('change', () => setDefaultFees(assetTypeSelect, currencySelect, stockFeesInput, optionFeesInput));

    document.getElementById('close-discovery-card').addEventListener('click', () => {
        discoveryCardModal.classList.add('hidden');
        renderSelectedSymbols();
    });

     // --- Theme Switching Logic ---
    const themeGearButton = document.getElementById('theme-gear-button');
    const themeModal = document.getElementById('theme-modal');
    const closeThemeModal = document.getElementById('close-theme-modal');
    const themeSelectBtns = document.querySelectorAll('.theme-select-btn');

    const applyTheme = (theme) => {
        document.body.className = '';
        if (theme !== 'standard') {
            document.body.classList.add(theme + '-theme');
        }
        localStorage.setItem('selectedTheme', theme);
    };

    themeGearButton.addEventListener('click', () => {
        themeModal.classList.remove('hidden');
        themeModal.classList.add('flex');
    });
    closeThemeModal.addEventListener('click', () => themeModal.classList.add('hidden'));
    themeSelectBtns.forEach(btn => btn.addEventListener('click', (e) => {
        applyTheme(e.target.dataset.theme);
        themeModal.classList.add('hidden');
    }));

    const savedTheme = localStorage.getItem('selectedTheme') || 'standard';
    applyTheme(savedTheme);

});