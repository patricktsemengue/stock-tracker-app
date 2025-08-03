// Get references to all the necessary HTML elements
const formContainer = document.getElementById('transaction-form-container');
const form = document.getElementById('transaction-form');
const transactionsList = document.getElementById('transactions-list');
const addTransactionButton = document.getElementById('add-transaction-button');
const cancelButton = document.getElementById('cancel-button');
const importButton = document.getElementById('import-button');
const exportButton = document.getElementById('export-button');
const fileInput = document.getElementById('file-input');
const optionFieldsContainer = document.getElementById('option-fields'); // NEW

// Get references to the form inputs
const transactionIdInput = document.getElementById('transaction-id');
const stockSymbolInput = document.getElementById('stock-symbol');
const productInput = document.getElementById('product');
const actionInput = document.getElementById('action');
const premiumInput = document.getElementById('premium');     // NEW
const expiryDateInput = document.getElementById('expiry-date'); // NEW
const quantityInput = document.getElementById('quantity');
const pricePerUnitInput = document.getElementById('price-per-unit');
const feesPerUnitInput = document.getElementById('fees-per-unit');
const currencyInput = document.getElementById('currency');

// Global array to store all our transactions
let transactions = [];

/**
 * Saves the current transactions array to localStorage.
 */
function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

/**
 * Loads transactions from localStorage.
 */
function loadTransactions() {
    const storedTransactions = localStorage.getItem('transactions');
    if (storedTransactions) {
        transactions = JSON.parse(storedTransactions);
    } else {
        transactions = [];
    }
}

/**
 * Renders the transactions array onto the page.
 */
function renderTransactions() {
    transactionsList.innerHTML = '';

    transactions.forEach(transaction => {
        const listItem = document.createElement('li');
        listItem.className = 'transaction-item';

        const totalValue = (transaction.quantity * transaction.pricePerUnit).toFixed(2);
        const fees = (transaction.quantity * transaction.feesPerUnit).toFixed(2);
        const netValue = (totalValue - fees).toFixed(2);

        // CONDITIONAL rendering for options data
        let optionDetails = '';
        if (transaction.product === 'Call' || transaction.product === 'Put') {
            const premiumDisplay = transaction.premium ? `(Premium: ${transaction.premium})` : '';
            const expiryDisplay = transaction.expiryDate ? `(Expires: ${transaction.expiryDate})` : '';
            optionDetails = `<p class="option-info">${premiumDisplay} ${expiryDisplay}</p>`;
        }
        
        listItem.innerHTML = `
            <div class="transaction-details">
                <h3>${transaction.symbol.toUpperCase()} - ${transaction.product} (${transaction.action})</h3>
                <p>Quantity: ${transaction.quantity} @ ${transaction.pricePerUnit} ${transaction.currency}</p>
                ${optionDetails}
                <p>Total Value: ${totalValue} ${transaction.currency} (Fees: ${fees} | Net: ${netValue})</p>
            </div>
            <div class="transaction-actions">
                <button class="edit-button" data-id="${transaction.id}">Edit</button>
                <button class="delete-button" data-id="${transaction.id}">Delete</button>
            </div>
        `;

        transactionsList.appendChild(listItem);
    });
}

/**
 * Handles the form submission for both adding and editing transactions.
 * @param {Event} event The form submission event.
 */
function handleFormSubmit(event) {
    event.preventDefault();
    const product = productInput.value;

    const transaction = {
        id: transactionIdInput.value || crypto.randomUUID(),
        symbol: stockSymbolInput.value.toUpperCase(),
        product: product,
        action: actionInput.value,
        quantity: parseFloat(quantityInput.value),
        pricePerUnit: parseFloat(pricePerUnitInput.value),
        feesPerUnit: parseFloat(feesPerUnitInput.value),
        currency: currencyInput.value
    };

    // CONDITIONAL data saving for options
    if (product === 'Call' || product === 'Put') {
        transaction.premium = parseFloat(premiumInput.value);
        transaction.expiryDate = expiryDateInput.value;
    }

    if (transactionIdInput.value) {
        const index = transactions.findIndex(t => t.id === transaction.id);
        if (index !== -1) {
            transactions[index] = transaction;
        }
    } else {
        transactions.unshift(transaction);
    }

    saveTransactions();
    renderTransactions();
    formContainer.classList.add('hidden');
}

/**
 * Handles clicks on the "Edit" button using event delegation.
 * @param {Event} event The click event.
 */
