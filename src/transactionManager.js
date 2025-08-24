import { calculateTransactionMetrics, calculateStockPNL, calculateOptionPNL } from './metrics.js';
import { saveTransactions, getTransactions } from './storage.js';
import { showToast, showMessageBox, getForexRates } from './ui.js';
import { getApiKeys } from './apiManager.js';

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
            t.name = name;
        }
    });
};

export const setEditingTransactionId = (id) => {
    editingTransactionId = id;
};

export const renderTransactionList = async () => {
    transactionListDiv.innerHTML = '';
    const transactionCounts = {};

    // This loop populates the transactionCounts object
    transactions.forEach(t => {
        transactionCounts[t.symbol] = (transactionCounts[t.symbol] || 0) + 1;
    });

    const forexRates = await getForexRates();

    let totalInvestedCashEUR = 0;
    let totalPremiumIncomeEUR = 0;
    let totalRiskExposureEUR = 0;

    let totalStocksInvestedCashEUR = 0;
    let totalStocksPremiumIncomeEUR = 0;
    let totalStocksRiskExposureEUR = 0;

    let totalOptionsInvestedCashEUR = 0;
    let totalOptionsPremiumIncomeEUR = 0;
    let totalOptionsRiskExposureEUR = 0;

    const stockTransactions = transactions.filter(t => t.assetType === 'Stock');
    const optionTransactions = transactions.filter(t => t.assetType !== 'Stock');

    const optionSymbols = [...new Set(optionTransactions.map(t => t.symbol))];
    const stockSymbols = [...new Set(stockTransactions.map(t => t.symbol))];

    // Calculate metrics for stocks
    for (const t of stockTransactions) {
        const metrics = calculateTransactionMetrics(t);
        let investedInEUR = metrics.investedAmount;
        let riskInEUR = metrics.riskExposure;

        if (t.currency === 'USD' && forexRates && forexRates.EURUSD) {
            investedInEUR = metrics.investedAmount / forexRates.EURUSD;
            riskInEUR = metrics.riskExposure === -Infinity ? -Infinity : metrics.riskExposure / forexRates.EURUSD;
        } else if (t.currency === 'CHF' && forexRates && forexRates.EURCHF) {
            investedInEUR = metrics.investedAmount / forexRates.EURCHF;
            riskInEUR = metrics.riskExposure === -Infinity ? -Infinity : metrics.riskExposure / forexRates.EURCHF;
        }

        totalStocksInvestedCashEUR += investedInEUR;
        totalStocksRiskExposureEUR += riskInEUR;
    }
    
    // Calculate metrics for options
    for (const symbol of optionSymbols) {
        const symbolTransactions = optionTransactions.filter(t => t.symbol === symbol);
        
        let localInvestedCash = 0;
        let localPremiumIncome = 0;
        let localRiskExposure = 0;
        let currency = 'EUR';
        
        if (symbolTransactions.length > 0) {
            currency = symbolTransactions[0].currency;
        }
        
        symbolTransactions.forEach(t => {
            const metrics = calculateTransactionMetrics(t);
            localInvestedCash += metrics.investedAmount;
            localPremiumIncome += metrics.premiumIncome;
        });

        // Simulating combined P&L for risk assessment for options
        const relevantPrice = symbolTransactions.some(t => t.underlyingAssetPrice) ? symbolTransactions.find(t => t.underlyingAssetPrice).underlyingAssetPrice : symbolTransactions[0].strikePrice;
        const priceRange = 50; 
        const numDataPoints = 201;
        const priceStep = (relevantPrice * 2 * priceRange / 100) / (numDataPoints - 1);
        const minPrice = relevantPrice - (relevantPrice * priceRange / 100);

        let maxLossForSymbol = 0;
        for (let i = 0; i < numDataPoints; i++) {
            const simulatedPrice = minPrice + (i * priceStep);
            let totalPnl = 0;
            symbolTransactions.forEach(t => {
                totalPnl += calculateOptionPNL(simulatedPrice, t);
            });
            if (totalPnl < maxLossForSymbol) {
                maxLossForSymbol = totalPnl;
            }
        }
        localRiskExposure = maxLossForSymbol;
        
        let investedInEUR = localInvestedCash;
        let premiumInEUR = localPremiumIncome;
        let riskInEUR = localRiskExposure;

        if (currency === 'USD' && forexRates && forexRates.EURUSD) {
            investedInEUR = localInvestedCash / forexRates.EURUSD;
            premiumInEUR = localPremiumIncome / forexRates.EURUSD;
            riskInEUR = localRiskExposure === -Infinity ? -Infinity : localRiskExposure / forexRates.EURUSD;
        } else if (currency === 'CHF' && forexRates && forexRates.EURCHF) {
            investedInEUR = localInvestedCash / forexRates.EURCHF;
            premiumInEUR = localPremiumIncome / forexRates.EURCHF;
            riskInEUR = localRiskExposure === -Infinity ? -Infinity : localRiskExposure / forexRates.EURCHF;
        }
        
        totalOptionsInvestedCashEUR += investedInEUR;
        totalOptionsPremiumIncomeEUR += premiumInEUR;
        totalOptionsRiskExposureEUR += riskInEUR;
    }
    
    // Summing up final totals from sub-categories
    totalInvestedCashEUR = totalStocksInvestedCashEUR + totalOptionsInvestedCashEUR;
    totalPremiumIncomeEUR = totalStocksPremiumIncomeEUR + totalOptionsPremiumIncomeEUR;
    totalRiskExposureEUR = totalStocksRiskExposureEUR + totalOptionsRiskExposureEUR;
    
    const totalPortfolioValue = totalInvestedCashEUR + totalPremiumIncomeEUR;
    
    let totalRiskRewardRatio = (totalPremiumIncomeEUR - totalInvestedCashEUR) / Math.abs(totalRiskExposureEUR);
    let riskRewardClass = 'text-neutral-text';
    if (totalRiskExposureEUR < 0 && totalPremiumIncomeEUR - totalInvestedCashEUR > 0) {
        riskRewardClass = totalRiskRewardRatio > 1 ? 'text-logo-green' : 'text-logo-red';
    } else {
        totalRiskRewardRatio = null;
        riskRewardClass = 'text-neutral-text';
    }

    if (totalPortfolioValue > 0) {
        document.getElementById('portfolio-summary-card').classList.remove('hidden');

        document.getElementById('total-invested-cash').textContent = `${totalInvestedCashEUR.toFixed(2)} €`;
        document.getElementById('total-premium-income').textContent = `${totalPremiumIncomeEUR.toFixed(2)} €`;
        document.getElementById('total-risk-exposure').textContent = `${totalRiskExposureEUR === -Infinity ? '∞' : totalRiskExposureEUR.toFixed(2)} €`;
        
        document.getElementById('total-risk-reward-ratio').textContent = totalRiskRewardRatio !== null ? totalRiskRewardRatio.toFixed(2) : '--';
        document.getElementById('total-risk-reward-ratio').className = `block text-2xl font-bold mt-1 ${riskRewardClass}`;

        document.getElementById('total-premium-income').className = `block text-2xl font-bold mt-1 ${totalPremiumIncomeEUR > 0 ? 'text-logo-green' : 'text-logo-red'}`;
        document.getElementById('total-risk-exposure').className = `block text-2xl font-bold mt-1 ${totalRiskExposureEUR === -Infinity || totalRiskExposureEUR < 0 ? 'text-logo-red' : 'text-neutral-text'}`;

        document.getElementById('stocks-invested-cash').textContent = `${totalStocksInvestedCashEUR.toFixed(2)} €`;
        document.getElementById('stocks-premium-income').textContent = `${totalStocksPremiumIncomeEUR.toFixed(2)} €`;
        document.getElementById('stocks-risk-exposure').textContent = `${totalStocksRiskExposureEUR === -Infinity ? '∞' : totalStocksRiskExposureEUR.toFixed(2)} €`;
        
        document.getElementById('stocks-premium-income').className = `block font-bold text-neutral-text`;
        document.getElementById('stocks-risk-exposure').className = `block font-bold ${totalStocksRiskExposureEUR === -Infinity || totalStocksRiskExposureEUR < 0 ? 'text-logo-red' : 'text-neutral-text'}`;

        document.getElementById('options-invested-cash').textContent = `${totalOptionsInvestedCashEUR.toFixed(2)} €`;
        document.getElementById('options-premium-income').textContent = `${totalOptionsPremiumIncomeEUR.toFixed(2)} €`;
        document.getElementById('options-risk-exposure').textContent = `${totalOptionsRiskExposureEUR === -Infinity ? '∞' : totalOptionsRiskExposureEUR.toFixed(2)} €`;
        
        document.getElementById('options-premium-income').className = `block font-bold ${totalOptionsPremiumIncomeEUR > 0 ? 'text-logo-green' : 'text-logo-red'}`;
        document.getElementById('options-risk-exposure').className = `block font-bold ${totalOptionsRiskExposureEUR === -Infinity || totalOptionsRiskExposureEUR < 0 ? 'text-logo-red' : 'text-neutral-text'}`;
    } else {
        document.getElementById('portfolio-summary-card').classList.add('hidden');
    }

    transactions.forEach(t => {
        const metrics = calculateTransactionMetrics(t);
        let investedInEUR = 0;
        let premiumInEUR = 0;
        let riskInEUR = 0;

        if (t.currency === 'USD' && forexRates && forexRates.EURUSD) {
            investedInEUR = metrics.investedAmount / forexRates.EURUSD;
            premiumInEUR = metrics.premiumIncome / forexRates.EURUSD;
            riskInEUR = metrics.riskExposure === -Infinity ? -Infinity : metrics.riskExposure / forexRates.EURUSD;
        } else if (t.currency === 'CHF' && forexRates && forexRates.EURCHF) {
            investedInEUR = metrics.investedAmount / forexRates.EURCHF;
            premiumInEUR = metrics.premiumIncome / forexRates.EURCHF;
            riskInEUR = metrics.riskExposure === -Infinity ? -Infinity : metrics.riskExposure / forexRates.EURCHF;
        } else {
            investedInEUR = metrics.investedAmount;
            premiumInEUR = metrics.premiumIncome;
            riskInEUR = metrics.riskExposure;
        }

        let portfolioShare = 0;
        if (totalPortfolioValue > 0) {
             if (t.action === 'Buy' || t.assetType === 'Stock') {
                portfolioShare = (investedInEUR / totalPortfolioValue) * 100;
            } else {
                portfolioShare = (Math.abs(riskInEUR) / totalPortfolioValue) * 100;
            }
        }
        
        let assetTypeClass = '';
        if (t.assetType === 'Stock') {
            assetTypeClass = 'text-logo-blue bg-blue-100';
        } else if (t.assetType === 'Call Option') {
            assetTypeClass = 'text-logo-green bg-green-100';
        } else {
            assetTypeClass = 'text-logo-red bg-red-100';
        }

        const investedClass = metrics.investedAmount > 0 ? 'text-neutral-text' : 'text-neutral-text';
        const premiumClass = metrics.premiumIncome > 0 ? 'text-logo-green' : 'text-logo-red';
        const riskClass = metrics.riskExposure === -Infinity || metrics.riskExposure < 0 ? 'text-logo-red' : 'text-neutral-text';

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
                        <span class="ml-2 text-sm font-semibold text-gray-700">| ${portfolioShare.toFixed(2)}%</span>
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
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Invested Amount</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="invested-amount">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="invested-amount-tooltip" class="tooltip-text">
                                        This is the total amount of cash spent to open a position, including all trading fees.
                                    </span>
                                </span>
                            </div>
                            <span class="font-bold text-base ${investedClass}">${metrics.investedAmount.toFixed(2)} ${t.currency}</span>
                        </div>
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Premium Income</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="premium-income">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="premium-income-tooltip" class="tooltip-text">
                                        The total cash received from selling an option contract, minus all trading fees.
                                    </span>
                                </span>
                            </div>
                            <span class="font-bold text-base ${premiumClass}">${metrics.premiumIncome.toFixed(2)} ${t.currency}</span>
                        </div>
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Potential Loss</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="potential-loss">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="potential-loss-tooltip" class="tooltip-text">
                                        The maximum possible loss for a single position. For some positions, this can be unlimited.
                                    </span>
                                </span>
                            </div>
                            <span class="font-bold text-base ${riskClass}">${metrics.riskExposure === -Infinity ? '∞' : metrics.riskExposure.toFixed(2) + ' ' + t.currency}</span>
                        </div>
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Breakeven</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="breakeven">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="breakeven-tooltip" class="tooltip-text">
                                        The price point at which a position begins to become profitable, including all fees.
                                    </span>
                                </span>
                            </div>
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