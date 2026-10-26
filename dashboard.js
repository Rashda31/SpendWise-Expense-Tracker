const STORAGE_KEYS = {
  USERS: "spendwise_users",
  SESSION: "spendwise_session",
  THEME: "spendwise_theme",
  LEGACY_KEYS: ["spendwise_transactions", "transactions"]
};

let currentUser = null;
let userTransactions = [];

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  // 1. Verify active login session
  if (!enforceAuthenticatedSession()) {
    return;
  }

  // 2. Migrate any legacy non-scoped transactions if needed & load user transactions
  loadUserTransactionsWithMigration();

  // 3. Initialize UI components
  renderUserProfileUI();
  setDefaultFormDateAndMonth();
  setupProfileDropdownAndModal();
  setupTransactionForm();
  setupFiltersAndMonthlyOverview();

  // 4. Perform initial dashboard calculation & render
  refreshDashboardView();
});

/**
 * Prevents direct access to dashboard.html without a valid session in LocalStorage
 */
function enforceAuthenticatedSession() {
  try {
    const rawSession = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!rawSession) {
      window.location.replace("./login.html?auth=required");
      return false;
    }

    const session = JSON.parse(rawSession);
    const users = getRegisteredUsers();
    const matchedUser = users.find((u) => u.id === session.userId);

    if (!matchedUser) {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      window.location.replace("./login.html?auth=required");
      return false;
    }

    currentUser = matchedUser;
    return true;
  } catch (err) {
    console.error("Session validation failed:", err);
    window.location.replace("./login.html?auth=required");
    return false;
  }
}

function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveRegisteredUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getUserTransactionKey(userId) {
  return `spendwise_tx_${userId}`;
}

/**
 * Safely loads transactions for the logged-in user and preserves legacy transactions
 * if the user upgraded from a single-user version of SpendWise.
 */
function loadUserTransactionsWithMigration() {
  const userKey = getUserTransactionKey(currentUser.id);
  const existingScopedRaw = localStorage.getItem(userKey);

  if (existingScopedRaw !== null) {
    try {
      const parsed = JSON.parse(existingScopedRaw);
      userTransactions = Array.isArray(parsed) ? parsed : [];
      return;
    } catch (e) {
      userTransactions = [];
    }
  }

  // Check if legacy un-scoped transactions exist and haven't been migrated yet
  const migrationFlag = localStorage.getItem("spendwise_legacy_migrated");
  if (!migrationFlag) {
    for (const legacyKey of STORAGE_KEYS.LEGACY_KEYS) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        try {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            userTransactions = parsedLegacy.map((item, idx) => ({
              id: item.id || `migrated_${Date.now()}_${idx}`,
              title: String(item.title || item.description || item.text || "Transaction"),
              amount: Math.abs(Number(item.amount) || 0),
              type:
                item.type === "income" || Number(item.amount) > 0 && item.type !== "expense"
                  ? "income"
                  : "expense",
              category: item.category || "Other",
              date: item.date || new Date().toISOString().split("T")[0],
              notes: item.notes || ""
            }));
            saveUserTransactions();
            localStorage.setItem("spendwise_legacy_migrated", currentUser.id);
            showToast("Existing SpendWise transactions were safely linked to your account.");
            return;
          }
        } catch (err) {
          console.warn("Could not parse legacy key:", legacyKey, err);
        }
      }
    }
  }

  userTransactions = [];
  saveUserTransactions();
}

function saveUserTransactions() {
  if (!currentUser) return;
  const userKey = getUserTransactionKey(currentUser.id);
  localStorage.setItem(userKey, JSON.stringify(userTransactions));
}

/**
 * Formats numbers in Indian Rupee (INR) currency style
 */
function formatINR(amount) {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric);
}

/**
 * Updates all DOM elements displaying the user's name, initials, email, and budget target
 */
