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