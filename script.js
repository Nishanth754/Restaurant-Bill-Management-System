const AUTH_STORAGE_KEY = 'authenticatedUser';
const TAX_RATE = 0.05;

// Food items with predefined prices
const foodItems = {
    idli: { name: 'Idli', price: 6 },
    dosa: { name: 'Dosa', price: 25 },
    vada: { name: 'Vada', price: 7 },
    poori: { name: 'Poori', price: 60 },
    pongal: { name: 'Pongal', price: 80 },
    tea: { name: 'Tea', price: 20 },
    coffee: { name: 'Coffee', price: 35 }
};

// Current bill data
let currentBill = {
    billNumber: 1,
    items: [],
    total: 0,
    tax: 0,
    grandTotal: 0,
    itemCount: 0,
    date: new Date()
};

// All transactions (bills)
let transactions = [];

// Daily sales summary
let dailySales = {
    totalRevenue: 0,
    itemQuantities: {
        idli: 0,
        dosa: 0,
        vada: 0,
        poori: 0,
        pongal: 0,
        tea: 0,
        coffee: 0
    }
};

function formatCurrency(value = 0) {
    return `₹${value.toFixed(2)}`;
}

function sanitizeTransaction(rawTransaction) {
    const transaction = rawTransaction || {};
    const items = Array.isArray(transaction.items) ? transaction.items : [];
    const computedSubtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

    const subtotal = typeof transaction.subtotal === 'number'
        ? transaction.subtotal
        : parseFloat(computedSubtotal.toFixed(2));

    const totalFromRecord = typeof transaction.total === 'number' ? transaction.total : undefined;
    const tax = typeof transaction.tax === 'number'
        ? transaction.tax
        : totalFromRecord !== undefined
            ? parseFloat((totalFromRecord - subtotal).toFixed(2))
            : parseFloat((subtotal * TAX_RATE).toFixed(2));

    const total = totalFromRecord !== undefined
        ? totalFromRecord
        : parseFloat((subtotal + tax).toFixed(2));

    const itemCount = typeof transaction.itemCount === 'number'
        ? transaction.itemCount
        : items.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return {
        ...transaction,
        items,
        subtotal,
        tax,
        total,
        itemCount,
        note: transaction.note || '',
        date: transaction.date ? new Date(transaction.date) : new Date()
    };
}

// Authentication helpers
function getAuthenticatedUser() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Error reading auth data:', error);
        return null;
    }
}

function ensureAuthenticated() {
    const user = getAuthenticatedUser();
    if (!user) {
        window.location.href = 'owner-login.html';
        return null;
    }
    updateUserBadge(user);
    return user;
}

function updateUserBadge(user) {
    const badge = document.getElementById('userRoleBadge');
    if (!badge) return;
    const roleLabel = user.role === 'owner' ? 'Administrator' : 'Cafe Staff';
    const namePart = user.username ? ` • ${user.username}` : '';
    badge.textContent = `${roleLabel}${namePart}`;
}

function logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'owner-login.html';
}

function getBillNotesValue() {
    const notesInput = document.getElementById('billNotes');
    return notesInput ? notesInput.value.trim() : '';
}