function renderUserProfileUI() {
  if (!currentUser) return;

  const firstName = currentUser.fullName.trim().split(/\s+/)[0] || currentUser.fullName;
  const initials = currentUser.fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.getElementById("welcomeUserName").textContent = firstName;
  document.getElementById("navUserName").textContent = firstName;
  document.getElementById("userAvatarInitials").textContent = initials || "U";
  document.getElementById("dropdownUserName").textContent = currentUser.fullName;
  document.getElementById("dropdownUserEmail").textContent = currentUser.email;
}

/**
 * Theme initialization and toggle
 */
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "light";
  applyTheme(savedTheme);

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEYS.THEME, next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  if (icon && label) {
    if (theme === "dark") {
      icon.textContent = "☀️";
      label.textContent = "Light Mode";
    } else {
      icon.textContent = "🌙";
      label.textContent = "Dark Mode";
    }
  }
}

/**
 * Sets default transaction date to today and overview month to current YYYY-MM
 */
function setDefaultFormDateAndMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const txDate = document.getElementById("txDate");
  if (txDate && !txDate.value) {
    txDate.value = `${yyyy}-${mm}-${dd}`;
  }

  const overviewMonthInput = document.getElementById("overviewMonthInput");
  if (overviewMonthInput && !overviewMonthInput.value) {
    overviewMonthInput.value = `${yyyy}-${mm}`;
  }
}

/**
 * Top-Right Profile Dropdown, Logout, and Edit Profile Modal
 */
function setupProfileDropdownAndModal() {
  const profileMenuBtn = document.getElementById("profileMenuBtn");
  const profileDropdown = document.getElementById("profileDropdown");
  const openEditProfileBtn = document.getElementById("openEditProfileBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const modal = document.getElementById("editProfileModal");
  const closeModalBtn = document.getElementById("closeProfileModalBtn");
  const cancelModalBtn = document.getElementById("cancelProfileModalBtn");
  const editProfileForm = document.getElementById("editProfileForm");

  // Toggle profile dropdown
  profileMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = profileDropdown.classList.toggle("hidden");
    profileMenuBtn.setAttribute("aria-expanded", String(!isHidden));
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileDropdown.classList.contains("hidden") && !e.target.closest("#profileMenuContainer")) {
      profileDropdown.classList.add("hidden");
      profileMenuBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Close dropdown or modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      profileDropdown.classList.add("hidden");
      profileMenuBtn.setAttribute("aria-expanded", "false");
      closeEditProfileModal();
    }
  });

  // Open Edit Profile Modal
  openEditProfileBtn.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
    profileMenuBtn.setAttribute("aria-expanded", "false");

    document.getElementById("profileFullName").value = currentUser.fullName;
    document.getElementById("profileEmail").value = currentUser.email;
    document.getElementById("profileMonthlyBudget").value =
      currentUser.monthlyBudget && currentUser.monthlyBudget > 0 ? currentUser.monthlyBudget : "";

    clearProfileModalErrors();
    modal.classList.remove("hidden");
    document.getElementById("profileFullName").focus();
  });

  closeModalBtn.addEventListener("click", closeEditProfileModal);
  cancelModalBtn.addEventListener("click", closeEditProfileModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeEditProfileModal();
    }
  });

  // Handle Edit Profile submission
  editProfileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearProfileModalErrors();

    const fullName = document.getElementById("profileFullName").value.trim();
    const email = document.getElementById("profileEmail").value.trim().toLowerCase();
    const rawBudget = document.getElementById("profileMonthlyBudget").value.trim();
    const monthlyBudget = rawBudget ? Number(rawBudget) : 0;

    let isValid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!fullName || fullName.length < 2) {
      document.getElementById("profileFullNameError").textContent =
        "Full name must be at least 2 characters.";
      isValid = false;
    }

    if (!email || !emailRegex.test(email)) {
      document.getElementById("profileEmailError").textContent =
        "Please enter a valid email address.";
      isValid = false;
    }

    if (rawBudget && (isNaN(monthlyBudget) || monthlyBudget < 0)) {
      document.getElementById("profileBudgetError").textContent =
        "Budget must be a positive number.";
      isValid = false;
    }

    if (!isValid) return;

    const users = getRegisteredUsers();
    const duplicateUser = users.find(
      (u) => u.email.toLowerCase() === email && u.id !== currentUser.id
    );

    if (duplicateUser) {
      const alertEl = document.getElementById("profileModalAlert");
      alertEl.textContent = "Another account is already using that email address.";
      alertEl.className = "alert-box error";
      return;
    }

    // Update user record in users list
    const userIndex = users.findIndex((u) => u.id === currentUser.id);
    if (userIndex !== -1) {
      users[userIndex].fullName = fullName;
      users[userIndex].email = email;
      users[userIndex].monthlyBudget = monthlyBudget;
      saveRegisteredUsers(users);
      currentUser = users[userIndex];
    }

    // Update active session
    const updatedSession = {
      userId: currentUser.id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedSession));

    renderUserProfileUI();
    refreshDashboardView();
    closeEditProfileModal();
    showToast("Your profile has been updated!");
  });

  // Handle Logout (clears active session without deleting registered account or transactions)
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    window.location.href = "./login.html?logout=1";
  });
}

