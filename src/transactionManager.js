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

// Function to generate a random hex color
const randomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
};

export const renderTransactionList = async () => {
    transactionListDiv.innerHTML = '';
    const transactionCounts = {};
    const symbolColors = {};

    transactions.forEach(t => {
        transactionCounts[t.symbol] = (transactionCounts[t.symbol] || 0) + 1;
        if (!symbolColors[t.symbol]) {
            symbolColors[t.symbol] = randomColor();
        }
    });

    const forexRates = await getForexRates();

    let totalInvestedCashEUR = 0;
    let totalPremiumIncomeEUR = 0;
    let totalRiskExposureEUR = 0;
    let totalSoldStocksIncomeEUR = 0;

    let totalStocksInvestedAmount = 0;
    let totalStocksRealizedIncome = 0;
    let totalStocksPotentialLoss = 0;

    let totalOptionsBoughtInvestedAmount = 0;
    let totalOptionsBoughtPotentialLoss = 0;
    let totalOptionsSoldPremiumIncome = 0;
    let totalOptionsSoldPotentialLoss = 0;

    const allSymbols = [...new Set(transactions.map(t => t.symbol))];

    for (const symbol of allSymbols) {
        const symbolTransactions = transactions.filter(t => t.symbol === symbol);
        let localRiskExposure = 0;
        let currency = 'EUR';

        if (symbolTransactions.length > 0) {
            currency = symbolTransactions[0].currency;
        }

        let localMaxLossForSymbol = 0;

        const referenceTransaction = symbolTransactions.find(t => t.assetType === 'Stock') || symbolTransactions[0];
        const relevantPrice = referenceTransaction.assetType === 'Stock' ? referenceTransaction.transactionPrice : referenceTransaction.strikePrice;
        const priceRange = 50;
        const numDataPoints = 201;
        const minPrice = Math.max(0, relevantPrice - (relevantPrice * priceRange / 100));
        const maxPrice = relevantPrice + (relevantPrice * priceRange / 100);
        const priceStep = (maxPrice - minPrice) / (numDataPoints - 1);

        for (let i = 0; i < numDataPoints; i++) {
            const simulatedPrice = minPrice + (i * priceStep);
            let totalPnl = 0;
            symbolTransactions.forEach(t => {
                if (t.assetType === 'Stock') {
                    totalPnl += calculateStockPNL(simulatedPrice, t);
                } else {
                    totalPnl += calculateOptionPNL(simulatedPrice, t);
                }
            });
            if (totalPnl < localMaxLossForSymbol) {
                localMaxLossForSymbol = totalPnl;
            }
        }
        localRiskExposure = localMaxLossForSymbol;

        symbolTransactions.forEach(t => {
            const metrics = calculateTransactionMetrics(t);
            let convertedInvested = metrics.investedAmount;
            let convertedPremium = metrics.premiumIncome;
            let convertedRealized = metrics.realizedIncome;

            if (currency === 'USD' && forexRates && forexRates.EURUSD) {
                convertedInvested /= forexRates.EURUSD;
                convertedPremium /= forexRates.EURUSD;
                convertedRealized /= forexRates.EURUSD;
            } else if (currency === 'CHF' && forexRates && forexRates.EURCHF) {
                convertedInvested /= forexRates.EURCHF;
                convertedPremium /= forexRates.EURCHF;
                convertedRealized /= forexRates.EURCHF;
            }

            if (t.assetType === 'Stock') {
                if (t.action === 'Buy') {
                    totalStocksInvestedAmount += convertedInvested;
                    totalStocksPotentialLoss += metrics.riskExposure;
                } else {
                    totalStocksRealizedIncome += convertedRealized;
                }
            } else {
                if (t.action === 'Buy') {
                    totalOptionsBoughtInvestedAmount += convertedInvested;
                    totalOptionsBoughtPotentialLoss += metrics.riskExposure;
                } else {
                    totalOptionsSoldPremiumIncome += convertedPremium;
                    if (metrics.riskExposure === -Infinity) {
                        totalOptionsSoldPotentialLoss = -Infinity;
                    } else if (totalOptionsSoldPotentialLoss !== -Infinity) {
                        totalOptionsSoldPotentialLoss += metrics.riskExposure;
                    }
                }
            }
        });
        
        let convertedRisk = localRiskExposure;
        if (currency === 'USD' && forexRates && forexRates.EURUSD) {
            convertedRisk /= forexRates.EURUSD;
        } else if (currency === 'CHF' && forexRates && forexRates.EURCHF) {
            convertedRisk /= forexRates.EURCHF;
        }
        totalRiskExposureEUR += convertedRisk;

    }

    totalInvestedCashEUR = totalStocksInvestedAmount + totalOptionsBoughtInvestedAmount;
    totalPremiumIncomeEUR = totalOptionsSoldPremiumIncome;
    totalSoldStocksIncomeEUR = totalStocksRealizedIncome;

    const totalPortfolioExposure = Math.abs(totalStocksPotentialLoss) + Math.abs(totalOptionsBoughtPotentialLoss) + Math.abs(totalOptionsSoldPotentialLoss === -Infinity ? 0 : totalOptionsSoldPotentialLoss);
    
    const stocksShare = totalPortfolioExposure > 0 ? (Math.abs(totalStocksPotentialLoss) / totalPortfolioExposure) * 100 : 0;
    const optionsBoughtShare = totalPortfolioExposure > 0 ? (Math.abs(totalOptionsBoughtPotentialLoss) / totalPortfolioExposure) * 100 : 0;
    const optionsSoldShare = totalPortfolioExposure > 0 ? (Math.abs(totalOptionsSoldPotentialLoss === -Infinity ? 0 : totalOptionsSoldPotentialLoss) / totalPortfolioExposure) * 100 : 0;

    let totalRiskRewardRatio = ((totalOptionsSoldPremiumIncome + totalSoldStocksIncomeEUR) - totalInvestedCashEUR) / Math.abs(totalRiskExposureEUR);
    let riskRewardClass = 'text-neutral-text';
    if (totalRiskExposureEUR < 0 && ((totalOptionsSoldPremiumIncome + totalSoldStocksIncomeEUR) - totalInvestedCashEUR) > 0) {
        riskRewardClass = totalRiskRewardRatio > 1 ? 'text-logo-green' : 'text-logo-red';
    } else {
        totalRiskRewardRatio = null;
        riskRewardClass = 'text-neutral-text';
    }
    
    if (transactions.length > 0) {
        document.getElementById('portfolio-summary-card').classList.remove('hidden');

        document.getElementById('total-invested-cash').textContent = `${(totalInvestedCashEUR).toFixed(2)} €`;
        document.getElementById('total-premium-income').textContent = `${totalPremiumIncomeEUR.toFixed(2)} €`;
        
        let displayRiskExposure = totalRiskExposureEUR === -Infinity ? '∞' : totalRiskExposureEUR.toFixed(2);
        document.getElementById('total-risk-exposure').textContent = `${displayRiskExposure} €`;
        
        document.getElementById('total-risk-reward-ratio').textContent = totalRiskRewardRatio !== null ? totalRiskRewardRatio.toFixed(2) : '--';
        document.getElementById('total-risk-reward-ratio').className = `block text-2xl font-bold mt-1 ${riskRewardClass}`;

        document.getElementById('total-premium-income').className = `block text-2xl font-bold mt-1 ${totalPremiumIncomeEUR > 0 ? 'text-logo-green' : 'text-neutral-text'}`;
        document.getElementById('total-risk-exposure').className = `block text-2xl font-bold mt-1 ${displayRiskExposure === '∞' || parseFloat(displayRiskExposure) < 0 ? 'text-logo-red' : 'text-neutral-text'}`;

        document.getElementById('stocks-invested-cash').textContent = `${totalStocksInvestedAmount.toFixed(2)} €`;
        document.getElementById('stocks-realized-income').textContent = `${totalStocksRealizedIncome.toFixed(2)} €`;
        document.getElementById('stocks-potential-loss').textContent = `${totalStocksPotentialLoss.toFixed(2)} €`;
        
        document.getElementById('stocks-invested-cash').className = `block font-bold text-neutral-text`;
        document.getElementById('stocks-realized-income').className = `block font-bold ${totalStocksRealizedIncome > 0 ? 'text-logo-green' : 'text-neutral-text'}`;
        document.getElementById('stocks-potential-loss').className = `block font-bold ${totalStocksPotentialLoss < 0 ? 'text-logo-red' : 'text-neutral-text'}`;
        document.getElementById('stocks-portfolio-share').textContent = `${stocksShare.toFixed(2)}%`;
        
        document.getElementById('options-bought-invested-cash').textContent = `${totalOptionsBoughtInvestedAmount.toFixed(2)} €`;
        document.getElementById('options-bought-potential-loss').textContent = `${totalOptionsBoughtPotentialLoss.toFixed(2)} €`;
        document.getElementById('options-bought-portfolio-share').textContent = `${optionsBoughtShare.toFixed(2)}%`;
        
        document.getElementById('options-bought-invested-cash').className = `block font-bold text-neutral-text`;
        document.getElementById('options-bought-potential-loss').className = `block font-bold ${totalOptionsBoughtPotentialLoss < 0 ? 'text-logo-red' : 'text-neutral-text'}`;

        document.getElementById('options-sold-premium-income').textContent = `${totalOptionsSoldPremiumIncome.toFixed(2)} €`;
        document.getElementById('options-sold-potential-loss').textContent = `${totalOptionsSoldPotentialLoss === -Infinity ? '∞' : totalOptionsSoldPotentialLoss.toFixed(2)} €`;
        document.getElementById('options-sold-portfolio-share').textContent = `${optionsSoldShare.toFixed(2)}%`;
        
        document.getElementById('options-sold-premium-income').className = `block font-bold ${totalOptionsSoldPremiumIncome > 0 ? 'text-logo-green' : 'text-neutral-text'}`;
        document.getElementById('options-sold-potential-loss').className = `block font-bold ${totalOptionsSoldPotentialLoss === -Infinity || totalOptionsSoldPotentialLoss < 0 ? 'text-logo-red' : 'text-neutral-text'}`;

        if (totalSoldStocksIncomeEUR > 0) {
            document.getElementById('sold-stock-income-card').classList.remove('hidden');
            document.getElementById('total-sold-stock-income').textContent = `${totalSoldStocksIncomeEUR.toFixed(2)} €`;
            document.getElementById('total-sold-stock-income').className = `block text-2xl font-bold text-logo-green mt-1`;
        } else {
            document.getElementById('sold-stock-income-card').classList.add('hidden');
        }

    } else {
        document.getElementById('portfolio-summary-card').classList.add('hidden');
    }

    const symbolsWithMultiple = Object.keys(transactionCounts).filter(s => transactionCounts[s] >= 2);
    
    // Populate strategy symbol dropdown
    const strategySymbolSelect = document.getElementById('strategy-symbol');
    const optionsHtml = symbolsWithMultiple.map(symbol => {
        const transaction = transactions.find(t => t.symbol === symbol);
        const name = transaction.name && transaction.name.trim() !== '' ? transaction.name : 'Unknown Name';
        return `<option value="${symbol}">${symbol} - ${name}</option>`;
    }).join('');
    strategySymbolSelect.innerHTML = optionsHtml;

    transactions.forEach(t => {
        const metrics = calculateTransactionMetrics(t);
        let portfolioShare = 0;

        const currentTotalExposure = Math.abs(totalStocksPotentialLoss) + Math.abs(totalOptionsBoughtPotentialLoss) + (totalOptionsSoldPotentialLoss === -Infinity ? Infinity : Math.abs(totalOptionsSoldPotentialLoss));

        if (currentTotalExposure > 0) {
             if (t.assetType === 'Stock') {
                 if (t.action === 'Buy') {
                     portfolioShare = (Math.abs(metrics.riskExposure) / currentTotalExposure) * 100;
                 }
             } else if (t.assetType !== 'Stock') {
                 portfolioShare = (Math.abs(metrics.riskExposure === -Infinity ? 0 : metrics.riskExposure) / currentTotalExposure) * 100;
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
        const premiumClass = metrics.premiumIncome > 0 ? 'text-logo-green' : 'text-neutral-text';
        const riskClass = metrics.riskExposure < 0 || metrics.riskExposure === -Infinity ? 'text-logo-red' : 'text-neutral-text';
        const realizedIncomeClass = metrics.realizedIncome > 0 ? 'text-logo-green' : 'text-neutral-text';

        let priceInfo = '';
        if (t.assetType === 'Stock') {
            priceInfo = `Price: ${t.transactionPrice} ${t.currency}`;
        } else {
            priceInfo = `Strike: ${t.strikePrice} ${t.currency} | Prem: ${t.premium} ${t.currency}`;
        }

        const displayName = t.name && t.name.trim() !== '' ? t.name : t.symbol;
        
        const transactionItem = document.createElement('div');
        transactionItem.className = 'bg-neutral-card p-4 rounded-lg shadow-subtle space-y-4 cursor-pointer';
        
        const strategyButton = (transactionCounts[t.symbol] >= 2) ? 
        `<button data-id="${t.id}" data-symbol="${t.symbol}" class="strategy-btn bg-logo-green text-white px-4 py-2 rounded-full shadow hover:bg-opacity-80 transition-colors text-sm font-bold">
            Strategy
        </button>`
        : '';
        
        transactionItem.innerHTML = `
            <div class="flex items-center justify-between cursor-pointer" data-id="${t.id}" data-action="toggle-details">
                <div class="flex flex-col">
                    <div class="flex items-center space-x-2">
                        <span class="rounded px-2 py-1 text-sm font-bold text-white" style="background-color: ${symbolColors[t.symbol]}">${t.symbol}</span>
                        <span class="text-xl font-bold text-neutral-text">${displayName}</span>
                        <span class="px-2 py-1 rounded text-xs font-semibold ${assetTypeClass}">${t.assetType} - ${t.action}</span>
                        ${currentTotalExposure > 0 ? `<span class="ml-2 text-sm font-semibold text-gray-700">| ${portfolioShare.toFixed(2)}%</span>` : ''}
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
                    ${t.assetType === 'Stock' && t.action === 'Sell' ? `
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Realized Income</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="realized-income">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="realized-income-tooltip" class="tooltip-text">The total income received from a sold stock position, minus all trading fees.</span>
                                </span>
                            </div>
                            <span class="font-bold text-base ${realizedIncomeClass}">${metrics.realizedIncome.toFixed(2)} ${t.currency}</span>
                        </div>
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Potential Loss</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="potential-loss">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="potential-loss-tooltip" class="tooltip-text">The maximum possible loss for a single position. For sold stocks, this is 0.</span>
                                </span>
                            </div>
                            <span class="font-bold text-base ${riskClass}">${metrics.riskExposure.toFixed(2) + ' ' + t.currency}</span>
                        </div>
                    ` : `
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Invested Amount</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="invested-amount">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="invested-amount-tooltip" class="tooltip-text">This is the total amount of cash spent to open a position, including all trading fees.</span>
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
                                    <span id="premium-income-tooltip" class="tooltip-text">The total cash received from selling an option contract, minus all trading fees.</span>
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
                                    <span id="potential-loss-tooltip" class="tooltip-text">The maximum possible loss for a single position. For some positions, this can be unlimited.</span>
                                </span>
                            </div>
                            <span class="font-bold text-base ${riskClass}">${metrics.riskExposure === -Infinity ? '∞' : metrics.riskExposure.toFixed(2) + ' ' + t.currency}</span>
                        </div>
                    `}
                        <div class="bg-gray-100 p-3 rounded-lg flex flex-col justify-center items-center relative group">
                            <div class="flex items-center space-x-1">
                                <span class="text-sm text-gray-500">Breakeven</span>
                                <span class="tooltip-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors tooltip-icon" viewBox="0 0 20 20" fill="currentColor" data-tooltip-for="breakeven">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.868.498l-1.5 2.5A1 1 0 008.5 11H9v2a1 1 0 102 0v-2h.5a1 1 0 00.868-1.502l-1.5-2.5A1 1 0 0010 7z" clip-rule="evenodd" />
                                    </svg>
                                    <span id="breakeven-tooltip" class="tooltip-text">The price point at which a position begins to become profitable, including all fees.</span>
                                </span>
                            </div>
                            <span class="font-bold text-base text-neutral-text">${metrics.breakEven.toFixed(2)} ${t.currency}</span>
                        </div>
                    </div>
                </div>
                <div class="mt-6 flex justify-end gap-2">
                    <button data-id="${t.id}" class="edit-btn bg-gray-200 text-gray-700 px-4 py-2 rounded-full shadow hover:bg-gray-300 transition-colors text-sm font-bold">Edit</button>
                    ${strategyButton}
                    <button data-id="${t.id}" class="delete-btn bg-logo-red text-white px-4 py-2 rounded-full shadow hover:bg-opacity-80 transition-colors text-sm font-bold">Delete</button>
                </div>
                <div class="mt-4"><canvas id="chart-${t.id}" class="w-full h-64"></canvas></div>
            </div>
        `;
        transactionListDiv.appendChild(transactionItem);
    });
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