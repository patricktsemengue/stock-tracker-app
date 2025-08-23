import { calculateStockPNL, calculateOptionPNL } from './metrics.js';
import { getTransactionsForSymbol } from './transactionManager.js';

const chartInstances = {};

const pnlChartsContainer = document.getElementById('pnl-charts-container');
const strategySymbolSelect = document.getElementById('strategy-symbol');
const strategyPriceInput = document.getElementById('strategy-price');
const strategyMaxProfitSpan = document.getElementById('strategy-max-profit');
const strategyMaxLossSpan = document.getElementById('strategy-max-loss');
const strategyBreakevenRangeSpan = document.getElementById('strategy-breakeven-range');

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
    
    updateStrategyMetrics(maxProfit, maxLoss, breakevenPrices, currency);
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
    const currency = (Array.isArray(transactionOrArray)) ? transactionOrArray[0].currency : transactionOrArray.currency;
    const breakevenPrices = Array.isArray(transactionOrArray) ? calculateStrategyMetrics(transactionOrArray, relevantPrice).breakevenPrices : [];
    
    drawChart(pnlData, labels, canvasId, title, breakevenPrices, maxProfit, maxLoss, relevantPrice, transactionOrArray);
};

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
                        // Safety check to prevent errors on a non-rendered chart
                        if (!chartArea || chartArea.bottom === chartArea.top) return; 
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