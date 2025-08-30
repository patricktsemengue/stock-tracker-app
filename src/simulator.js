import { calculateStockPNL, calculateOptionPNL, calculateTransactionMetrics } from './metrics.js';
import { getTransactionsForSymbol } from './transactionManager.js';

const chartInstances = {};

const pnlChartsContainer = document.getElementById('pnl-charts-container');
const strategySymbolSelect = document.getElementById('strategy-symbol');
const strategyPriceInput = document.getElementById('strategy-price');
const strategyMaxProfitSpan = document.getElementById('strategy-max-profit');
const strategyMaxLossSpan = document.getElementById('strategy-max-loss');
const strategyBreakevenRangeSpan = document.getElementById('strategy-breakeven-range');

export const simulateAndDrawTransactionPnlChart = (transaction, canvasId) => {
    const relevantPrice = transaction.assetType === 'Stock' ? transaction.transactionPrice : (transaction.underlyingAssetPrice || transaction.strikePrice);
    const initialMinPrice = relevantPrice * 0.5;
    const initialMaxPrice = relevantPrice * 1.5;
    
    simulateAndDrawChart(transaction, canvasId, initialMinPrice, initialMaxPrice, relevantPrice);
};

export const simulateAndDrawPnlChart = (transaction) => {
    if (!transaction) {
        console.error('Transaction object is undefined.');
        return;
    }
    const relevantPrice = transaction.assetType === 'Stock' ? transaction.transactionPrice : (transaction.underlyingAssetPrice || transaction.strikePrice);
    const initialMinPrice = relevantPrice * 0;
    const initialMaxPrice = relevantPrice * 2;
    
    pnlChartsContainer.innerHTML = '';
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'bg-white rounded-lg p-4 mb-4 shadow-sm';
    const canvas = document.createElement('canvas');
    const canvasId = `pnl-chart-${transaction.id}`;
    canvas.id = canvasId;
    canvas.className = 'w-full h-[400px]';
    chartWrapper.appendChild(canvas);
    pnlChartsContainer.appendChild(chartWrapper);

    simulateAndDrawChart(transaction, canvasId, initialMinPrice, initialMaxPrice, relevantPrice);
};

export const runStrategySimulation = () => {
    const symbol = strategySymbolSelect.value;
    const relevantPrice = parseFloat(strategyPriceInput.value);

    if (!symbol || isNaN(relevantPrice)) {
        return;
    }

    const transactionsForSymbol = getTransactionsForSymbol(symbol);
    
    const initialMinPrice = relevantPrice * 0;
    const initialMaxPrice = relevantPrice * 2;
    
    simulateAndDrawChart(transactionsForSymbol, 'strategy-chart', initialMinPrice, initialMaxPrice, relevantPrice);
    
    const currency = transactionsForSymbol[0].currency;
    const {maxProfit, maxLoss, breakevenPrices} = calculateStrategyMetrics(transactionsForSymbol, relevantPrice);
    const { investedAmount, premiumIncome, riskExposure } = calculateSymbolMetrics(transactionsForSymbol);
    
    updateStrategyMetrics(maxProfit, maxLoss, breakevenPrices, currency, investedAmount, premiumIncome, riskExposure);
};

export const updateStrategyPriceForSymbol = (symbol) => {
     if (symbol) {
        const transactionsForSymbol = getTransactionsForSymbol(symbol);
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
};

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
    const breakevenPrices = Array.isArray(transactionOrArray) ? calculateStrategyMetrics(transactionOrArray, relevantPrice).breakevenPrices : [];
    
    drawChart(pnlData, labels, canvasId, title, breakevenPrices, maxProfit, maxLoss, relevantPrice, transactionOrArray);
};

/*
export const zoomChart = (chartId, zoomFactor) => {
    const chartData = chartInstances[chartId];
    if (!chartData) return;

    const transaction = chartData.transactionData;
    if (!transaction) return;
    const relevantPrice = transaction.assetType === 'Stock' ? transaction.transactionPrice : (transaction.underlyingAssetPrice || transaction.strikePrice);

    const currentLabels = chartData.data.labels.map(l => parseFloat(l));
    const currentMinPrice = currentLabels[0];
    const currentMaxPrice = currentLabels[currentLabels.length - 1];

    const centerPrice = relevantPrice;
    const newMinPrice = centerPrice + (currentMinPrice - centerPrice) * zoomFactor;
    const newMaxPrice = centerPrice + (currentMaxPrice - centerPrice) * zoomFactor;
    
    if (newMinPrice < 0) {
        simulateAndDrawChart(chartData.transactionData, chartId, 0, newMaxPrice, relevantPrice);
    } else {
        simulateAndDrawChart(chartData.transactionData, chartId, newMinPrice, newMaxPrice, relevantPrice);
    }
};*/

