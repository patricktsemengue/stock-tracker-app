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
    if (transaction.assetType === 'Stock') {
        const { action, transactionPrice, fees, quantity } = transaction;
        const direction = action === 'Buy' ? 1 : -1;
        const totalCost = (transactionPrice * quantity) + (fees * quantity);
        let maxProfit = Infinity;
        if (action === 'Sell') {
            maxProfit = totalCost;
        }
        let maxLoss = -Infinity;
        if (action === 'Buy') {
            maxLoss = -totalCost;
        }
        let breakEven = transactionPrice + (direction * fees);
        return { maxProfit, maxLoss, breakEven };
    } else {
        const { action, assetType, strikePrice, premium, fees, quantity } = transaction;
        const direction = action === 'Buy' ? 1 : -1;
        let maxProfit = 0;
        if (action === 'Buy') {
            if (assetType === 'Call Option') {
                maxProfit = Infinity;
            } else {
                maxProfit = (strikePrice - premium) * quantity * 100 - (fees * quantity);
            }
        } else {
            maxProfit = (premium * quantity * 100) - (fees * quantity);
        }
        let maxLoss = 0;
        if (action === 'Buy') {
            maxLoss = -((premium * quantity * 100) + (fees * quantity));
        } else {
            if (assetType === 'Call Option') {
                maxLoss = -Infinity;
            } else {
                maxLoss = -((strikePrice - premium) * quantity * 100 + (fees * quantity));
            }
        }
        let breakEven = 0;
        if (assetType === 'Call Option') {
            breakEven = strikePrice + premium;
        } else {
            breakEven = strikePrice - premium;
        }
        return { maxProfit, maxLoss, breakEven };
    }
};