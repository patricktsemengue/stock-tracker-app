import { calculateTransactionMetrics } from './metrics.js';
import { saveTransactions, getTransactions } from './storage.js';
import { showToast } from './ui.js';

let transactions = getTransactions();
let editingTransactionId = null;

const transactionListDiv = document.getElementById('transaction-list');
const transactionModalTitle = document.getElementById('transaction-modal-title');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');

export const getTransactionById = (id) => {
    return transactions.find(t => t.id == id);
};

export const deleteTransaction = (id) => {
    transactions = transactions.filter(t => t.id != id);
    saveTransactions(transactions);
    renderTransactionList();
};

export const updateTransactionNamesBySymbol = (symbol, name) => {
    if (!name || name.trim() === '') {
        return;
    }
    transactions.forEach(t => {
        if (t.symbol === symbol) {
        //if (t.symbol === symbol && (!t.name || t.name.trim() === '')) {
            t.name = name;
        }
    });
};

export const setEditingTransactionId = (id) => {
    editingTransactionId = id;
};

export const renderTransactionList = () => {
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

        let priceInfo = '';
        if (t.assetType === 'Stock') {
            priceInfo = `Price: ${t.transactionPrice} ${t.currency}`;
        } else {
            priceInfo = `Strike: ${t.strikePrice} ${t.currency} | Prem: ${t.premium} ${t.currency}`;
        }

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

    const strategyBtnContainer = document.getElementById('strategy-btn-container');
    const strategySymbolSelect = document.getElementById('strategy-symbol');
    const symbolsWithMultiple = Object.keys(transactionCounts).filter(s => transactionCounts[s] >= 2);
    if (symbolsWithMultiple.length > 0) {
        strategyBtnContainer.classList.remove('hidden');
        strategySymbolSelect.innerHTML = symbolsWithMultiple.map(s => `<option value="${s}">${s}</option>`).join('');
    } else {
        strategyBtnContainer.classList.add('hidden');
    }
};

export const getTransactionsForSymbol = (symbol) => {
    return transactions.filter(t => t.symbol === symbol);
};

export const addOrUpdateTransaction = (transactionData) => {
    if (editingTransactionId) {
        const index = transactions.findIndex(t => t.id == editingTransactionId);
        if (index !== -1) {
            transactionData.id = editingTransactionId;
            transactions[index] = transactionData;
        }
        showToast('Transaction updated successfully!');
    } else {
        transactionData.id = Date.now();
        transactions.push(transactionData);
        showToast('Transaction added successfully!');
    }
    updateTransactionNamesBySymbol(transactionData.symbol, transactionData.name);
    saveTransactions(transactions);
    editingTransactionId = null;
    renderTransactionList();
};

export const importTransactions = (importedTransactions) => {
    importedTransactions.forEach(importedTransaction => {
        const existingIndex = transactions.findIndex(t => t.id == importedTransaction.id);
        if (existingIndex !== -1) {
            transactions[existingIndex] = importedTransaction;
        } else {
            transactions.push(importedTransaction);
        }
    });
    saveTransactions(transactions);
    renderTransactionList();
};

export const exportTransactions = () => {
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
};

export const clearAllData = () => {
    localStorage.clear();
    transactions = [];
    renderTransactionList();
};