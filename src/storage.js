import { appConfig } from './apiManager.js';

export const getTransactions = () => {
    return JSON.parse(localStorage.getItem('transactions')) || [];
};

export const saveTransactions = (transactions) => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
};

export const getForexRatesWithDate = () => {
    return JSON.parse(localStorage.getItem('forexRates')) || { rates: {}, date: null };
};

export const saveForexRates = (rates) => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('forexRates', JSON.stringify({ rates: rates, date: today }));
};

export const getSavedSymbols = () => {
    return JSON.parse(localStorage.getItem('selectedSymbols')) || [];
};

export const saveSymbols = (symbols) => {
    localStorage.setItem('selectedSymbols', JSON.stringify(symbols));
};

export const getRecentlySearched = () => {
    const cached = localStorage.getItem('recentlySearched');
    if (!cached) {
        return [];
    }
    const recentlySearched = JSON.parse(cached);
    const now = new Date().getTime();
    const expireTime = (appConfig.cacheExpire || 60) * 60 * 1000;
    return recentlySearched.filter(item => now - item.timestamp < expireTime);
};

export const saveRecentlySearched = (symbol, name, price) => {
    let recentlySearched = getRecentlySearched();
    const now = new Date().getTime();
    const newItem = { symbol, name, price, timestamp: now };
    const existingIndex = recentlySearched.findIndex(item => item.symbol === symbol);
    if (existingIndex > -1) {
        recentlySearched.splice(existingIndex, 1);
    }
    recentlySearched.unshift(newItem);
    const cacheSize = appConfig.cacheSize || 10;
    if (recentlySearched.length > cacheSize) {
        recentlySearched.pop();
    }
    localStorage.setItem('recentlySearched', JSON.stringify(recentlySearched));
};