// LocalStorage functions
function saveToLocalStorage() {
    try {
        localStorage.setItem('restaurantTransactions', JSON.stringify(transactions));
        localStorage.setItem('restaurantDailySales', JSON.stringify(dailySales));
        localStorage.setItem('restaurantBillNumber', currentBill.billNumber.toString());
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        // Load transactions
        const savedTransactions = localStorage.getItem('restaurantTransactions');
        if (savedTransactions) {
            const parsed = JSON.parse(savedTransactions);
            transactions = parsed.map(sanitizeTransaction);
        }

        // Load daily sales
        const savedDailySales = localStorage.getItem('restaurantDailySales');
        if (savedDailySales) {
            dailySales = JSON.parse(savedDailySales);
            dailySales.totalRevenue = Number(dailySales.totalRevenue) || 0;
            if (!dailySales.itemQuantities) {
                dailySales.itemQuantities = {};
            }
            Object.keys(foodItems).forEach(itemId => {
                if (typeof dailySales.itemQuantities[itemId] !== 'number') {
                    dailySales.itemQuantities[itemId] = 0;
                }
            });
        }

        // Load bill number
        const savedBillNumber = localStorage.getItem('restaurantBillNumber');
        if (savedBillNumber) {
            currentBill.billNumber = parseInt(savedBillNumber) || 1;
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

function clearLocalStorage() {
    try {
        localStorage.removeItem('restaurantTransactions');
        localStorage.removeItem('restaurantDailySales');
        localStorage.removeItem('restaurantBillNumber');
    } catch (error) {
        console.error('Error clearing localStorage:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const user = ensureAuthenticated();
    if (!user) {
        return;
    }

    // Load data from localStorage
    loadFromLocalStorage();
    calculateBillTotals();
    
    // Update displays
    updateBillDate();
    updateBillDisplay();
    updateBillButtons();
    updateDailyRevenue();
    updateTransactionsDisplay();
    updateRevenueButton();
    document.getElementById('currentBillNumber').textContent = currentBill.billNumber;
    
    // Check if PDF libraries are loaded
    setTimeout(function() {
        if (typeof window.jspdf === 'undefined') {
            console.warn('jsPDF library may not be loaded. PDF generation may not work.');
        } else {
            console.log('PDF libraries loaded successfully');
        }
    }, 1000);
});

// Update bill date display
function updateBillDate() {
    const dateElement = document.getElementById('billDate');
    const now = new Date();
    dateElement.textContent = now.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Add item to current bill
function addItem(itemId, price) {
    const qtyInput = document.getElementById(`${itemId}-qty`);
    const quantity = parseInt(qtyInput.value) || 0;
    
    if (quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
    }

    // Check if item already exists in bill
    const existingItemIndex = currentBill.items.findIndex(item => item.id === itemId);
    
    if (existingItemIndex !== -1) {
        // Update existing item quantity
        currentBill.items[existingItemIndex].quantity += quantity;
    } else {
        // Add new item
        currentBill.items.push({
            id: itemId,
            name: foodItems[itemId].name,
            price: price,
            quantity: quantity
        });
    }

    // Reset quantity input
    qtyInput.value = 0;
    
    // Recalculate total
    calculateBillTotals();
    updateBillDisplay();
    updateBillButtons();
}

// Calculate bill total
function calculateBillTotals() {
    const subtotalRaw = currentBill.items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);
    const itemCount = currentBill.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = parseFloat(subtotalRaw.toFixed(2));
    const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const grandTotal = parseFloat((subtotal + tax).toFixed(2));

    currentBill.total = subtotal;
    currentBill.tax = tax;
    currentBill.grandTotal = grandTotal;
    currentBill.itemCount = itemCount;

    return { subtotal, tax, grandTotal, itemCount };
}

// Update bill display
function updateBillDisplay() {
    const billItemsContainer = document.getElementById('billItems');
    const billTotalElement = document.getElementById('billTotal');
    
    if (currentBill.items.length === 0) {
        billItemsContainer.innerHTML = '<p class="empty-bill">No items added yet</p>';
    } else {
        let html = '<table class="bill-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead><tbody>';
        
        currentBill.items.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            html += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.price)}</td>
                    <td>${formatCurrency(itemTotal)}</td>
                    <td><button onclick="removeItem(${index})" class="remove-btn">×</button></td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        billItemsContainer.innerHTML = html;
    }
    
    billTotalElement.textContent = formatCurrency(currentBill.grandTotal || 0);
    updateBillSummaryUI();
}

function updateBillSummaryUI() {
    const metrics = {
        itemCount: currentBill.itemCount || 0,
        subtotal: currentBill.total || 0,
        tax: currentBill.tax || 0,
        grandTotal: currentBill.grandTotal || 0
    };
    const average = metrics.itemCount ? metrics.grandTotal / metrics.itemCount : 0;

    const mappings = [
        { id: 'metricItemCount', value: metrics.itemCount },
        { id: 'metricSubtotal', value: formatCurrency(metrics.subtotal) },
        { id: 'metricTax', value: formatCurrency(metrics.tax) },
        { id: 'metricGrand', value: formatCurrency(metrics.grandTotal) },
        { id: 'summarySubtotal', value: formatCurrency(metrics.subtotal) },
        { id: 'summaryTax', value: formatCurrency(metrics.tax) },
        { id: 'summaryGrand', value: formatCurrency(metrics.grandTotal) },
        { id: 'summaryItems', value: metrics.itemCount },
        { id: 'summaryAverage', value: formatCurrency(average) }
    ];

    mappings.forEach(mapping => {
        const el = document.getElementById(mapping.id);
        if (el) {
            el.textContent = mapping.value;
        }
    });
}

// Remove item from bill
function removeItem(index) {
    currentBill.items.splice(index, 1);
    calculateBillTotals();
    updateBillDisplay();
    updateBillButtons();
}

// Update bill action buttons state
function updateBillButtons() {
    const generateBtn = document.getElementById('generateBillBtn');
    const saveBtn = document.getElementById('saveBillBtn');
    const hasItems = currentBill.items.length > 0;
    
    generateBtn.disabled = !hasItems;
    saveBtn.disabled = !hasItems;
}

// Clear current bill
function clearCurrentBill() {
    if (currentBill.items.length > 0 && !confirm('Are you sure you want to clear the current bill?')) {
        return;
    }
    
    currentBill.items = [];
    currentBill.total = 0;
    currentBill.tax = 0;
    currentBill.grandTotal = 0;
    currentBill.itemCount = 0;
    currentBill.date = new Date();
    updateBillDate();
    calculateBillTotals();
    updateBillDisplay();
    updateBillButtons();
    
    // Reset all quantity inputs
    Object.keys(foodItems).forEach(itemId => {
        document.getElementById(`${itemId}-qty`).value = 0;
    });

    const notesInput = document.getElementById('billNotes');
    if (notesInput) {
        notesInput.value = '';
    }
}

// Save bill to transactions
function saveBill() {
    if (currentBill.items.length === 0) {
        alert('Cannot save an empty bill');
        return;
    }

    const totals = calculateBillTotals();
    const note = getBillNotesValue();

    // Create a copy of the current bill
    const billToSave = {
        billNumber: currentBill.billNumber,
        items: JSON.parse(JSON.stringify(currentBill.items)),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.grandTotal,
        itemCount: totals.itemCount,
        note,
        date: new Date()
    };

    // Add to transactions
    transactions.push(billToSave);

    // Update daily sales
    billToSave.items.forEach(item => {
        if (typeof dailySales.itemQuantities[item.id] !== 'number') {
            dailySales.itemQuantities[item.id] = 0;
        }
        dailySales.itemQuantities[item.id] += item.quantity;
    });
    dailySales.totalRevenue += billToSave.total;
    dailySales.totalRevenue = parseFloat(dailySales.totalRevenue.toFixed(2));

    // Increment bill number for next bill
    currentBill.billNumber++;
    document.getElementById('currentBillNumber').textContent = currentBill.billNumber;

    // Clear current bill
    clearCurrentBill();

    // Update displays
    updateTransactionsDisplay();
    updateDailyRevenue();
    updateRevenueButton();
    
    // Save to localStorage
    saveToLocalStorage();
}

// Update transactions display
function updateTransactionsDisplay() {
    const transactionsList = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p class="empty-transactions">No transactions yet</p>';
        return;
    }

    let html = '<div class="transactions-container">';
    
    transactions.forEach((transaction, index) => {
        const dateStr = new Date(transaction.date).toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const subtotal = typeof transaction.subtotal === 'number' ? transaction.subtotal : transaction.total;
        const tax = typeof transaction.tax === 'number' ? transaction.tax : 0;
        const itemCount = transaction.itemCount || 0;
        
        html += `
            <div class="transaction-item">
                <div class="transaction-header">
                    <span class="transaction-number">Bill #${transaction.billNumber}</span>
                    <span class="transaction-date">${dateStr}</span>
                </div>
                <div class="transaction-details">
                    <span class="transaction-total">Total: ${formatCurrency(transaction.total || 0)}</span>
                    <button onclick="viewTransaction(${index})" class="btn-view">View</button>
                </div>
                <div class="transaction-extra">
                    <span>${itemCount} items</span>
                    <span>Tax: ${formatCurrency(tax)}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    transactionsList.innerHTML = html;
}

// View transaction details
function viewTransaction(index) {
    const transaction = transactions[index];
    const itemsList = transaction.items.map(item => 
        `${item.name} x${item.quantity} = ${formatCurrency(item.price * item.quantity)}`
    ).join('\n');

    const summary = [
        `Items: ${transaction.itemCount || 0}`,
        `Subtotal: ${formatCurrency(transaction.subtotal || transaction.total || 0)}`,
        `Tax: ${formatCurrency(transaction.tax || 0)}`,
        `Total: ${formatCurrency(transaction.total || 0)}`
    ].join('\n');

    const notesSection = transaction.note ? `\n\nNotes:\n${transaction.note}` : '';
    
    alert(`Bill #${transaction.billNumber}\nDate: ${new Date(transaction.date).toLocaleString('en-IN')}\n\nItems:\n${itemsList}\n\nSummary:\n${summary}${notesSection}`);
}

// Update daily revenue display
function updateDailyRevenue() {
    document.getElementById('dailyRevenue').textContent = dailySales.totalRevenue.toFixed(2);
    document.getElementById('totalBills').textContent = transactions.length;
}

// Update revenue button state
function updateRevenueButton() {
    const revenueBtn = document.getElementById('revenueBtn');
    revenueBtn.disabled = transactions.length === 0;
}

// Generate bill PDF
function generateBillPDF() {
    if (currentBill.items.length === 0) {
        alert('Cannot generate PDF for an empty bill');
        return;
    }

    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        alert('PDF library not loaded. Please refresh the page.');
        return;
    }

    try {
        const totals = calculateBillTotals();
        const noteText = getBillNotesValue();

        // Access jsPDF correctly
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Restaurant header
        doc.setFontSize(20);
        doc.text('Restaurant Billing System', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Bill #${currentBill.billNumber}`, 105, 30, { align: 'center' });
        doc.text(`Date: ${new Date(currentBill.date).toLocaleString('en-IN')}`, 105, 36, { align: 'center' });
        
        // Bill items table
        const tableData = currentBill.items.map(item => [
            item.name,
            item.quantity.toString(),
            formatCurrency(item.price),
            formatCurrency(item.price * item.quantity)
        ]);
        
        // Check if autoTable is available
        if (typeof doc.autoTable !== 'undefined') {
            doc.autoTable({
                startY: 45,
                head: [['Item', 'Quantity', 'Price', 'Total']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
                styles: { fontSize: 10 }
            });
            
            const summaryStartY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 60;
            doc.autoTable({
                startY: summaryStartY,
                body: [
                    ['Items', currentBill.itemCount.toString()],
                    ['Subtotal', formatCurrency(totals.subtotal)],
                    ['Tax (5%)', formatCurrency(totals.tax)],
                    ['Grand Total', formatCurrency(totals.grandTotal)]
                ],
                theme: 'plain',
                styles: { fontSize: 11, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 70 },
                    1: { cellWidth: 50, halign: 'right' }
                },
                didParseCell: function(data) {
                    if (data.row.index === 3) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            });

            let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : summaryStartY + 30;

            if (noteText) {
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('Notes:', 14, finalY);
                doc.setFont(undefined, 'normal');
                const wrapped = doc.splitTextToSize(noteText, 180);
                doc.text(wrapped, 14, finalY + 6);
                finalY += 6 + (wrapped.length * 6);
            }
            
            // Footer
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('Thank you for your visit!', 105, finalY + 12, { align: 'center' });
        } else {
            // Fallback if autoTable is not available - create table manually
            let yPos = 50;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Item', 20, yPos);
            doc.text('Qty', 80, yPos);
            doc.text('Price', 110, yPos);
            doc.text('Total', 150, yPos);
            
            yPos += 10;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            
            currentBill.items.forEach(item => {
                doc.text(item.name, 20, yPos);
                doc.text(item.quantity.toString(), 80, yPos);
                doc.text(formatCurrency(item.price), 110, yPos);
                doc.text(formatCurrency(item.price * item.quantity), 150, yPos);
                yPos += 8;
            });
            
            // Summary
            yPos += 10;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Items: ${currentBill.itemCount}`, 20, yPos);
            yPos += 7;
            doc.text(`Subtotal: ${formatCurrency(totals.subtotal)}`, 20, yPos);
            yPos += 7;
            doc.text(`Tax (5%): ${formatCurrency(totals.tax)}`, 20, yPos);
            yPos += 7;
            doc.text(`Grand Total: ${formatCurrency(totals.grandTotal)}`, 20, yPos);
            yPos += 10;

            if (noteText) {
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('Notes:', 20, yPos);
                doc.setFont(undefined, 'normal');
                const wrapped = doc.splitTextToSize(noteText, 170);
                doc.text(wrapped, 20, yPos + 6);
                yPos += 6 + (wrapped.length * 6);
            }
            
            // Footer
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('Thank you for your visit!', 105, yPos + 12, { align: 'center' });
        }
        
        // Save PDF
        doc.save(`Bill_${currentBill.billNumber}_${Date.now()}.pdf`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF: ' + error.message);
    }
}

// Generate daily revenue PDF
function generateDailyRevenuePDF() {
    if (transactions.length === 0) {
        alert('No transactions to generate report');
        return;
    }

    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        alert('PDF library not loaded. Please refresh the page.');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.text('Daily Revenue Report', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        const today = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        doc.text('Date: ' + today, 105, 30, { align: 'center' });
        
        // Summary section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Summary', 14, 45);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        const revenueText = 'Total Revenue: Rs. ' + dailySales.totalRevenue.toFixed(2);
        doc.text(revenueText, 14, 55);
        doc.text('Total Bills: ' + transactions.length, 14, 62);
        
        // Item-wise sales
        let startY = 75;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Item-wise Sales', 14, startY);
        
        const itemSalesData = Object.keys(dailySales.itemQuantities)
            .filter(itemId => dailySales.itemQuantities[itemId] > 0)
            .map(itemId => [
                foodItems[itemId].name,
                dailySales.itemQuantities[itemId].toString(),
                'Rs. ' + foodItems[itemId].price,
                'Rs. ' + (foodItems[itemId].price * dailySales.itemQuantities[itemId]).toFixed(2)
            ]);
        
        let transactionStartY;
        if (itemSalesData.length > 0 && typeof doc.autoTable !== 'undefined') {
            doc.autoTable({
                startY: startY + 5,
                head: [['Item', 'Quantity', 'Price', 'Total']],
                body: itemSalesData,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
                styles: { fontSize: 10 }
            });
            transactionStartY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : startY + 30;
        } else {
            transactionStartY = startY + 30;
        }
        
        // Transaction details
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Transaction Details', 14, transactionStartY);
        
        const transactionData = transactions.map(transaction => {
            const dateStr = new Date(transaction.date).toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            return [
                'Bill #' + transaction.billNumber,
                dateStr,
                'Rs. ' + transaction.total.toFixed(2)
            ];
        });
        
        if (typeof doc.autoTable !== 'undefined') {
            doc.autoTable({
                startY: transactionStartY + 5,
                head: [['Bill Number', 'Date & Time', 'Total']],
                body: transactionData,
                theme: 'striped',
                headStyles: { fillColor: [39, 174, 96] },
                styles: { fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 40, halign: 'right' }
                }
            });
        } else {
            // Fallback: create table manually
            let yPos = transactionStartY + 10;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Bill Number', 14, yPos);
            doc.text('Date & Time', 60, yPos);
            doc.text('Total', 140, yPos);
            
            yPos += 8;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            transactionData.forEach(row => {
                doc.text(row[0], 14, yPos);
                doc.text(row[1], 60, yPos);
                doc.text(row[2], 140, yPos);
                yPos += 7;
            });
        }
        
        // Save PDF
        doc.save(`Daily_Revenue_${Date.now()}.pdf`);
    } catch (error) {
        console.error('Error generating daily revenue PDF:', error);
        alert('Error generating PDF: ' + error.message);
    }
}

// Reset all data
function resetAll() {
    if (transactions.length === 0 && currentBill.items.length === 0) {
        alert('No data to reset');
        return;
    }
    
    if (!confirm('Are you sure you want to reset all data? This will clear all transactions and the current bill.')) {
        return;
    }
    
    // Reset all data
    transactions = [];
    currentBill = {
        billNumber: 1,
        items: [],
        total: 0,
        tax: 0,
        grandTotal: 0,
        itemCount: 0,
        date: new Date()
    };
    dailySales = {
        totalRevenue: 0,
        itemQuantities: {
            idli: 0,
            dosa: 0,
            vada: 0,
            poori: 0,
            pongal: 0,
            tea: 0,
            coffee: 0
        }
    };
    
    // Update displays
    document.getElementById('currentBillNumber').textContent = '1';
    updateBillDate();
    calculateBillTotals();
    updateBillDisplay();
    updateBillButtons();
    updateTransactionsDisplay();
    updateDailyRevenue();
    updateRevenueButton();
    const notesInput = document.getElementById('billNotes');
    if (notesInput) {
        notesInput.value = '';
    }
    
    // Reset quantity inputs
    Object.keys(foodItems).forEach(itemId => {
        document.getElementById(`${itemId}-qty`).value = 0;
    });
    
    // Clear localStorage
    clearLocalStorage();
    // Save empty state to localStorage
    saveToLocalStorage();
}