function closeEditProfileModal() {
  const modal = document.getElementById("editProfileModal");
  if (modal) modal.classList.add("hidden");
}

function clearProfileModalErrors() {
  document.getElementById("profileFullNameError").textContent = "";
  document.getElementById("profileEmailError").textContent = "";
  document.getElementById("profileBudgetError").textContent = "";
  const alertEl = document.getElementById("profileModalAlert");
  alertEl.textContent = "";
  alertEl.className = "alert-box hidden";
}

/**
 * Sets up Add and Edit Transaction Form
 */
function setupTransactionForm() {
  const form = document.getElementById("transactionForm");
  const cancelEditBtn = document.getElementById("txCancelEditBtn");

  cancelEditBtn.addEventListener("click", () => {
    resetTransactionFormMode();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTxFormErrors();

    const editingId = document.getElementById("editingTransactionId").value;
    const title = document.getElementById("txTitle").value.trim();
    const rawAmount = document.getElementById("txAmount").value;
    const amount = parseFloat(rawAmount);
    const type = document.getElementById("txType").value;
    const category = document.getElementById("txCategory").value;
    const date = document.getElementById("txDate").value;
    const notes = document.getElementById("txNotes").value.trim();

    let isValid = true;

    if (!title) {
      document.getElementById("txTitleError").textContent = "Please enter a title.";
      isValid = false;
    }

    if (isNaN(amount) || amount <= 0) {
      document.getElementById("txAmountError").textContent = "Enter a valid amount greater than 0.";
      isValid = false;
    }

    if (!date) {
      document.getElementById("txDateError").textContent = "Please select a date.";
      isValid = false;
    }

    if (!isValid) return;

    if (editingId) {
      // Update existing transaction
      const index = userTransactions.findIndex((t) => t.id === editingId);
      if (index !== -1) {
        userTransactions[index] = {
          ...userTransactions[index],
          title,
          amount: Math.round(amount * 100) / 100,
          type,
          category,
          date,
          notes
        };
        showToast("Transaction updated successfully.");
      }
    } else {
      // Create new transaction
      const newTx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title,
        amount: Math.round(amount * 100) / 100,
        type,
        category,
        date,
        notes
      };
      userTransactions.push(newTx);
      showToast("Transaction added!");
    }

    saveUserTransactions();
    resetTransactionFormMode();
    refreshDashboardView();
  });
}

function clearTxFormErrors() {
  document.getElementById("txTitleError").textContent = "";
  document.getElementById("txAmountError").textContent = "";
  document.getElementById("txDateError").textContent = "";
}

