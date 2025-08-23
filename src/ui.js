import { addOrUpdateTransaction, getTransactionById, setEditingTransactionId, renderTransactionList, exportTransactions, importTransactions, clearAllData } from './transactionManager.js';
import { simulateAndDrawPnlChart, runStrategySimulation, updateStrategyPriceForSymbol, zoomChart } from './simulator.js';
import { searchSymbol, lookupSymbol, addSelectedSymbol, removeSelectedSymbol, renderSelectedSymbols } from './searchAndSelect.js';
import { saveApiKeys, initializeApiKeys, analyzeStrategyWithGemini } from './apiManager.js';

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

// --- Event Listeners and DOM Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements must be selected here to ensure the DOM is ready
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

    initializeApiKeys();
    toggleFields(assetTypeSelect, stockFields, optionFields);
    renderTransactionList();

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
            addSelectedSymbol(symbol, name);
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
            transactionSymbolInput.value = symbol;
            transactionNameInput.value = name;
            addTransactionFab.click();
        }
    });

    transactionSymbolInput.addEventListener('keyup', (e) => lookupSymbol(e.target.value.trim()));

    transactionSymbolSearchResults.addEventListener('click', (e) => {
        const resultDiv = e.target.closest('div[data-symbol]');
        if (resultDiv) {
            transactionSymbolInput.value = resultDiv.dataset.symbol;
            transactionNameInput.value = resultDiv.dataset.name;
            transactionSymbolSearchResults.innerHTML = '';
        }
    });

    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const assetType = assetTypeSelect.value;
        const transactionData = {
            id: null, // This ID is set by the transaction manager
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

    if (document.getElementById('zoom-in-strategy-btn')) {
        document.getElementById('zoom-in-strategy-btn').addEventListener('click', () => {
            zoomChart('strategy-chart', 0.9);
        });
    }

    if (document.getElementById('zoom-out-strategy-btn')) {
        document.getElementById('zoom-out-strategy-btn').addEventListener('click', () => {
            zoomChart('strategy-chart', 1.1);
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
});