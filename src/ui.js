import { addOrUpdateTransaction, getTransactionById, setEditingTransactionId, renderTransactionList, exportTransactions, importTransactions, clearAllData, deleteTransaction } from './transactionManager.js';
import { simulateAndDrawPnlChart, runStrategySimulation, updateStrategyPriceForSymbol, zoomChart } from './simulator.js';
import { searchSymbol, lookupSymbol, addSelectedSymbol, removeSelectedSymbol, renderSelectedSymbols } from './searchAndSelect.js';
import { saveApiKeys, initializeAppConfig, analyzeStrategyWithGemini, getApiKeys , fetchFinnhubQuote } from './apiManager.js';
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

    if (cachedData.date === today) {
        return cachedData.rates;
    }

    const fmpApiKey = getApiKeys().fmpApiKey;
    if (!fmpApiKey) {
        console.error('FMP API Key is not set. Cannot fetch forex rates.');
        return null;
    }

    const conversions = {
        'EURUSD': 'EURUSD',
        'EURCHF': 'EURCHF'
    };
    const rates = {};
    const symbols = Object.keys(conversions);
    const url = `https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${fmpApiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }
        const data = await response.json();
        data.forEach(item => {
            rates[item.symbol] = item.price;
        });
        saveForexRates(rates);
        return rates;
    } catch (error) {
        console.error('Error fetching forex rates:', error);
        return null;
    }
};

// --- Discovery Card Logic ---
const discoveryCardModal = document.getElementById('discovery-card-modal');
const discoveryCardContent = document.getElementById('discovery-card-content');
let activeQuoteData = null; 

const renderDiscoveryCardContent = (symbol, name, quote) => {
    const changeColor = quote.change >= 0 ? 'text-logo-green' : 'text-logo-red';
    return `
        <div class="border-b pb-4">
            <div class="flex justify-between items-center">
                <div><h2 class="text-3xl font-bold text-gray-800">${symbol}</h2><p class="text-gray-500">${name}</p></div>
                <div class="text-right"><p class="text-3xl font-bold text-logo-primary">$${quote.current.toFixed(2)}</p><p class="text-sm font-semibold ${changeColor}">${quote.change.toFixed(2)} (${quote.percent_change.toFixed(2)}%)</p></div>
            </div>
            <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-center">
                <div><p class="text-gray-400">Open</p><p class="font-semibold text-gray-700">$${quote.open.toFixed(2)}</p></div>
                <div><p class="text-gray-400">High</p><p class="font-semibold text-gray-700">$${quote.high.toFixed(2)}</p></div>
                <div><p class="text-gray-400">Low</p><p class="font-semibold text-gray-700">$${quote.low.toFixed(2)}</p></div>
                <div><p class="text-gray-400">Prev. Close</p><p class="font-semibold text-gray-700">$${quote.previous_close.toFixed(2)}</p></div>
            </div>
        </div>
        <div class="relative">
            <div id="discovery-carousel-wrapper"></div>
            <button id="discovery-prevBtn" class="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-8 bg-gray-200 p-2 rounded-full hover:bg-gray-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
            <button id="discovery-nextBtn" class="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-8 bg-gray-200 p-2 rounded-full hover:bg-gray-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></button>
        </div>
    `;
};



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
                    const yZero = (zero - chartArea.top) / (chartArea.bottom - chartArea.top);
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
    const strikePrice = activeQuoteData.current;
    const canvasId = slide.querySelector('canvas').id;

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
    
    let cashImpact = 0, potentialLoss = 'N/A', breakEven = 'N/A';
    
    if (type === 'Buy Stock') {
        const transactionPrice = parseFloat(slide.querySelector('.transaction-price-input').value) || price;
        cashImpact = -(transactionPrice * quantity);
        potentialLoss = transactionPrice * quantity;
        breakEven = transactionPrice;
    } else if (type === 'Sell Call') {
        const premium = parseFloat(slide.querySelector('.premium-input').value) || price * 0.05;
        cashImpact = premium * 100 * quantity;
        potentialLoss = 'Unlimited';
        breakEven = price + premium;
    } else if (type === 'Sell Put') {
        const premium = parseFloat(slide.querySelector('.premium-input').value) || price * 0.05;
        cashImpact = premium * 100 * quantity;
        potentialLoss = (price - premium) * 100 * quantity;
        breakEven = price - premium;
    }

    const cashMetric = slide.querySelector('.metric-cash');
    const lossMetric = slide.querySelector('.metric-loss');
    
    cashMetric.textContent = `${cashImpact >= 0 ? '+' : ''}${cashImpact.toFixed(2)}`;
    cashMetric.classList.toggle('text-logo-green', cashImpact >= 0);
    cashMetric.classList.toggle('text-logo-red', cashImpact < 0);

    lossMetric.textContent = typeof potentialLoss === 'string' ? potentialLoss : potentialLoss.toFixed(2);
    lossMetric.classList.toggle('text-logo-red', potentialLoss === 'Unlimited' || potentialLoss > 0);

    slide.querySelector('.metric-breakeven').textContent = typeof breakEven === 'string' ? breakEven : breakEven.toFixed(2);
    
    updatePnlChart(slide);
};

export const showDiscoveryCard = async (symbol, name) => {
    discoveryCardModal.classList.remove('hidden');
    discoveryCardModal.classList.add('flex');

    const cachedSymbol = getRecentlySearched().find(s => s.symbol === symbol);

    if (cachedSymbol && cachedSymbol.price) {
        const tempQuote = { current: cachedSymbol.price, change: 0, percent_change: 0, open: 0, high: 0, low: 0, previous_close: 0 };
        discoveryCardContent.innerHTML = renderDiscoveryCardContent(symbol, name, tempQuote);
    } else {
        discoveryCardContent.innerHTML = `<p class="text-center">Fetching real-time data for ${symbol}...</p>`;
    }

    const quote = await fetchFinnhubQuote(symbol);
    if (!quote) {
        if (!cachedSymbol) {
            discoveryCardContent.innerHTML = `<p class="text-center text-logo-red">Could not fetch data for ${symbol}. Please check your API key or the symbol.</p>`;
        }
        return;
    }
    
    activeQuoteData = quote;
    saveRecentlySearched(symbol, name, quote.current);
    discoveryCardContent.innerHTML = renderDiscoveryCardContent(symbol, name, quote);

    const carouselWrapper = document.getElementById('discovery-carousel-wrapper');
    const slidesData = [
        { type: 'Buy Stock', color: 'text-logo-blue', chartId: 'pnlChartStock' },
        { type: 'Sell Call', color: 'text-logo-green', chartId: 'pnlChartCall' },
        { type: 'Sell Put', color: 'text-logo-red', chartId: 'pnlChartPut' }
    ];

    slidesData.forEach(slideData => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.dataset.type = slideData.type;

        let editableField = '';
        if (slideData.type === 'Buy Stock') {
            editableField = `<div><label class="block text-sm font-medium text-gray-600 mb-1">Transaction Price</label><input type="number" class="w-full p-2 border border-gray-300 rounded-md transaction-price-input" value="${activeQuoteData.current.toFixed(2)}"></div>`;
        } else {
            editableField = `<div><label class="block text-sm font-medium text-gray-600 mb-1">Premium</label><input type="number" class="w-full p-2 border border-gray-300 rounded-md premium-input" value="${(activeQuoteData.current * 0.05).toFixed(2)}"></div>`;
        }

        slide.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-xl font-bold text-center ${slideData.color}">${slideData.type}</h3>
                <div><label class="block text-sm font-medium text-gray-600 mb-1">Quantity</label><input type="number" class="w-full p-2 border border-gray-300 rounded-md quantity-input" value="100"></div>
                ${editableField}
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div><p class="text-xs text-gray-500">Cash Impact</p><p class="font-bold text-base metric-cash">--</p></div>
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
        if (e.target.classList.contains('quantity-input') || e.target.classList.contains('transaction-price-input') || e.target.classList.contains('premium-input')) {
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
                document.getElementById('option-strike').value = activeQuoteData.current.toFixed(2);
            }

            discoveryCardModal.classList.add('hidden');
        }
    });

    showSlide(0);
};


// --- Event Listeners and DOM Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
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
            const price = resultDiv.dataset.price;
            addSelectedSymbol(symbol, name, price ? parseFloat(price) : null);
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
            transactionSymbolInput.value = resultDiv.dataset.symbol;
            transactionNameInput.value = resultDiv.dataset.name;
            addSelectedSymbol(resultDiv.dataset.symbol, resultDiv.dataset.name, resultDiv.dataset.price ? parseFloat(resultDiv.dataset.price) : null);
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
        } else if (target.classList.contains('simulate-btn')) {
            const transaction = getTransactionById(id);
            if (transaction) {
                simulateAndDrawPnlChart(transaction);
                pnlSimulationModal.classList.remove('hidden');
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

    if (document.getElementById('strategy-btn')) {
        document.getElementById('strategy-btn').addEventListener('click', () => {
            strategySimulationModal.classList.remove('hidden');
            const symbol = strategySymbolSelect.value;
            if (symbol) {
                updateStrategyPriceForSymbol(symbol);
                runStrategySimulation();
            }
        });
    }

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

});