function startEditingTransaction(txId) {
  const tx = userTransactions.find((item) => item.id === txId);
  if (!tx) return;

  document.getElementById("editingTransactionId").value = tx.id;
  document.getElementById("txTitle").value = tx.title;
  document.getElementById("txAmount").value = tx.amount;
  document.getElementById("txType").value = tx.type;
  document.getElementById("txCategory").value = tx.category;
  document.getElementById("txDate").value = tx.date;
  document.getElementById("txNotes").value = tx.notes || "";

  document.getElementById("transactionFormHeading").textContent = "Edit Transaction";
  document.getElementById("txSubmitBtn").textContent = "Update Transaction";
  document.getElementById("txCancelEditBtn").classList.remove("hidden");

  document.getElementById("txTitle").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetTransactionFormMode() {
  const form = document.getElementById("transactionForm");
  form.reset();
  clearTxFormErrors();
  document.getElementById("editingTransactionId").value = "";
  document.getElementById("transactionFormHeading").textContent = "Add New Transaction";
  document.getElementById("txSubmitBtn").textContent = "Add Transaction";
  document.getElementById("txCancelEditBtn").classList.add("hidden");
  setDefaultFormDateAndMonth();
}

function deleteTransaction(txId) {
  const target = userTransactions.find((item) => item.id === txId);
  if (!target) return;

  const confirmed = window.confirm(
    `Delete "${target.title}" (${formatINR(target.amount)})?`
  );
  if (!confirmed) return;

  userTransactions = userTransactions.filter((item) => item.id !== txId);
  saveUserTransactions();

  if (document.getElementById("editingTransactionId").value === txId) {
    resetTransactionFormMode();
  }

  refreshDashboardView();
  showToast("Transaction deleted.");
}

/**
 * Sets up Search, Filter, Sort, and Monthly Overview controls
 */
function setupFiltersAndMonthlyOverview() {
  const overviewMonthInput = document.getElementById("overviewMonthInput");
  const resetMonthBtn = document.getElementById("resetMonthBtn");
  const searchInput = document.getElementById("searchInput");
  const filterTypeSelect = document.getElementById("filterTypeSelect");
  const filterCategorySelect = document.getElementById("filterCategorySelect");
  const sortSelect = document.getElementById("sortSelect");

  overviewMonthInput.addEventListener("change", refreshDashboardView);
  resetMonthBtn.addEventListener("click", () => {
    overviewMonthInput.value = "";
    refreshDashboardView();
  });

  searchInput.addEventListener("input", renderTransactionHistory);
  filterTypeSelect.addEventListener("change", renderTransactionHistory);
  filterCategorySelect.addEventListener("change", renderTransactionHistory);
  sortSelect.addEventListener("change", renderTransactionHistory);
}

/**
 * Recalculates all summary cards, monthly overview stats, budget status, and transaction list
 */
function refreshDashboardView() {
  calculateOverallSummary();
  calculateMonthlyOverview();
  renderTransactionHistory();
}

function calculateOverallSummary() {
  let totalIncome = 0;
  let totalExpense = 0;

  userTransactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === "income") {
      totalIncome += amt;
    } else {
      totalExpense += amt;
    }
  });

  const netBalance = totalIncome - totalExpense;

  document.getElementById("totalBalance").textContent = formatINR(netBalance);
  document.getElementById("totalIncome").textContent = formatINR(totalIncome);
  document.getElementById("totalExpense").textContent = formatINR(totalExpense);
}

function calculateMonthlyOverview() {
  const monthFilter = document.getElementById("overviewMonthInput").value;
  let periodIncome = 0;
  let periodExpense = 0;

  const filtered = monthFilter
    ? userTransactions.filter((tx) => tx.date && tx.date.startsWith(monthFilter))
    : userTransactions;

  filtered.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === "income") {
      periodIncome += amt;
    } else {
      periodExpense += amt;
    }
  });

  const netFlow = periodIncome - periodExpense;
  const savingsRate =
    periodIncome > 0 ? Math.round(((periodIncome - periodExpense) / periodIncome) * 100) : 0;

  document.getElementById("monthlyIncomeVal").textContent = formatINR(periodIncome);
  document.getElementById("monthlyExpenseVal").textContent = formatINR(periodExpense);
  document.getElementById("monthlyNetVal").textContent = formatINR(netFlow);
  document.getElementById("monthlySavingsRate").textContent = `${savingsRate}%`;

  // Update optional Monthly Budget Status Pill in Welcome Banner
  const budgetPill = document.getElementById("budgetStatusBadge");
  if (currentUser && currentUser.monthlyBudget && currentUser.monthlyBudget > 0) {
    budgetPill.classList.remove("hidden");
    const pct = Math.round((periodExpense / currentUser.monthlyBudget) * 100);
    budgetPill.textContent = `Monthly Budget: ${formatINR(periodExpense)} / ${formatINR(
      currentUser.monthlyBudget
    )} (${pct}%)`;
  } else {
    budgetPill.classList.add("hidden");
  }
}

