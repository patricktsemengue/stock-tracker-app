export const calculateStockPNL = (price, transaction) => {
    const { action, quantity, transactionPrice, fees } = transaction;
    const direction = action === 'Buy' ? 1 : -1;
    return ((price - transactionPrice) * quantity * direction) - (fees * quantity);
};

export const calculateOptionPNL = (underlyingPrice, transaction) => {
    const { action, quantity, strikePrice, premium, fees, assetType } = transaction;
    const direction = action === 'Buy' ? 1 : -1;
    let intrinsicValue = 0;
    if (assetType === 'Call Option') {
        intrinsicValue = Math.max(0, underlyingPrice - strikePrice);
    } else if (assetType === 'Put Option') {
        intrinsicValue = Math.max(0, strikePrice - underlyingPrice);
    }
    return ((intrinsicValue - premium) * quantity * 100 * direction) - (fees * quantity);
};

export const calculateTransactionMetrics = (transaction) => {
    let investedAmount = 0;
    let premiumIncome = 0;
    let riskExposure = 0;
    let breakEven = 0;
    let realizedIncome = 0;
    
    if (transaction.assetType === 'Stock') {
        const { action, transactionPrice, fees, quantity } = transaction;
        if (action === 'Buy') {
            investedAmount = (transactionPrice * quantity) + (fees * quantity);
            riskExposure = -investedAmount;
            breakEven = transactionPrice + fees;
        } else { // Sell
            investedAmount = 0;
            riskExposure = 0;
            breakEven = transactionPrice - fees;
            realizedIncome = (transactionPrice * quantity) - (fees * quantity);
        }
    } else { // Options
        const { action, assetType, strikePrice, premium, fees, quantity } = transaction;
        if (action === 'Buy') {
            investedAmount = (premium * quantity * 100) + (fees * quantity);
            riskExposure = -investedAmount;
            realizedIncome = 0;
            if (assetType === 'Call Option') {
                breakEven = strikePrice + premium;
            } else { // Put Option
                breakEven = strikePrice - premium;
            }
        } else { // Sell
            premiumIncome = (premium * quantity * 100) - (fees * quantity);
            realizedIncome = 0;
            if (assetType === 'Call Option') {
                riskExposure = -Infinity; // Unlimited theoretical loss for an uncovered call
                breakEven = strikePrice + premium;
            } else { // Put Option
                riskExposure = -((strikePrice * quantity * 100) - premiumIncome);
                breakEven = strikePrice - premium;
            }
        }
    }
    
    // Return all calculated metrics
    return { investedAmount, premiumIncome, riskExposure, breakEven, realizedIncome };
};