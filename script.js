/* ==========================================================================
   SpendWise — Personal Finance Tracker (script.js)
   Vanilla JavaScript implementation with localStorage persistence
   ========================================================================== */

(function () {
  "use strict";

  // 1. Constants & Configuration
  const STORAGE_KEYS = {
    TRANSACTIONS: "spendwise_transactions_v1",
    THEME: "spendwise_theme_v1"
  };

  // Categories mapped to transaction type so the dropdown updates logically
  const CATEGORIES_BY_TYPE = {
    expense: [
      "Food",
      "Transport",
      "Shopping",
      "Education",
      "Entertainment",
      "Bills",
      "Other"
    ],
    income: [
      "Salary",
      "Allowance",
      "Other"
    ]
  };

  // Indian Rupee (INR) formatter using the built-in Intl API
  const inrFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // 2. Application State
  let transactions = [];
  let editingTransactionId = null;

  // 3. DOM Element References
  const dom = {
    // Header / Theme
    themeToggleBtn: document.getElementById("theme-toggle"),
    themeToggleText: document.getElementById("theme-toggle-text"),

    // Overall Financial Summary
    totalCountBadge: document.getElementById("total-count-badge"),
    totalIncomeEl: document.getElementById("total-income"),
    totalExpensesEl: document.getElementById("total-expenses"),
    currentBalanceEl: document.getElementById("current-balance"),

    // Monthly Overview
    monthSelector: document.getElementById("month-selector"),
    monthlyIncomeEl: document.getElementById("monthly-income"),
    monthlyExpensesEl: document.getElementById("monthly-expenses"),
    monthlyBalanceEl: document.getElementById("monthly-balance"),

    // Transaction Form
    formHeading: document.getElementById("form-heading"),
    editModeBadge: document.getElementById("edit-mode-badge"),
    form: document.getElementById("transaction-form"),
    titleInput: document.getElementById("title-input"),
    amountInput: document.getElementById("amount-input"),
    typeInput: document.getElementById("type-input"),
    categoryInput: document.getElementById("category-input"),
    dateInput: document.getElementById("date-input"),
    submitBtn: document.getElementById("submit-btn"),
    cancelEditBtn: document.getElementById("cancel-edit-btn"),

    // Validation Error Messages
    titleError: document.getElementById("title-error"),
    amountError: document.getElementById("amount-error"),
    typeError: document.getElementById("type-error"),
    categoryError: document.getElementById("category-error"),
    dateError: document.getElementById("date-error"),

    // Search, Filter & Sort Controls
    searchInput: document.getElementById("search-input"),
    filterType: document.getElementById("filter-type"),
    filterCategory: document.getElementById("filter-category"),
    sortDate: document.getElementById("sort-date"),
    resetFiltersBtn: document.getElementById("reset-filters-btn"),

    // Transaction History Table & Empty State
    visibleCountText: document.getElementById("visible-count-text"),
    tableContainer: document.getElementById("table-container"),
    transactionsTbody: document.getElementById("transactions-tbody"),
    emptyState: document.getElementById("empty-state"),
    emptyStateTitle: document.getElementById("empty-state-title"),
    emptyStateText: document.getElementById("empty-state-text")
  };

  /* ==========================================================================
     Helper Functions (Dates, Currency, IDs)
     ========================================================================== */

  // Returns today's local date in YYYY-MM-DD format for the date input default
  function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Returns current local month in YYYY-MM format for the monthly overview default
  function getCurrentMonthString() {
    return getTodayDateString().slice(0, 7);
  }

  // Formats a number into Indian Rupees (e.g., ₹1,500.00)
  function formatCurrency(amount) {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return inrFormatter.format(safeAmount);
  }

  // Formats an amount with an explicit + or - sign for the transaction table
  function formatSignedCurrency(amount, type) {
    const formatted = formatCurrency(Math.abs(amount));
    return type === "income" ? `+${formatted}` : `-${formatted}`;
  }

  // Converts YYYY-MM-DD into a readable format like "26 Oct 2026"
  function formatReadableDate(isoDateString) {
    if (typeof isoDateString !== "string") {
      return "";
    }

    const parts = isoDateString.split("-");
    if (parts.length !== 3) {
      return isoDateString;
    }

    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const dateObj = new Date(year, monthIndex, day);

    if (Number.isNaN(dateObj.getTime())) {
      return isoDateString;
    }

    return dateObj.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  // Generates a unique ID for each transaction
  function generateUniqueId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "txn_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
  }

  /* ==========================================================================
     localStorage Management
     ========================================================================== */

  // Loads and validates saved transactions from localStorage
  function loadTransactionsFromStorage() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!rawData) {
        return [];
      }

      const parsed = JSON.parse(rawData);
      if (!Array.isArray(parsed)) {
        return [];
      }

      // Filter out any corrupted or incomplete records
      return parsed.filter(function (item) {
        return (
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          item.title.trim() !== "" &&
          typeof item.amount === "number" &&
          Number.isFinite(item.amount) &&
          item.amount > 0 &&
          (item.type === "income" || item.type === "expense") &&
          typeof item.category === "string" &&
          typeof item.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        );
      });
    } catch (error) {
      console.warn("Could not load transactions from localStorage:", error);
      return [];
    }
  }

  // Saves the current transactions array to localStorage
  function saveTransactionsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (error) {
      console.error("Could not save transactions to localStorage:", error);
    }
  }

  /* ==========================================================================
     Theme Management (Light / Dark Mode)
     ========================================================================== */

  function applyTheme(theme) {
    const validTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", validTheme);
    dom.themeToggleText.textContent = validTheme === "dark" ? "Light Mode" : "Dark Mode";
  }

  function initTheme() {
    let savedTheme = "light";
    try {
      const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (storedTheme === "dark" || storedTheme === "light") {
        savedTheme = storedTheme;
      }
    } catch (error) {
      console.warn("Could not read theme preference from localStorage:", error);
    }
    applyTheme(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);

    try {
      localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
    } catch (error) {
      console.warn("Could not save theme preference to localStorage:", error);
    }
  }

  /* ==========================================================================
     Form Handling & Validation
     ========================================================================== */

  // Populates the category <select> based on whether Income or Expense is selected
  function populateCategoryOptions(type, selectedCategory) {
    const validType = type === "income" ? "income" : "expense";
    const categories = CATEGORIES_BY_TYPE[validType];

    dom.categoryInput.textContent = "";

    categories.forEach(function (categoryName) {
      const option = document.createElement("option");
      option.value = categoryName;
      option.textContent = categoryName;
      dom.categoryInput.appendChild(option);
    });

    if (selectedCategory && categories.includes(selectedCategory)) {
      dom.categoryInput.value = selectedCategory;
    } else {
      dom.categoryInput.value = categories[0];
    }
  }

  // Clears all inline error messages and red input borders
  function clearValidationErrors() {
    dom.titleError.textContent = "";
    dom.amountError.textContent = "";
    dom.typeError.textContent = "";
    dom.categoryError.textContent = "";
    dom.dateError.textContent = "";

    dom.titleInput.classList.remove("input-invalid");
    dom.amountInput.classList.remove("input-invalid");
    dom.typeInput.classList.remove("input-invalid");
    dom.categoryInput.classList.remove("input-invalid");
    dom.dateInput.classList.remove("input-invalid");
  }

  // Validates all form fields and returns a clean data object or null if invalid
  function validateForm() {
    clearValidationErrors();
    let isValid = true;

    const title = dom.titleInput.value.trim();
    const amountRaw = dom.amountInput.value.trim();
    const amount = Number(amountRaw);
    const type = dom.typeInput.value;
    const category = dom.categoryInput.value;
    const date = dom.dateInput.value;

    if (!title) {
      dom.titleError.textContent = "Please enter a transaction title.";
      dom.titleInput.classList.add("input-invalid");
      isValid = false;
    }

    if (!amountRaw || Number.isNaN(amount) || !Number.isFinite(amount) || amount <= 0) {
      dom.amountError.textContent = "Please enter a valid positive amount greater than 0.";
      dom.amountInput.classList.add("input-invalid");
      isValid = false;
    }

    if (type !== "income" && type !== "expense") {
      dom.typeError.textContent = "Please select a valid transaction type.";
      dom.typeInput.classList.add("input-invalid");
      isValid = false;
    }

    const allowedCategories = CATEGORIES_BY_TYPE[type] || [];
    if (!category || !allowedCategories.includes(category)) {
      dom.categoryError.textContent = "Please choose a valid category.";
      dom.categoryInput.classList.add("input-invalid");
      isValid = false;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dom.dateError.textContent = "Please select a valid date.";
      dom.dateInput.classList.add("input-invalid");
      isValid = false;
    }

    if (!isValid) {
      return null;
    }

    return {
      title: title,
      amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
      type: type,
      category: category,
      date: date
    };
  }

  // Resets the form back to "Add Transaction" mode with sensible defaults
  function resetFormToDefault() {
    editingTransactionId = null;
    dom.form.reset();

    dom.typeInput.value = "expense";
    populateCategoryOptions("expense");
    dom.dateInput.value = getTodayDateString();
    clearValidationErrors();

    dom.formHeading.textContent = "Add Transaction";
    dom.submitBtn.textContent = "Add Transaction";
    dom.editModeBadge.hidden = true;
    dom.cancelEditBtn.hidden = true;
  }

  /* ==========================================================================
     Transaction CRUD Operations (Add, Edit, Delete)
     ========================================================================== */

  function handleFormSubmit(event) {
    event.preventDefault();

    const validatedData = validateForm();
    if (!validatedData) {
      return;
    }

    if (editingTransactionId !== null) {
      // Update existing transaction in place (prevents duplicate entries)
      const index = transactions.findIndex(function (txn) {
        return txn.id === editingTransactionId;
      });

      if (index !== -1) {
        transactions[index] = {
          id: editingTransactionId,
          title: validatedData.title,
          amount: validatedData.amount,
          type: validatedData.type,
          category: validatedData.category,
          date: validatedData.date
        };
      }
    } else {
      // Create and store a new transaction
      const newTransaction = {
        id: generateUniqueId(),
        title: validatedData.title,
        amount: validatedData.amount,
        type: validatedData.type,
        category: validatedData.category,
        date: validatedData.date
      };
      transactions.push(newTransaction);
    }

    saveTransactionsToStorage();
    resetFormToDefault();
    updateDashboard();
  }

  // Loads a transaction into the form for editing
  function startEditingTransaction(id) {
    const target = transactions.find(function (txn) {
      return txn.id === id;
    });

    if (!target) {
      return;
    }

    editingTransactionId = target.id;
    clearValidationErrors();

    dom.titleInput.value = target.title;
    dom.amountInput.value = target.amount;
    dom.typeInput.value = target.type;
    populateCategoryOptions(target.type, target.category);
    dom.dateInput.value = target.date;

    dom.formHeading.textContent = "Edit Transaction";
    dom.submitBtn.textContent = "Save Changes";
    dom.editModeBadge.hidden = false;
    dom.cancelEditBtn.hidden = false;

    dom.titleInput.focus();
    dom.form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Prompts for confirmation and deletes a transaction by ID
  function deleteTransaction(id) {
    const target = transactions.find(function (txn) {
      return txn.id === id;
    });

    if (!target) {
      return;
    }

    const isConfirmed = window.confirm(
      `Are you sure you want to delete "${target.title}" (${formatCurrency(target.amount)})?`
    );

    if (!isConfirmed) {
      return;
    }

    transactions = transactions.filter(function (txn) {
      return txn.id !== id;
    });

    // If the user deleted the transaction currently being edited, reset the form
    if (editingTransactionId === id) {
      resetFormToDefault();
    }

    saveTransactionsToStorage();
    updateDashboard();
  }

  /* ==========================================================================
     Summary Calculations & Rendering
     ========================================================================== */

  // Calculates total income, total expenses, and net balance for any given list
  function calculateTotals(transactionList) {
    let income = 0;
    let expenses = 0;

    transactionList.forEach(function (txn) {
      if (txn.type === "income") {
        income += txn.amount;
      } else if (txn.type === "expense") {
        expenses += txn.amount;
      }
    });

    return {
      income: income,
      expenses: expenses,
      balance: income - expenses
    };
  }

  // Updates the top 3 Overall Summary cards
  function renderOverallSummary() {
    const totals = calculateTotals(transactions);

    dom.totalIncomeEl.textContent = formatCurrency(totals.income);
    dom.totalExpensesEl.textContent = formatCurrency(totals.expenses);
    dom.currentBalanceEl.textContent = formatCurrency(totals.balance);

    dom.currentBalanceEl.classList.remove("amount-income", "amount-expense");
    if (totals.balance > 0) {
      dom.currentBalanceEl.classList.add("amount-income");
    } else if (totals.balance < 0) {
      dom.currentBalanceEl.classList.add("amount-expense");
    }

    const totalCount = transactions.length;
    dom.totalCountBadge.textContent =
      totalCount === 1 ? "1 transaction" : `${totalCount} transactions`;
  }

  // Updates the Monthly Overview section for the selected YYYY-MM month
  function renderMonthlySummary() {
    const selectedMonth = dom.monthSelector.value; // e.g., "2026-10"

    if (!selectedMonth) {
      dom.monthlyIncomeEl.textContent = formatCurrency(0);
      dom.monthlyExpensesEl.textContent = formatCurrency(0);
      dom.monthlyBalanceEl.textContent = formatCurrency(0);
      dom.monthlyBalanceEl.classList.remove("amount-income", "amount-expense");
      return;
    }

    const monthlyTransactions = transactions.filter(function (txn) {
      return txn.date.slice(0, 7) === selectedMonth;
    });

    const monthlyTotals = calculateTotals(monthlyTransactions);

    dom.monthlyIncomeEl.textContent = formatCurrency(monthlyTotals.income);
    dom.monthlyExpensesEl.textContent = formatCurrency(monthlyTotals.expenses);
    dom.monthlyBalanceEl.textContent = formatCurrency(monthlyTotals.balance);

    dom.monthlyBalanceEl.classList.remove("amount-income", "amount-expense");
    if (monthlyTotals.balance > 0) {
      dom.monthlyBalanceEl.classList.add("amount-income");
    } else if (monthlyTotals.balance < 0) {
      dom.monthlyBalanceEl.classList.add("amount-expense");
    }
  }

  /* ==========================================================================
     Search, Filtering, Sorting & Table Rendering
     ========================================================================== */

  function getFilteredAndSortedTransactions() {
    const searchQuery = dom.searchInput.value.trim().toLowerCase();
    const selectedType = dom.filterType.value;
    const selectedCategory = dom.filterCategory.value;
    const sortOrder = dom.sortDate.value;

    const filtered = transactions.filter(function (txn) {
      const matchesTitle = txn.title.toLowerCase().includes(searchQuery);
      const matchesType = selectedType === "all" || txn.type === selectedType;
      const matchesCategory = selectedCategory === "all" || txn.category === selectedCategory;

      return matchesTitle && matchesType && matchesCategory;
    });

    filtered.sort(function (a, b) {
      if (a.date !== b.date) {
        return sortOrder === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      }
      return 0;
    });

    return filtered;
  }

  // Safely builds a <tr> element using createElement and textContent
  function createTransactionRow(txn) {
    const tr = document.createElement("tr");

    // 1. Date column
    const dateTd = document.createElement("td");
    dateTd.setAttribute("data-label", "Date");
    dateTd.textContent = formatReadableDate(txn.date);
    tr.appendChild(dateTd);

    // 2. Title column (safe textContent prevents XSS injection)
    const titleTd = document.createElement("td");
    titleTd.setAttribute("data-label", "Transaction");
    const titleStrong = document.createElement("strong");
    titleStrong.textContent = txn.title;
    titleTd.appendChild(titleStrong);
    tr.appendChild(titleTd);

    // 3. Category column
    const categoryTd = document.createElement("td");
    categoryTd.setAttribute("data-label", "Category");
    const categorySpan = document.createElement("span");
    categorySpan.className = "category-tag";
    categorySpan.textContent = txn.category;
    categoryTd.appendChild(categorySpan);
    tr.appendChild(categoryTd);

    // 4. Type column
    const typeTd = document.createElement("td");
    typeTd.setAttribute("data-label", "Type");
    const typeBadge = document.createElement("span");
    typeBadge.className = `type-badge type-badge-${txn.type}`;
    typeBadge.textContent = txn.type === "income" ? "Income" : "Expense";
    typeTd.appendChild(typeBadge);
    tr.appendChild(typeTd);

    // 5. Amount column
    const amountTd = document.createElement("td");
    amountTd.setAttribute("data-label", "Amount");
    amountTd.className = `cell-amount ${
      txn.type === "income" ? "amount-income" : "amount-expense"
    }`;
    amountTd.textContent = formatSignedCurrency(txn.amount, txn.type);
    tr.appendChild(amountTd);

    // 6. Actions column (Edit & Delete buttons)
    const actionsTd = document.createElement("td");
    actionsTd.setAttribute("data-label", "Actions");
    actionsTd.className = "cell-actions";

    const actionGroup = document.createElement("div");
    actionGroup.className = "action-group";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-action";
    editBtn.textContent = "Edit";
    editBtn.setAttribute("aria-label", `Edit ${txn.title}`);
    editBtn.addEventListener("click", function () {
      startEditingTransaction(txn.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-action btn-action-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete ${txn.title}`);
    deleteBtn.addEventListener("click", function () {
      deleteTransaction(txn.id);
    });

    actionGroup.appendChild(editBtn);
    actionGroup.appendChild(deleteBtn);
    actionsTd.appendChild(actionGroup);
    tr.appendChild(actionsTd);

    return tr;
  }

  // Renders the transaction table or shows the appropriate empty state
  function renderTransactionHistory() {
    const visibleTransactions = getFilteredAndSortedTransactions();
    dom.transactionsTbody.textContent = "";

    // Case 1: No transactions exist in storage at all
    if (transactions.length === 0) {
      dom.tableContainer.hidden = true;
      dom.emptyState.hidden = false;
      dom.emptyStateTitle.textContent = "No transactions recorded yet";
      dom.emptyStateText.textContent =
        "Use the form on the left to add your first income or expense entry.";
      dom.visibleCountText.textContent = "0 transactions";
      return;
    }

    // Case 2: Transactions exist, but none match current search/filter criteria
    if (visibleTransactions.length === 0) {
      dom.tableContainer.hidden = true;
      dom.emptyState.hidden = false;
      dom.emptyStateTitle.textContent = "No matching transactions";
      dom.emptyStateText.textContent =
        "Try adjusting your search text or clearing the active filters.";
      dom.visibleCountText.textContent = `Showing 0 of ${transactions.length} transactions`;
      return;
    }

    // Case 3: Render matching rows
    dom.tableContainer.hidden = false;
    dom.emptyState.hidden = true;
    dom.visibleCountText.textContent = `Showing ${visibleTransactions.length} of ${transactions.length} transactions`;

    const fragment = document.createDocumentFragment();
    visibleTransactions.forEach(function (txn) {
      fragment.appendChild(createTransactionRow(txn));
    });

    dom.transactionsTbody.appendChild(fragment);
  }

  // Resets search, filter, and sort controls back to defaults
  function resetFilters() {
    dom.searchInput.value = "";
    dom.filterType.value = "all";
    dom.filterCategory.value = "all";
    dom.sortDate.value = "newest";
    renderTransactionHistory();
  }

  // Master render function to refresh all UI sections together
  function updateDashboard() {
    renderOverallSummary();
    renderMonthlySummary();
    renderTransactionHistory();
  }

  /* ==========================================================================
     Event Listeners & Application Initialisation
     ========================================================================== */

  function setupEventListeners() {
    // Theme toggle button
    dom.themeToggleBtn.addEventListener("click", toggleTheme);

    // Update category options when switching between Expense and Income
    dom.typeInput.addEventListener("change", function () {
      populateCategoryOptions(dom.typeInput.value);
    });

    // Form submit and cancel edit buttons
    dom.form.addEventListener("submit", handleFormSubmit);
    dom.cancelEditBtn.addEventListener("click", resetFormToDefault);

    // Monthly overview month selector
    dom.monthSelector.addEventListener("change", renderMonthlySummary);

    // Search, filters, and sort controls
    dom.searchInput.addEventListener("input", renderTransactionHistory);
    dom.filterType.addEventListener("change", renderTransactionHistory);
    dom.filterCategory.addEventListener("change", renderTransactionHistory);
    dom.sortDate.addEventListener("change", renderTransactionHistory);
    dom.resetFiltersBtn.addEventListener("click", resetFilters);
  }

  function initApp() {
    initTheme();
    dom.monthSelector.value = getCurrentMonthString();
    resetFormToDefault();

    transactions = loadTransactionsFromStorage();
    setupEventListeners();
    updateDashboard();
  }

  // Start the application once the deferred script executes
  initApp();
})();