const drawChart = (data, labels, canvasId, title, breakevenPrices, maxProfitValue, maxLossValue, relevantPrice, transactionData) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return;
    }
    const chartInstance = chartInstances[canvasId];
    if (chartInstance) {
        chartInstance.destroy();
    }

    const isStrategyChart = Array.isArray(transactionData);

    const ctx = canvas.getContext('2d');
    const breakevenAnnotations = {};
    if (breakevenPrices && breakevenPrices.length > 0) {
        breakevenPrices.forEach((price, index) => {
            breakevenAnnotations[`breakeven${index + 1}`] = {
                type: 'line',
                xMin: parseFloat(price),
                xMax: parseFloat(price),
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 2,
                borderDash: [10, 5],
                label: {
                    content: 'Breakeven',
                    enabled: true,
                    position: 'start',
                    backgroundColor: 'rgba(54, 162, 235, 0.7)'
                }
            };
        });
    }

    const annotations = {
        annotations: {
            ...breakevenAnnotations,
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
                    borderColor: '#2a5a54',
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea, scales } = chart;
                        if (!chartArea || chartArea.bottom === chartArea.top) return; 
                        const zeroY = scales.y.getPixelForValue(0);
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        const offset = Math.max(0, Math.min(1, (zeroY - chartArea.top) / (chartArea.bottom - chartArea.top)));
                        gradient.addColorStop(0, 'rgba(75, 192, 192, 0.2)');
                        gradient.addColorStop(offset, 'rgba(75, 192, 192, 0.2)');
                        gradient.addColorStop(offset, 'rgba(255, 99, 132, 0.2)');
                        gradient.addColorStop(1, 'rgba(255, 99, 132, 0.2)');
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
                    display: false,
                    text: title,
                    font: { size: 16 }
                },
                annotation: annotations,
                zoom: {
                    pan: {
                        enabled: false,
                        mode: 'xy'
                    },
                    zoom: {
                        wheel: {
                            enabled: false
                        },
                        pinch: {
                            enabled: false
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

const calculateStrategyMetrics = (transactionsForSymbol, relevantPrice) => {
    const pnlData = [];
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
};

const calculateSymbolMetrics = (transactionsForSymbol) => {
    let totalInvestedAmount = 0;
    let totalPremiumIncome = 0;
    let totalRiskExposure = 0;

    transactionsForSymbol.forEach(t => {
        const metrics = calculateTransactionMetrics(t);
        totalInvestedAmount += metrics.investedAmount;
        totalPremiumIncome += metrics.premiumIncome;
        if (metrics.riskExposure === -Infinity) {
            totalRiskExposure = -Infinity;
        } else if (totalRiskExposure !== -Infinity) {
            totalRiskExposure += metrics.riskExposure;
        }
    });
    return {
        investedAmount: totalInvestedAmount,
        premiumIncome: totalPremiumIncome,
        riskExposure: totalRiskExposure,
    };
};

const updateStrategyMetrics = (maxProfit, maxLoss, breakevenPrices, currency, investedAmount, premiumIncome, potentialLoss) => {
     const investedCashEl = document.getElementById('strategy-invested-cash');
     const premiumIncomeEl = document.getElementById('strategy-premium-income');
     const potentialLossEl = document.getElementById('strategy-potential-loss');
     const breakevenMetricsEl = document.getElementById('strategy-breakeven');
 
    investedCashEl.textContent = `${(investedAmount ?? 0).toFixed(2)} ${currency}`;
    investedCashEl.className = `font-bold ${investedAmount > 0 ? 'text-logo-red' : 'text-neutral-text'}`;

    premiumIncomeEl.textContent = `${(premiumIncome ?? 0).toFixed(2)} ${currency}`;
    premiumIncomeEl.className = `font-bold ${premiumIncome > 0 ? 'text-logo-green' : 'text-neutral-text'}`;
 
    potentialLossEl.textContent = potentialLoss === -Infinity ? '∞' : `${(potentialLoss ?? 0).toFixed(2)} ${currency}`;
    potentialLossEl.className = `font-bold ${potentialLoss === -Infinity || potentialLoss > 0 ? 'text-logo-red' : 'text-neutral-text'}`;
    breakevenMetricsEl.textContent = breakevenPrices.join(' & ') || 'None';
    breakevenMetricsEl.className = 'font-bold text-neutral-text';
 
};