/**
 * Renders filtered and sorted transaction list
 */
function renderTransactionHistory() {
  const listEl = document.getElementById("transactionList");
  const emptyStateEl = document.getElementById("emptyStateBox");
  const countBadge = document.getElementById("txCountBadge");

  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const typeFilter = document.getElementById("filterTypeSelect").value;
  const categoryFilter = document.getElementById("filterCategorySelect").value;
  const sortMode = document.getElementById("sortSelect").value;

  const filtered = userTransactions.filter((tx) => {
    const matchesSearch =
      !query ||
      tx.title.toLowerCase().includes(query) ||
      tx.category.toLowerCase().includes(query) ||
      (tx.notes && tx.notes.toLowerCase().includes(query));

    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    const matchesCategory = categoryFilter === "all" || tx.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  // Sort transactions
  filtered.sort((a, b) => {
    if (sortMode === "date-desc") {
      return new Date(b.date) - new Date(a.date);
    }
    if (sortMode === "date-asc") {
      return new Date(a.date) - new Date(b.date);
    }
    if (sortMode === "amount-desc") {
      return b.amount - a.amount;
    }
    if (sortMode === "amount-asc") {
      return a.amount - b.amount;
    }
    return 0;
  });

  countBadge.textContent = String(filtered.length);
  listEl.innerHTML = "";

  if (filtered.length === 0) {
    emptyStateEl.classList.remove("hidden");
    return;
  }

  emptyStateEl.classList.add("hidden");

  filtered.forEach((tx) => {
    const li = document.createElement("li");
    li.className = `tx-item ${tx.type}`;

    const sign = tx.type === "income" ? "+" : "-";
    const amountClass = tx.type === "income" ? "income-text" : "expense-text";

    const infoDiv = document.createElement("div");
    infoDiv.className = "tx-info";

    const titleRow = document.createElement("div");
    titleRow.className = "tx-title-row";

    const titleSpan = document.createElement("span");
    titleSpan.className = "tx-title";
    titleSpan.textContent = tx.title;

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "tx-badge";
    badgeSpan.textContent = tx.category;

    titleRow.appendChild(titleSpan);
    titleRow.appendChild(badgeSpan);

    const metaP = document.createElement("p");
    metaP.className = "tx-meta";
    metaP.textContent = tx.notes ? `${tx.date} • ${tx.notes}` : tx.date;

    infoDiv.appendChild(titleRow);
    infoDiv.appendChild(metaP);

    const rightDiv = document.createElement("div");
    rightDiv.className = "tx-right";

    const amountSpan = document.createElement("span");
    amountSpan.className = `tx-amount ${amountClass}`;
    amountSpan.textContent = `${sign}${formatINR(tx.amount)}`;

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "tx-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "action-icon-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEditingTransaction(tx.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "action-icon-btn delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteTransaction(tx.id));

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    rightDiv.appendChild(amountSpan);
    rightDiv.appendChild(actionsDiv);

    li.appendChild(infoDiv);
    li.appendChild(rightDiv);

    listEl.appendChild(li);
  });
}

function showToast(message) {
  const toast = document.getElementById("dashboardToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(window.spendwiseToastTimer);
  window.spendwiseToastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3200);
}