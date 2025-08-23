export const getTransactions = () => {
    return JSON.parse(localStorage.getItem('transactions')) || [];
};

export const saveTransactions = (transactions) => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
};