function handleEditClick(event) {
    if (event.target.classList.contains('edit-button')) {
        const transactionId = event.target.dataset.id;
        const transactionToEdit = transactions.find(t => t.id === transactionId);

        if (transactionToEdit) {
            transactionIdInput.value = transactionToEdit.id;
            stockSymbolInput.value = transactionToEdit.symbol;
            productInput.value = transactionToEdit.product;
            actionInput.value = transactionToEdit.action;
            quantityInput.value = transactionToEdit.quantity;
            pricePerUnitInput.value = transactionToEdit.pricePerUnit;
            feesPerUnitInput.value = transactionToEdit.feesPerUnit;
            currencyInput.value = transactionToEdit.currency;

            // CONDITIONAL data loading for options
            if (transactionToEdit.product === 'Call' || transactionToEdit.product === 'Put') {
                premiumInput.value = transactionToEdit.premium;
                expiryDateInput.value = transactionToEdit.expiryDate;
            } else {
                // Clear fields if the transaction is not an option
                premiumInput.value = '';
                expiryDateInput.value = '';
            }

            document.querySelector('#transaction-form h2').textContent = 'Edit Transaction';
            formContainer.classList.remove('hidden');
            toggleOptionFields(); // NEW: Call function to show/hide fields
        }
    }
}

/**
 * Toggles the visibility of the premium and expiry date fields.
 */
function toggleOptionFields() {
    const product = productInput.value;
    if (product === 'Call' || product === 'Put') {
        optionFieldsContainer.classList.remove('hidden');
        premiumInput.required = true;
        expiryDateInput.required = true;
    } else {
        optionFieldsContainer.classList.add('hidden');
        premiumInput.required = false;
        expiryDateInput.required = false;
        // Also clear the values just in case
        premiumInput.value = '';
        expiryDateInput.value = '';
    }
}


/**
 * Handles clicks on the "Delete" button using event delegation.
 * @param {Event} event The click event.
 */
function handleDeleteClick(event) {
    if (event.target.classList.contains('delete-button')) {
        const transactionId = event.target.dataset.id;
        if (confirm('Are you sure you want to delete this transaction?')) {
            transactions = transactions.filter(t => t.id !== transactionId);
            saveTransactions();
            renderTransactions();
        }
    }
}

/**
 * Converts transactions array to CSV format and triggers a download.
 */
function exportToCSV() {
    if (transactions.length === 0) {
        alert("No transactions to export.");
        return;
    }

    // UPDATED headers to include new fields
    const headers = ["id", "symbol", "product", "action", "premium", "expiryDate", "quantity", "pricePerUnit", "feesPerUnit", "currency"];
    const csvContent = "data:text/csv;charset=utf-8," 
                     + headers.join(',') + '\n'
                     + transactions.map(t => 
                         `${t.id},${t.symbol},${t.product},${t.action},${t.premium || ''},${t.expiryDate || ''},${t.quantity},${t.pricePerUnit},${t.feesPerUnit},${t.currency}`
                       ).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Converts transactions array to JSON format and triggers a download.
 */
function exportToJSON() {
    if (transactions.length === 0) {
        alert("No transactions to export.");
        return;
    }
    const jsonContent = JSON.stringify(transactions, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'transactions.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Handles the import of JSON or CSV files.
 * @param {Event} event The file change event.
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target.result;
        try {
            let importedData = [];
            if (file.type === 'application/json') {
                importedData = JSON.parse(content);
            } else if (file.type === 'text/csv') {
                const lines = content.split('\n').slice(1); // Skip header row
                importedData = lines.map(line => {
                    const [id, symbol, product, action, premium, expiryDate, quantity, pricePerUnit, feesPerUnit, currency] = line.split(',');
                    return { 
                        id, symbol, product, action, 
                        premium: premium ? parseFloat(premium) : undefined, 
                        expiryDate: expiryDate || undefined, 
                        quantity: parseFloat(quantity), 
                        pricePerUnit: parseFloat(pricePerUnit), 
                        feesPerUnit: parseFloat(feesPerUnit), 
                        currency 
                    };
                });
            }

            const newTransactions = [...transactions, ...importedData];
            const uniqueTransactions = Array.from(new Map(newTransactions.map(item => [item['id'], item])).values());
            transactions = uniqueTransactions;

            saveTransactions();
            renderTransactions();
            alert(`Successfully imported ${importedData.length} transactions.`);
        } catch (error) {
            alert("Error parsing file. Please ensure the file is valid JSON or CSV format.");
            console.error("File import error:", error);
        }
    };

    reader.readAsText(file);
}

// Event listeners
addTransactionButton.addEventListener('click', () => {
    form.reset();
    transactionIdInput.value = '';
    document.querySelector('#transaction-form h2').textContent = 'Add New Transaction';
    formContainer.classList.remove('hidden');
    toggleOptionFields(); // NEW: Call function to hide fields by default
});

cancelButton.addEventListener('click', () => {
    formContainer.classList.add('hidden');
});

// Use event delegation for list actions
transactionsList.addEventListener('click', (event) => {
    handleEditClick(event);
    handleDeleteClick(event);
});

// Event listener for the product dropdown to show/hide fields
productInput.addEventListener('change', toggleOptionFields); // NEW

// Form submission listener
form.addEventListener('submit', handleFormSubmit);

// Import/Export listeners
exportButton.addEventListener('click', () => {
    exportToJSON();
});
importButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileImport);


// Initial call to load and render transactions when the page loads
loadTransactions();
renderTransactions();