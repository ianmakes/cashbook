// app.js - Main Application Coordinator for Aura Ledger PWA

// Global State
let appState = {
  currentTab: 'dashboard',
  baseCurrency: 'USD',
  user: null,
  transactions: [],
  accounts: [],
  cashbooks: [],
  budgets: [],
  goals: [],
  subscriptions: [],
  categories: {},
  exchangeRates: {},
  receiptBase64: null,
  activeCharts: {} // Keep track of Chart instances to prevent canvas hover overlapping
};

// ==========================================
// PWA SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully:', reg.scope);
        
        // Actively check for service worker updates on page load
        reg.update();

        // Check if there is an update already waiting
        if (reg.waiting) {
          console.log('[PWA] New service worker is waiting. Activating...');
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Listen for new service worker installation
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA] New content is available; reloading page to apply update...');
                  window.location.reload();
                } else {
                  console.log('[PWA] Content is cached for offline use.');
                }
              }
            };
          }
        };
      })
      .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
  });

  // Reload the page when a new Service Worker takes over
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[PWA] Controller changed; reloading page...');
      window.location.reload();
    }
  });
}

// ==========================================
// FIREBASE AUTH VISUAL MOCKUPS
// ==========================================
function switchAuthTab(method) {
  // Toggle active tab class
  document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${method}`).classList.add('active');

  // Toggle visible sections
  document.querySelectorAll('.auth-method-section').forEach(sec => sec.style.display = 'none');
  document.getElementById(`auth-sec-${method}`).style.display = 'block';
}

function sendMockOtp() {
  const phone = document.getElementById('auth-phone-input').value;
  if (!phone) {
    showDrawerAlert('Please enter a valid phone number.');
    return;
  }
  
  // Slide out phone trigger button, slide in OTP Virtual Keypad
  document.getElementById('send-otp-btn').style.display = 'none';
  document.getElementById('otp-entry-box').style.display = 'block';
  
  // Show a helpful mock prompt simulating an SMS delivery
  showDrawerAlert(`[Aura Ledger Mock OTP] SMS verification code sent to ${phone}. Enter Code "2605" to authorize.`);
  document.getElementById('auth-otp-input').value = '';
}

function pressOtpKey(num) {
  const input = document.getElementById('auth-otp-input');
  if (input.value.length < 6) {
    input.value += num;
  }
}

function clearOtpKey() {
  const input = document.getElementById('auth-otp-input');
  input.value = input.value.slice(0, -1);
}

function triggerMockAuth(methodName) {
  const emailEl = document.getElementById('auth-email-input');
  const emailInput = emailEl ? emailEl.value : '';

  let displayName = 'Secure Owner';
  let authDetail = methodName;

  if (methodName === 'Email') {
    if (!emailInput) {
      showDrawerAlert('Please input email');
      return;
    }
    displayName = emailInput.split('@')[0];
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    authDetail = `Email: ${emailInput}`;
  }

  // Save session details to state
  appState.user = { displayName, authDetail };
  
  // Cache user state in localStorage
  localStorage.setItem('aura_user_session', JSON.stringify(appState.user));
  
  hideAuthScreen();
  initializeDashboardData();
}

function bypassAuth() {
  appState.user = {
    displayName: 'Guest Owner',
    authDetail: 'Offline Local Sandbox'
  };
  localStorage.setItem('aura_user_session', JSON.stringify(appState.user));
  hideAuthScreen();
  initializeDashboardData();
}

function hideAuthScreen() {
  const authOverlay = document.getElementById('auth-overlay');
  authOverlay.style.opacity = '0';
  setTimeout(() => {
    authOverlay.style.display = 'none';
  }, 500);
}

function logout() {
  localStorage.removeItem('aura_user_session');
  appState.user = null;
  
  // Show auth view
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) {
    authOverlay.style.display = 'flex';
    setTimeout(() => {
      authOverlay.style.opacity = '1';
    }, 50);
  }
}

// ==========================================
// TABS & NAVIGATION CONTROLLER
// ==========================================
function switchTab(tabId) {
  // If hash routing is not set to this tab, update it and return.
  // Let the popstate/hashchange event call switchTab securely.
  if (window.location.hash !== `#/${tabId}`) {
    window.location.hash = `#/${tabId}`;
    return;
  }

  appState.currentTab = tabId;
  
  // Toggle desktop sidebar active buttons
  document.querySelectorAll('.nav-link-btn').forEach(btn => {
    btn.classList.remove('active');
    const onClickAttr = btn.getAttribute('onclick');
    if (onClickAttr && onClickAttr.includes(tabId)) btn.classList.add('active');
  });

  // Toggle mobile bottom nav active buttons
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.id === `mob-nav-${tabId === 'budgets-goals' ? 'budgets' : tabId}`) btn.classList.add('active');
  });

  // Toggle layouts
  document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.classList.add('active');

  // Update header title
  const formattedTitle = tabId.charAt(0).toUpperCase() + tabId.slice(1).replace('-', ' & ');
  const titleEl = document.getElementById('current-view-title');
  if (titleEl) titleEl.innerText = formattedTitle;

  // Refresh tab-specific dynamic panels
  refreshActiveViewData(tabId);
}

// ==========================================
// CLIENT-SIDE HASH ROUTER
// ==========================================
function handleRouting() {
  const hash = window.location.hash || '#/dashboard';
  const tabId = hash.replace('#/', '');
  
  const validTabs = ['dashboard', 'cashbooks', 'subscriptions', 'budgets-goals', 'reports', 'settings'];
  if (validTabs.includes(tabId)) {
    switchTab(tabId);
  } else {
    window.location.hash = '#/dashboard';
  }
}

window.addEventListener('hashchange', handleRouting);

// Refresh triggers
function refreshActiveViewData(tabId) {
  switch (tabId) {
    case 'dashboard':
      renderDashboardOverview();
      break;
    case 'cashbooks':
      renderCashbooksTab();
      break;
    case 'subscriptions':
      renderSubscriptionsTab();
      break;
    case 'budgets-goals':
      renderBudgetsGoalsTab();
      break;
    case 'reports':
      renderReportsTab();
      break;
    case 'settings':
      renderSettingsTab();
      break;
  }
}

// ==========================================
// CORE DATA LOADING
// ==========================================
async function initializeDashboardData() {
  // Render user names
  if (appState.user) {
    const displayNameEl = document.getElementById('user-display-name');
    if (displayNameEl) displayNameEl.innerText = appState.user.displayName;
    
    // Auth Detail text could contain email or a description
    const detail = appState.user.authDetail || appState.user.email || 'Offline Sandbox';
    const authMethodEl = document.getElementById('user-auth-method');
    if (authMethodEl) authMethodEl.innerText = detail;
    
    // Initials
    const avatarVal = appState.user.avatar || appState.user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarLettersEl = document.getElementById('avatar-letters');
    if (avatarLettersEl) avatarLettersEl.innerText = avatarVal || 'AL';
  }

  // Load ALL datasets in parallel to achieve maximum efficiency and speed!
  const [transactions, accounts, cashbooks, budgets, goals, subscriptions, categories, settings] = await Promise.all([
    window.StorageService.getTransactions(),
    window.StorageService.getAccounts(),
    window.StorageService.getCashbooks(),
    window.StorageService.getBudgets(),
    window.StorageService.getGoals(),
    window.StorageService.getSubscriptions(),
    window.StorageService.getCategories(),
    window.StorageService.getSettings()
  ]);

  appState.transactions = transactions;
  appState.accounts = accounts;
  appState.cashbooks = cashbooks;
  appState.budgets = budgets;
  appState.goals = goals;
  appState.subscriptions = subscriptions;
  appState.categories = categories;
  
  appState.baseCurrency = settings.baseCurrency;
  appState.exchangeRates = settings.exchangeRates;
  
  // Custom dynamic branding properties
  appState.appName = settings.appName || 'Aura Ledger';
  appState.appDescription = settings.appDescription || 'Secure, Modern Cash Book & Wealth Tracker';
  appState.appFavicon = settings.appFavicon || '';
  appState.appLogo = settings.appLogo || '';
  appState.appPrimaryColor = settings.appPrimaryColor || '#FCD535';

  // Apply dynamic settings globally in real time
  applyGeneralSettings();

  // Sync Base Currency dropdown default
  const baseCurrencySelect = document.getElementById('header-base-currency-select');
  if (baseCurrencySelect) baseCurrencySelect.value = appState.baseCurrency;

  // Render current tab views
  switchTab(appState.currentTab);
  
  // Seed dynamic input selectors for transaction forms
  populateFormSelectors();
}

function populateFormSelectors() {
  // Accounts selectors
  const txAccSelect = document.getElementById('tx-account');
  const subAccSelect = document.getElementById('sub-account-input');
  
  const accountOptions = appState.accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency})</option>`).join('');
  txAccSelect.innerHTML = accountOptions;
  subAccSelect.innerHTML = accountOptions;

  // Streams / Cashbooks
  const txCbSelect = document.getElementById('tx-cashbook');
  txCbSelect.innerHTML = appState.cashbooks.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

  // Settings filter cashbook selectors
  const filterCb = document.getElementById('filter-cashbook');
  filterCb.innerHTML = '<option value="all">All Streams</option>' + 
    appState.cashbooks.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

  // Budget settings category selectors
  const bgCatSelect = document.getElementById('bg-cat-input');
  bgCatSelect.innerHTML = appState.categories.expense.map(cat => `<option value="${cat}">${cat}</option>`).join('');

  // Initial category load for default expense view
  toggleFormFlowCategory('expense');

  // Initialize the realtime converter block state based on first account
  if (txAccSelect.value) {
    handleAccountChange(txAccSelect.value);
  }
}

function toggleFormFlowCategory(type) {
  const txCatSelect = document.getElementById('tx-category');
  const list = type === 'income' ? appState.categories.income : appState.categories.expense;
  txCatSelect.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ==========================================
// VALUE EXCHANGE & CONVERSION HELPERS
// ==========================================
function convertValue(amount, fromCurrency, toCurrency, customRate = null) {
  if (fromCurrency === toCurrency) return amount;
  
  if (toCurrency === appState.baseCurrency && customRate !== null && customRate !== undefined) {
    return amount * parseFloat(customRate);
  }
  
  const rateFrom = appState.exchangeRates[fromCurrency] || 1;
  const rateTo = appState.exchangeRates[toCurrency] || 1;

  // conversion math: convert fromCurrency to base KES (multiply by rateFrom) then convert to toCurrency (divide by rateTo)
  return (amount * rateFrom) / rateTo;
}

function formatCurrency(amount, currencyCode) {
  const symbols = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh', JPY: '¥' };
  const symbol = symbols[currencyCode] || currencyCode;
  
  let formatted = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currencyCode === 'KES') {
    return `${symbol} ${formatted}`;
  }
  return `${amount < 0 ? '-' : ''}${symbol}${formatted}`;
}

// ==========================================
// VIEW RENDERING: DASHBOARD
// ==========================================
function renderDashboardOverview() {
  // 1. Calculate Net Worth (Convert all accounts to baseCurrency)
  let totalNet = 0;
  appState.accounts.forEach(acc => {
    totalNet += convertValue(acc.balance, acc.currency, appState.baseCurrency);
  });
  document.getElementById('kpi-networth').innerText = formatCurrency(totalNet, appState.baseCurrency);

  // 2. Monthly Income vs Expenses (for current calendar month)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  let totalIncomeThisMonth = 0;
  let totalExpenseThisMonth = 0;

  appState.transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
      const convertedVal = convertValue(tx.amount, tx.currency, appState.baseCurrency, tx.customRate);
      if (tx.type === 'income') {
        totalIncomeThisMonth += convertedVal;
      } else {
        totalExpenseThisMonth += convertedVal;
      }
    }
  });

  document.getElementById('kpi-income').innerText = formatCurrency(totalIncomeThisMonth, appState.baseCurrency);
  document.getElementById('kpi-expense').innerText = formatCurrency(totalExpenseThisMonth, appState.baseCurrency);

  // Set subtext month label
  const monthName = now.toLocaleString('default', { month: 'long' });
  document.getElementById('kpi-income-sub').innerText = `Income in ${monthName}`;
  document.getElementById('kpi-expense-sub').innerText = `Outflow in ${monthName}`;

  // 3. Subscriptions Due in Next 30 Days
  let subDueTotal = 0;
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + 30);

  appState.subscriptions.forEach(sub => {
    const billDate = new Date(sub.nextBill);
    if (billDate >= now && billDate <= limitDate) {
      subDueTotal += convertValue(sub.amount, sub.currency, appState.baseCurrency);
    }
  });
  document.getElementById('kpi-subs').innerText = formatCurrency(subDueTotal, appState.baseCurrency);

  // 4. Render feed lists
  renderDashboardTransactionsFeed();
  renderDashboardBudgetsList();
  renderDashboardGoalsList();
}

function renderDashboardTransactionsFeed() {
  const container = document.getElementById('dashboard-tx-feed');
  
  // Show only 5 most recent records
  const recent = appState.transactions.slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <p>No transaction records found. Add one above!</p>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(tx => {
    const account = appState.accounts.find(a => a.id === tx.accountId);
    const currency = account ? account.currency : tx.currency;
    const isIncome = tx.type === 'income';
    const amountClass = isIncome ? 'income' : 'expense';
    const sign = isIncome ? '+' : '-';
    
    // Receipt thumbnail action button
    const receiptHtml = tx.receipt 
      ? `<button class="tx-receipt-indicator" onclick="viewReceiptImage('${tx.id}')"><i class="fa-solid fa-receipt"></i></button>`
      : '';

    return `
      <div class="tx-feed-item">
        <div class="tx-category-badge ${amountClass}">
          <i class="${isIncome ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down'}"></i>
        </div>
        <div class="tx-details">
          <div class="tx-meta-row">
            <span class="tx-title">${tx.description || tx.category}</span>
            <span class="tx-tag" style="border-radius: 4px;">${tx.category}</span>
          </div>
          <span class="tx-desc">${account ? account.name : 'Unknown Account'}</span>
        </div>
        <div class="tx-feed-right">
          <span class="tx-amount ${amountClass}">
            ${isIncome ? '<i class="fa-solid fa-caret-up" style="color: var(--income-green); margin-right: 4px;"></i>' : '<i class="fa-solid fa-caret-down" style="color: var(--expense-rose); margin-right: 4px;"></i>'}
            ${sign}${formatCurrency(tx.amount, currency)}
          </span>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${receiptHtml}
            <span class="tx-date-badge">${tx.date}</span>
            <button class="tx-delete-btn" onclick="deleteLedgerTx('${tx.id}')" title="Delete record">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderDashboardBudgetsList() {
  const container = document.getElementById('dashboard-budgets-list');
  
  // Show top 3 budgets
  const subBudgets = appState.budgets.slice(0, 3);
  
  if (subBudgets.length === 0) {
    container.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">No active category budgets set.</p>`;
    return;
  }

  // Calculate actual category spending for current calendar month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  container.innerHTML = subBudgets.map(bg => {
    let spent = 0;
    appState.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (tx.type === 'expense' && tx.category === bg.category &&
          txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
        spent += convertValue(tx.amount, tx.currency, appState.baseCurrency, tx.customRate);
      }
    });

    const percent = bg.limit > 0 ? Math.min(100, Math.round((spent / bg.limit) * 100)) : 0;
    let fillClass = '';
    if (percent >= 100) fillClass = 'alarm';
    else if (percent >= 75) fillClass = 'warning';

    return `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="font-weight: 600;">${bg.category}</span>
          <span style="color: var(--text-secondary);">${formatCurrency(spent, appState.baseCurrency)} / ${formatCurrency(bg.limit, appState.baseCurrency)}</span>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill ${fillClass}" style="width: ${percent}%;"></div>
        </div>
      </div>`;
  }).join('');
}

function renderDashboardGoalsList() {
  const container = document.getElementById('dashboard-goals-list');
  const subGoals = appState.goals.slice(0, 2);

  if (subGoals.length === 0) {
    container.innerHTML = `<p style="font-size: 12px; color: var(--text-muted);">No savings goals set.</p>`;
    return;
  }

  container.innerHTML = subGoals.map(g => {
    const percent = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="font-weight: 600;">${g.name}</span>
          <span style="color: var(--text-secondary);">${percent}%</span>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill" style="width: ${percent}%; background: var(--income-green);"></div>
        </div>
      </div>`;
  }).join('');
}

// ==========================================
// VIEW RENDERING: CASHBOOKS TAB
// ==========================================
function renderCashbooksTab() {
  const grid = document.getElementById('cashbooks-grid');
  
  if (appState.cashbooks.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No income stream channels. Create one!</p></div>`;
    return;
  }

  grid.innerHTML = appState.cashbooks.map(cb => {
    // Sum total items recorded in this specific cashbook (converted to baseCurrency)
    let totalBal = 0;
    appState.transactions.forEach(tx => {
      if (tx.cashbookId === cb.id) {
        const converted = convertValue(tx.amount, tx.currency, appState.baseCurrency, tx.customRate);
        if (tx.type === 'income') totalBal += converted;
        else totalBal -= converted;
      }
    });

    return `
      <div class="stream-card" onclick="openCashbookDetail('${cb.id}')">
        <button class="stream-delete-btn" onclick="deleteLedgerCb(event, '${cb.id}')" title="Delete Stream">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="stream-card-header">
          <div class="stream-icon-box">${cb.icon || '💼'}</div>
        </div>
        <div class="stream-card-body">
          <h3>${cb.name}</h3>
          <p>${cb.description || 'Custom ledger income stream'}</p>
        </div>
        <div class="stream-balance-row">
          <span class="stream-bal-title">Net Cash Flow</span>
          <span class="stream-bal-val" style="color: ${totalBal < 0 ? 'var(--expense-rose)' : 'var(--income-green)'};">
            ${formatCurrency(totalBal, appState.baseCurrency)}
          </span>
        </div>
      </div>`;
  }).join('');

  // Also refresh Account balances cards
  renderAccountsGrid();
}

function renderAccountsGrid() {
  const grid = document.getElementById('accounts-grid');
  
  if (appState.accounts.length === 0) {
    grid.innerHTML = `<p>No active currency accounts configurer.</p>`;
    return;
  }

  grid.innerHTML = appState.accounts.map(acc => {
    return `
      <div class="account-card">
        <span class="account-currency">${acc.currency}</span>
        <div class="account-bal-val">${formatCurrency(acc.balance, acc.currency)}</div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
          <span class="account-name">${acc.name}</span>
          <button class="tx-delete-btn" onclick="deleteAccount('${acc.id}')" title="Wipe account" style="padding: 2px 6px;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

// ==========================================
// VIEW RENDERING: SUBSCRIPTIONS TAB
// ==========================================
function renderSubscriptionsTab() {
  const container = document.getElementById('subscriptions-list');
  
  if (appState.subscriptions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-calendar-minus"></i>
        <p>No active subscriptions scheduler active.</p>
      </div>`;
    
    document.getElementById('forecast-30d').innerText = formatCurrency(0, appState.baseCurrency);
    document.getElementById('forecast-6m').innerText = formatCurrency(0, appState.baseCurrency);
    document.getElementById('forecast-1y').innerText = formatCurrency(0, appState.baseCurrency);
    return;
  }

  // Draw scheduled list
  container.innerHTML = appState.subscriptions.map(sub => {
    const acc = appState.accounts.find(a => a.id === sub.accountId);
    const currency = acc ? acc.currency : sub.currency;

    return `
      <div class="sub-item-card">
        <div class="sub-item-left">
          <span style="font-size:20px;">🗓️</span>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-weight:600; font-size:14px;">${sub.name}</span>
            <span class="sub-bill-date">Next bill: ${sub.nextBill}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:16px;">
          <span class="sub-freq-tag">${sub.frequency}</span>
          <span class="tx-amount" style="font-size: 14px; font-weight:700;">${formatCurrency(sub.amount, currency)}</span>
          <button class="tx-delete-btn" onclick="deleteSubscription('${sub.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>`;
  }).join('');

  // Subscription Outlook Cost Forecasting calculations
  let cost30d = 0;
  let cost6m = 0;
  let cost1y = 0;

  appState.subscriptions.forEach(sub => {
    const convertedAmount = convertValue(sub.amount, sub.currency, appState.baseCurrency);
    
    // Calculations based on frequency multipliers
    if (sub.frequency === 'weekly') {
      cost30d += convertedAmount * 4.33;
      cost6m += convertedAmount * 26;
      cost1y += convertedAmount * 52;
    } else if (sub.frequency === 'monthly') {
      cost30d += convertedAmount;
      cost6m += convertedAmount * 6;
      cost1y += convertedAmount * 12;
    } else if (sub.frequency === 'annually') {
      // Annual charges only trigger once. If next bill occurs in 30 days we list it in monthly, but for forecast we smooth average
      cost30d += convertedAmount / 12;
      cost6m += convertedAmount / 2;
      cost1y += convertedAmount;
    }
  });

  document.getElementById('forecast-30d').innerText = formatCurrency(cost30d, appState.baseCurrency);
  document.getElementById('forecast-6m').innerText = formatCurrency(cost6m, appState.baseCurrency);
  document.getElementById('forecast-1y').innerText = formatCurrency(cost1y, appState.baseCurrency);
}

// ==========================================
// VIEW RENDERING: BUDGETS & SAVINGS GOALS
// ==========================================
function renderBudgetsGoalsTab() {
  // 1. Budgets render
  const budgetContainer = document.getElementById('budgets-grid');
  
  if (appState.budgets.length === 0) {
    budgetContainer.innerHTML = `<div class="empty-state"><p>No monthly category bounds set.</p></div>`;
  } else {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    budgetContainer.innerHTML = appState.budgets.map(bg => {
      let spent = 0;
      appState.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === 'expense' && tx.category === bg.category &&
            txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
          spent += convertValue(tx.amount, tx.currency, appState.baseCurrency, tx.customRate);
        }
      });

      const percent = bg.limit > 0 ? Math.round((spent / bg.limit) * 100) : 0;
      let fillClass = '';
      if (percent >= 100) fillClass = 'alarm';
      else if (percent >= 75) fillClass = 'warning';

      return `
        <div class="budget-bar-card">
          <div class="budget-bar-head">
            <span class="budget-cat-name">${bg.category}</span>
            <button class="tx-delete-btn" onclick="deleteBudget('${bg.id}')" style="margin-left:auto; margin-right:8px;"><i class="fa-solid fa-trash-can"></i></button>
            <span class="budget-fraction">${formatCurrency(spent, appState.baseCurrency)} / ${formatCurrency(bg.limit, appState.baseCurrency)}</span>
          </div>
          <div class="budget-bar-track">
            <div class="budget-bar-fill ${fillClass}" style="width: ${Math.min(100, percent)}%;"></div>
          </div>
          <div class="budget-status-row">
            <span class="budget-status-text">${percent >= 100 ? 'LIMIT EXCEEDED! 🚨' : 'Monthly allowance spent'}</span>
            <span class="budget-status-percentage">${percent}%</span>
          </div>
        </div>`;
    }).join('');
  }

  // 2. Savings Goals render
  const goalsContainer = document.getElementById('goals-grid');
  
  if (appState.goals.length === 0) {
    goalsContainer.innerHTML = `<div class="empty-state"><p>No saving boundaries initialized.</p></div>`;
    return;
  }

  goalsContainer.innerHTML = appState.goals.map(g => {
    const percent = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    
    // Circle progress gauge calculation (svg circle circumference = 2 * PI * r)
    // r = 36 -> Circumference = 226
    const strokeCircumference = 226;
    const strokeOffset = strokeCircumference - (percent / 100) * strokeCircumference;

    return `
      <div class="goal-card">
        <div class="goal-circle-box">
          <svg class="goal-circle-svg" width="80" height="80">
            <circle class="goal-circle-bg" cx="40" cy="40" r="36" />
            <circle class="goal-circle-progress" cx="40" cy="40" r="36" style="stroke-dashoffset: ${strokeOffset};" />
          </svg>
          <div class="goal-circle-text">${percent}%</div>
        </div>
        
        <div class="goal-details">
          <button class="tx-delete-btn" onclick="deleteGoal('${g.id}')" style="float:right;"><i class="fa-solid fa-trash-can"></i></button>
          <h3 class="goal-name-val">${g.name}</h3>
          <div class="goal-numbers">
            Saved: <strong style="color: var(--text-primary);">${formatCurrency(g.current, g.currency)}</strong> of ${formatCurrency(g.target, g.currency)}
          </div>
          
          <div class="goal-action-row">
            <input type="number" id="contrib-input-${g.id}" class="goal-contrib-input" placeholder="Add ($)">
            <button class="goal-contrib-btn" onclick="contributeToGoal('${g.id}')">Fund</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ==========================================
// VIEW RENDERING: REPORTS & ANALYTICS
// ==========================================
function renderReportsTab() {
  // Populate filter selectors
  const filterCat = document.getElementById('filter-category');
  filterCat.innerHTML = '<option value="all">All Categories</option>' +
    appState.categories.expense.map(c => `<option value="${c}">${c}</option>`).join('') +
    appState.categories.income.map(c => `<option value="${c}">${c}</option>`).join('');

  // Initial draw of the report grids
  renderReportsLedger();

  // Create High-Fidelity Chart.js reports
  setTimeout(initializeCharts, 200);
}

function renderReportsLedger() {
  const container = document.getElementById('reports-ledger-feed');
  const streamFilter = document.getElementById('filter-cashbook').value;
  const catFilter = document.getElementById('filter-category').value;
  const typeFilter = document.getElementById('filter-type').value;

  // Filter transaction dataset
  const filtered = appState.transactions.filter(tx => {
    const matchesStream = streamFilter === 'all' || tx.cashbookId === streamFilter;
    const matchesCat = catFilter === 'all' || tx.category === catFilter;
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    return matchesStream && matchesCat && matchesType;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-magnifying-glass"></i>
        <p>No matching transaction records match active parameters.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(tx => {
    const acc = appState.accounts.find(a => a.id === tx.accountId);
    const cb = appState.cashbooks.find(c => c.id === tx.cashbookId);
    const currency = acc ? acc.currency : tx.currency;
    const isIncome = tx.type === 'income';
    const amountClass = isIncome ? 'income' : 'expense';
    const sign = isIncome ? '+' : '-';
    
    const receiptHtml = tx.receipt 
      ? `<button class="tx-receipt-indicator" onclick="viewReceiptImage('${tx.id}')"><i class="fa-solid fa-receipt"></i></button>`
      : '';

    return `
      <div class="tx-feed-item">
        <div class="tx-category-badge ${amountClass}">
          <i class="${isIncome ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down'}"></i>
        </div>
        <div class="tx-details">
          <div class="tx-meta-row">
            <span class="tx-title">${tx.description || tx.category}</span>
            <span class="tx-tag" style="background: var(--primary-glow); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">${tx.category}</span>
            ${cb ? `<span class="tx-tag" style="background: var(--primary-glow); border-color: var(--border-color); color: var(--primary-hover); border-radius: 4px;">${cb.icon} ${cb.name}</span>` : ''}
          </div>
          <span class="tx-desc">${acc ? acc.name : 'Virtual Account'}</span>
        </div>
        <div class="tx-feed-right">
          <span class="tx-amount ${amountClass}">
            ${isIncome ? '<i class="fa-solid fa-caret-up" style="color: var(--income-green); margin-right: 4px;"></i>' : '<i class="fa-solid fa-caret-down" style="color: var(--expense-rose); margin-right: 4px;"></i>'}
            ${sign}${formatCurrency(tx.amount, currency)}
          </span>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${receiptHtml}
            <span class="tx-date-badge">${tx.date}</span>
            <button class="tx-delete-btn" onclick="deleteLedgerTx('${tx.id}')" title="Delete record">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function initializeCharts() {
  // Verify Chart.js library is loaded
  if (typeof Chart === 'undefined') {
    console.warn('[Aura Ledger Reports] Chart.js was not found. Drawing fallback placeholders.');
    return;
  }

  // Destroy old charts to clean up event listeners
  if (appState.activeCharts.cashFlow) appState.activeCharts.cashFlow.destroy();
  if (appState.activeCharts.outflow) appState.activeCharts.outflow.destroy();

  // Get dynamic dates for current calendar month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Calculation datasets
  let incomeTotal = 0;
  let expenseTotal = 0;
  const categorySpending = {};

  appState.transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
      const val = convertValue(tx.amount, tx.currency, appState.baseCurrency, tx.customRate);
      if (tx.type === 'income') {
        incomeTotal += val;
      } else {
        expenseTotal += val;
        categorySpending[tx.category] = (categorySpending[tx.category] || 0) + val;
      }
    }
  });

  // Chart 1: Income vs Expense Cashflow (Double Bar column)
  const ctxFlow = document.getElementById('chart-income-vs-expense').getContext('2d');
  appState.activeCharts.cashFlow = new Chart(ctxFlow, {
    type: 'bar',
    data: {
      labels: ['Inflow', 'Outflow'],
      datasets: [{
        label: 'This Month',
        data: [incomeTotal, expenseTotal],
        backgroundColor: ['rgba(14, 203, 129, 0.15)', 'rgba(246, 70, 93, 0.15)'],
        borderColor: ['#0ecb81', '#f6465d'],
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#707a8a', font: { family: 'JetBrains Mono', size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#707a8a', font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });

  // Chart 2: Category Expense breakdown (Donut ring)
  const outflowLabels = Object.keys(categorySpending);
  const outflowData = Object.values(categorySpending);

  const ctxOutflow = document.getElementById('chart-category-outflow').getContext('2d');
  
  if (outflowData.length === 0) {
    // Show mock message if no expenses this month
    ctxOutflow.canvas.style.display = 'none';
    const parent = ctxOutflow.canvas.parentNode;
    let fallbackText = parent.querySelector('.fallback-msg-txt');
    if (!fallbackText) {
      fallbackText = document.createElement('p');
      fallbackText.className = 'fallback-msg-txt';
      fallbackText.innerText = 'No outflows recorded this calendar month.';
      fallbackText.style.color = '#707a8a';
      fallbackText.style.fontSize = '13px';
      parent.appendChild(fallbackText);
    }
    fallbackText.style.display = 'block';
    return;
  }

  // Restore canvas visibility if fallback text exists
  ctxOutflow.canvas.style.display = 'block';
  const fallback = ctxOutflow.canvas.parentNode.querySelector('.fallback-msg-txt');
  if (fallback) fallback.style.display = 'none';

  // Beautiful modern colors including Binance Yellow
  const colorMap = [
    '#FCD535', '#0ecb81', '#f6465d', '#3b82f6', '#ec4899', 
    '#06b6d4', '#f59e0b', '#a855f7', '#64748b'
  ];

  appState.activeCharts.outflow = new Chart(ctxOutflow, {
    type: 'doughnut',
    data: {
      labels: outflowLabels,
      datasets: [{
        data: outflowData,
        backgroundColor: colorMap.slice(0, outflowLabels.length),
        borderColor: 'transparent',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#707a8a', font: { family: 'JetBrains Mono', size: 10 } }
        }
      },
      cutout: '65%'
    }
  });
}

// ==========================================
// VIEW RENDERING: SETTINGS TAB
// ==========================================
function loadSettingsPage() {
  // Populate General Settings fields
  document.getElementById('gen-name-input').value = appState.appName || 'Aura Ledger';
  document.getElementById('gen-desc-input').value = appState.appDescription || 'Secure, Modern Cash Book & Wealth Tracker';
  document.getElementById('gen-logo-url-input').value = appState.appLogo || '';
  document.getElementById('gen-favicon-url-input').value = appState.appFavicon || '';
  document.getElementById('gen-color-hex').value = appState.appPrimaryColor || '#FCD535';
  document.getElementById('gen-color-picker').value = appState.appPrimaryColor || '#FCD535';

  // Load preview images or icons
  const logoPreviewBox = document.getElementById('gen-logo-preview-box');
  if (appState.appLogo) {
    logoPreviewBox.innerHTML = `<img src="${appState.appLogo}" style="width: 100%; height: 100%; object-fit: contain;">`;
  } else {
    logoPreviewBox.innerHTML = `<i class="fa-solid fa-wallet" style="font-size: 20px; color: var(--primary);"></i>`;
  }

  const faviconPreviewBox = document.getElementById('gen-favicon-preview-box');
  if (appState.appFavicon) {
    faviconPreviewBox.innerHTML = `<img src="${appState.appFavicon}" style="width: 100%; height: 100%; object-fit: contain;">`;
  } else {
    faviconPreviewBox.innerHTML = `<i class="fa-solid fa-star" style="font-size: 20px; color: var(--primary);"></i>`;
  }

  // Highlight active preset color if it matches
  document.querySelectorAll('.color-preset-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.border = '2px solid transparent';
    btn.style.boxShadow = 'none';
    
    const presetHex = btn.getAttribute('onclick').match(/#(?:[0-9a-fA-F]{3}){1,2}/)[0];
    if (presetHex.toLowerCase() === (appState.appPrimaryColor || '#FCD535').toLowerCase()) {
      btn.classList.add('active');
      btn.style.border = '2px solid #ffffff';
      btn.style.boxShadow = '0 0 8px var(--primary)';
    }
  });

  // Reset profile values
  if (appState.user) {
    const avatar = appState.user.avatar || '';
    const displayName = appState.user.displayName || '';
    const email = appState.user.email || '';
    const phone = appState.user.phone || '';
    const bio = appState.user.bio || '';
    
    document.getElementById('prof-avatar-input').value = avatar;
    document.getElementById('prof-name-input').value = displayName;
    document.getElementById('prof-email-input').value = email;
    document.getElementById('prof-phone-input').value = phone;
    document.getElementById('prof-bio-input').value = bio;
    document.getElementById('prof-pw-input').value = ''; // keep password field masked or blank on load
  }

  // 1. Render Exchange Rates Inputs
  const containerRates = document.getElementById('exchange-rates-editor');
  
  containerRates.innerHTML = Object.entries(appState.exchangeRates).map(([currency, rate]) => {
    if (currency === appState.baseCurrency) return ''; // Skip self base conversion
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.15); padding: 8px 16px; border-radius: 10px; border: 1px solid var(--border-color);">
        <span style="font-weight: 700; font-size: 13px;">1 ${currency} converts to:</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="number" step="0.0001" min="0.00001" class="input-field" style="width: 100px; padding: 4px 8px; font-size:12px; text-align:right;" value="${rate}" onchange="updateCustomExchangeRate('${currency}', this.value)">
          <span style="font-size:11px; color:var(--text-secondary);">${appState.baseCurrency}</span>
        </div>
      </div>`;
  }).join('');

  // 2. Render Categories Tags Cloud
  const tagsBox = document.getElementById('settings-categories-box');
  
  const allExpenseTags = appState.categories.expense.map(c => `<span class="cat-item-tag" style="border-color: rgba(244,63,94,0.3); color: var(--expense-rose);"><i class="fa-solid fa-tag"></i> ${c}</span>`).join('');
  const allIncomeTags = appState.categories.income.map(c => `<span class="cat-item-tag" style="border-color: rgba(16,185,129,0.3); color: var(--income-green);"><i class="fa-solid fa-tag"></i> ${c}</span>`).join('');
  
  tagsBox.innerHTML = allExpenseTags + allIncomeTags;

  // 3. Compute Database Size
  const sizeKb = (new Blob([localStorage.getItem('aura_ledger_db') || '']).size / 1024).toFixed(2);
  document.getElementById('database-storage-size').innerText = `${sizeKb} KB`;

  // 4. Default Settings Sub-tab to General settings instead of profile
  switchSettingsTab('general');
}

function switchSettingsTab(tabId) {
  // Hide all settings sections
  document.querySelectorAll('.settings-section-view').forEach(sec => sec.style.display = 'none');
  
  // Show target settings section
  const targetSec = document.getElementById(`settings-sec-${tabId}`);
  if (targetSec) targetSec.style.display = 'block';
  
  // Update settings tabs active styling
  document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
  const targetTab = document.getElementById(`settings-tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');
}

// ==========================================
// GENERAL BRANDING & DYNAMIC RE-THEMING
// ==========================================
function applyGeneralSettings() {
  const name = appState.appName || 'Aura Ledger';
  const desc = appState.appDescription || 'Secure, Modern Cash Book & Wealth Tracker';
  const logo = appState.appLogo || '';
  const favicon = appState.appFavicon || '';
  const primaryColor = appState.appPrimaryColor || '#FCD535';

  // 1. Dynamic Text & SEO elements
  const titleTag = document.getElementById('app-title-tag');
  if (titleTag) {
    titleTag.innerText = `${name} - Premium Cash Book`;
  }
  
  const metaDesc = document.getElementById('app-meta-description');
  if (metaDesc) {
    metaDesc.setAttribute('content', desc);
  }

  const authSubtitle = document.getElementById('dynamic-auth-subtitle');
  if (authSubtitle) {
    authSubtitle.innerText = desc;
  }

  const footerDesc = document.getElementById('dynamic-footer-desc');
  if (footerDesc) {
    footerDesc.innerText = desc;
  }

  // App Name Brand Elements in Auth, Sidebar, and Footer
  const formatBrandHtml = (appNameString) => {
    const words = appNameString.toUpperCase().split(' ');
    if (words.length > 1) {
      const firstWord = words[0];
      const remaining = words.slice(1).join(' ');
      return `${firstWord} <span>${remaining}</span>`;
    }
    return appNameString.toUpperCase();
  };

  document.querySelectorAll('.dynamic-app-name').forEach(el => {
    el.innerHTML = formatBrandHtml(name);
  });

  const footerLogo = document.getElementById('dynamic-footer-logo');
  if (footerLogo) {
    footerLogo.innerHTML = formatBrandHtml(name);
  }

  // 2. Favicon & Link elements
  const faviconEl = document.getElementById('app-favicon');
  if (faviconEl) {
    faviconEl.href = favicon || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='40' fill='%2309090b'/><circle cx='96' cy='96' r='60' stroke='%237c3aed' stroke-width='10' fill='none'/></svg>";
  }

  // 3. Logo Image replacements
  document.querySelectorAll('.dynamic-app-logo').forEach(el => {
    if (logo) {
      el.innerHTML = `<img src="${logo}" alt="${name} Logo" style="height: 24px; max-width: 120px; object-fit: contain; border-radius: 4px;">`;
      el.style.display = 'inline-block';
    } else {
      el.innerHTML = `<i class="fa-solid fa-wallet" style="color: var(--primary);"></i>`;
      el.style.display = 'inline-block';
    }
  });

  // Specific Desktop Sidebar Top Logo & Name toggle logic
  const sidebarLogoIcon = document.querySelector('.sidebar-logo .dynamic-app-logo');
  const sidebarName = document.querySelector('.sidebar-logo .dynamic-app-name');
  
  if (sidebarName) {
    if (logo) {
      // If custom logo is set: show only the logo image (no app name text, default wallet is swapped)
      if (sidebarLogoIcon) {
        sidebarLogoIcon.style.display = 'inline-block';
        sidebarLogoIcon.innerHTML = `<img src="${logo}" alt="${name} Logo" style="height: 28px; max-width: 180px; object-fit: contain; border-radius: 4px;">`;
      }
      sidebarName.style.display = 'none';
    } else {
      // If no custom logo is set: show app name text only (no default wallet icon, just the clean text)
      if (sidebarLogoIcon) {
        sidebarLogoIcon.style.display = 'none';
        sidebarLogoIcon.innerHTML = '';
      }
      sidebarName.style.display = 'inline';
    }
  }

  // Specific Auth Overlay Logo & Name toggle logic
  const authLogoIcon = document.querySelector('.auth-logo .dynamic-app-logo');
  const authName = document.querySelector('.auth-logo .dynamic-app-name');
  
  if (authName) {
    if (logo) {
      // If custom logo is set: show only the logo image (no app name text, default wallet is swapped)
      if (authLogoIcon) {
        authLogoIcon.style.display = 'inline-block';
        authLogoIcon.innerHTML = `<img src="${logo}" alt="${name} Logo" style="height: 36px; max-width: 220px; object-fit: contain; border-radius: 4px;">`;
      }
      authName.style.display = 'none';
    } else {
      // If no custom logo is set: show app name text only (no default wallet icon, just the clean text)
      if (authLogoIcon) {
        authLogoIcon.style.display = 'none';
        authLogoIcon.innerHTML = '';
      }
      authName.style.display = 'inline';
    }
  }

  // 4. CSS Variable Accent re-theming
  document.documentElement.style.setProperty('--primary', primaryColor);
}

function syncColorPickerToText(color) {
  document.getElementById('gen-color-hex').value = color.toUpperCase();
  // Clear preset buttons outlines
  document.querySelectorAll('.color-preset-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.border = '2px solid transparent';
    btn.style.boxShadow = 'none';
  });
}

function syncColorTextToPicker(hex) {
  if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(hex)) {
    document.getElementById('gen-color-picker').value = hex;
    
    // Clear and highlight if match
    document.querySelectorAll('.color-preset-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.style.border = '2px solid transparent';
      btn.style.boxShadow = 'none';
      
      const presetHex = btn.getAttribute('onclick').match(/#(?:[0-9a-fA-F]{3}){1,2}/)[0];
      if (presetHex.toLowerCase() === hex.toLowerCase()) {
        btn.classList.add('active');
        btn.style.border = '2px solid #ffffff';
        btn.style.boxShadow = '0 0 8px var(--primary)';
      }
    });
  }
}

function selectColorPreset(color) {
  document.getElementById('gen-color-picker').value = color;
  document.getElementById('gen-color-hex').value = color.toUpperCase();
  
  document.querySelectorAll('.color-preset-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.border = '2px solid transparent';
    btn.style.boxShadow = 'none';
    
    const presetHex = btn.getAttribute('onclick').match(/#(?:[0-9a-fA-F]{3}){1,2}/)[0];
    if (presetHex.toLowerCase() === color.toLowerCase()) {
      btn.classList.add('active');
      btn.style.border = '2px solid #ffffff';
      btn.style.boxShadow = '0 0 8px var(--primary)';
    }
  });
}

async function handleGeneralLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const loadingIndicator = document.getElementById('logo-upload-loading');
  loadingIndicator.style.display = 'block';

  try {
    const base64Str = await fileToBase64(file);
    const cloudinaryUrl = await window.StorageService.uploadToCloudinary(base64Str);
    
    document.getElementById('gen-logo-url-input').value = cloudinaryUrl;
    document.getElementById('gen-logo-preview-box').innerHTML = `<img src="${cloudinaryUrl}" style="width: 100%; height: 100%; object-fit: contain;">`;
  } catch (err) {
    console.error('[Branding] Logo upload failed:', err);
    showDrawerAlert('Logo upload failed: ' + err.message);
  } finally {
    loadingIndicator.style.display = 'none';
  }
}

async function handleGeneralFaviconUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const loadingIndicator = document.getElementById('favicon-upload-loading');
  loadingIndicator.style.display = 'block';

  try {
    const base64Str = await fileToBase64(file);
    const cloudinaryUrl = await window.StorageService.uploadToCloudinary(base64Str);
    
    document.getElementById('gen-favicon-url-input').value = cloudinaryUrl;
    document.getElementById('gen-favicon-preview-box').innerHTML = `<img src="${cloudinaryUrl}" style="width: 100%; height: 100%; object-fit: contain;">`;
  } catch (err) {
    console.error('[Branding] Favicon upload failed:', err);
    showDrawerAlert('Favicon upload failed: ' + err.message);
  } finally {
    loadingIndicator.style.display = 'none';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function handleGeneralSettingsSubmit(event) {
  event.preventDefault();
  
  const appName = document.getElementById('gen-name-input').value.trim();
  const appDescription = document.getElementById('gen-desc-input').value.trim();
  const appLogo = document.getElementById('gen-logo-url-input').value;
  const appFavicon = document.getElementById('gen-favicon-url-input').value;
  const appPrimaryColor = document.getElementById('gen-color-hex').value.trim();

  if (!/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(appPrimaryColor)) {
    showDrawerAlert('Please enter a valid hex color starting with # (e.g. #FCD535)');
    return;
  }

  // Update State
  appState.appName = appName;
  appState.appDescription = appDescription;
  appState.appLogo = appLogo;
  appState.appFavicon = appFavicon;
  appState.appPrimaryColor = appPrimaryColor;

  try {
    await window.StorageService.updateSettings({
      appName,
      appDescription,
      appLogo,
      appFavicon,
      appPrimaryColor
    });
    
    applyGeneralSettings();
    loadSettingsPage();
    showDrawerAlert('General branding configurations saved and applied in your active Firebase database session!');
  } catch (err) {
    console.error('[Branding] Failed to save settings:', err);
    showDrawerAlert('Failed to save general settings: ' + err.message);
  }
}

async function handleProfileSettingsSubmit(event) {
  event.preventDefault();
  
  const avatar = document.getElementById('prof-avatar-input').value.toUpperCase().trim().substring(0, 2);
  const displayName = document.getElementById('prof-name-input').value.trim();
  const email = document.getElementById('prof-email-input').value.trim();
  const phone = document.getElementById('prof-phone-input').value.trim();
  const bio = document.getElementById('prof-bio-input').value.trim();
  const password = document.getElementById('prof-pw-input').value;
  
  // Update user session state
  appState.user = {
    ...appState.user,
    avatar,
    displayName,
    email,
    phone,
    bio
  };
  
  if (password.length > 0) {
    appState.user.authDetail = 'Secure Profile (Email/PW)';
  } else if (!appState.user.authDetail || appState.user.authDetail === 'Offline Local Sandbox') {
    appState.user.authDetail = 'Secure Profile (Local)';
  }
  
  // Cache user state in localStorage
  localStorage.setItem('aura_user_session', JSON.stringify(appState.user));
  
  // Re-trigger layout updates immediately
  initializeDashboardData();
  
  showDrawerAlert('User Profile updated successfully! Custom settings synced in your active offline PWA session.');
}

// ==========================================
// USER MODALS COMMANDS & DIALOG COORD
// ==========================================
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  
  // Clear any temporary forms or cached images
  if (modalId === 'tx-modal') {
    document.getElementById('tx-form').reset();
    document.getElementById('tx-receipt-preview').style.display = 'none';
    document.getElementById('tx-receipt-status').innerText = 'No picture attached';
    document.getElementById('tx-converter-sec').style.display = 'none';
    appState.receiptBase64 = null;
  }
}

// ==========================================
// CRUD TRIGGERS & FORM SUBMIT HANDLERS
// ==========================================

// Handle transaction picture capture with compressed locally
async function handleReceiptFileChange(input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById('tx-receipt-status');
  const previewBox = document.getElementById('tx-receipt-preview');
  const previewImg = document.getElementById('tx-receipt-preview-img');

  status.innerText = 'Compressing image...';
  
  try {
    const compressedBase64 = await window.StorageService.compressReceipt(file);
    appState.receiptBase64 = compressedBase64;
    
    // Render visual thumbnail preview
    previewImg.src = compressedBase64;
    previewBox.style.display = 'flex';
    status.innerText = 'Receipt loaded!';
  } catch (err) {
    console.error(err);
    status.innerText = 'Failed to compress.';
    appState.receiptBase64 = null;
  }
}

function handleAccountChange(accountId) {
  const account = appState.accounts.find(a => a.id === accountId);
  if (!account) return;

  const converterSec = document.getElementById('tx-converter-sec');
  const labelFrom = document.getElementById('tx-conv-lbl-from');
  const rateInput = document.getElementById('tx-conv-rate');

  if (account.currency === appState.baseCurrency) {
    converterSec.style.display = 'none';
    rateInput.value = '';
  } else {
    converterSec.style.display = 'block';
    labelFrom.innerText = account.currency;
    
    // Default rate from settings
    const globalRate = appState.exchangeRates[account.currency] || 1;
    rateInput.value = globalRate;
    
    updateRealtimeConversion();
  }
}

function updateRealtimeConversion() {
  const amountInput = document.getElementById('tx-amount');
  const accountId = document.getElementById('tx-account').value;
  const account = appState.accounts.find(a => a.id === accountId);
  if (!account) return;

  const converterSec = document.getElementById('tx-converter-sec');
  if (account.currency === appState.baseCurrency) {
    converterSec.style.display = 'none';
    return;
  }

  const rateInput = document.getElementById('tx-conv-rate');
  const previewDiv = document.getElementById('tx-conv-preview');

  const amount = parseFloat(amountInput.value) || 0;
  const rate = parseFloat(rateInput.value) || 0;

  const equivalent = amount * rate;
  previewDiv.innerText = formatCurrency(equivalent, appState.baseCurrency);
}

async function handleTransactionSubmit(event) {
  event.preventDefault();

  const type = document.getElementById('tx-type').value;
  const date = document.getElementById('tx-date').value;
  const amount = document.getElementById('tx-amount').value;
  const accountId = document.getElementById('tx-account').value;
  const category = document.getElementById('tx-category').value;
  const cashbookId = document.getElementById('tx-cashbook').value;
  const description = document.getElementById('tx-desc').value;

  const account = appState.accounts.find(a => a.id === accountId);
  if (!account) {
    showDrawerAlert('Invalid Account');
    return;
  }

  // Retrieve manually-entered rate if secondary currency
  const rateInput = document.getElementById('tx-conv-rate');
  const customRate = (account.currency !== appState.baseCurrency && rateInput && rateInput.value) ? parseFloat(rateInput.value) : null;

  // Construct new transaction payload
  const payload = {
    type,
    date,
    amount,
    currency: account.currency,
    accountId,
    cashbookId,
    category,
    customRate: customRate,
    description: description || `${type.charAt(0).toUpperCase() + type.slice(1)}: ${category}`,
    receipt: appState.receiptBase64
  };

  // Dispatch asynchronously to database storage layer
  await window.StorageService.addTransaction(payload);
  
  closeModal('tx-modal');
  
  // Refresh state
  initializeDashboardData();
}

async function deleteLedgerTx(txId) {
  const tx = appState.transactions.find(t => t.id === txId);
  const activeCb = tx ? tx.cashbookId : null;
  showDrawerConfirm('Are you sure you want to delete this transaction record?', async () => {
    await window.StorageService.deleteTransaction(txId);
    await initializeDashboardData();
    if (appState.currentTab === 'cashbook-detail' && activeCb) {
      openCashbookDetail(activeCb);
    }
  });
}

function openCashbookDetail(cashbookId) {
  const cb = appState.cashbooks.find(c => c.id === cashbookId);
  if (!cb) return;

  // Update detail view headers
  document.getElementById('cbd-name').innerText = cb.name;
  document.getElementById('cbd-desc').innerText = cb.description || 'Separate income stream channel ledger.';
  document.getElementById('cbd-icon-box').innerText = cb.icon || '💼';

  // Filter transactions for this specific cashbook
  const cbTx = appState.transactions.filter(t => t.cashbookId === cb.id);

  // Sum Stats
  let inflow = 0;
  let outflow = 0;
  cbTx.forEach(t => {
    const baseVal = convertValue(t.amount, t.currency, appState.baseCurrency, t.customRate);
    if (t.type === 'income') inflow += baseVal;
    else outflow += baseVal;
  });

  const net = inflow - outflow;

  // Render Stats
  document.getElementById('cbd-kpi-net').innerText = formatCurrency(net, appState.baseCurrency);
  document.getElementById('cbd-kpi-net').style.color = net < 0 ? 'var(--expense-rose)' : 'var(--income-green)';
  document.getElementById('cbd-kpi-inflow').innerText = formatCurrency(inflow, appState.baseCurrency);
  document.getElementById('cbd-kpi-outflow').innerText = formatCurrency(outflow, appState.baseCurrency);
  document.getElementById('cbd-kpi-count').innerText = `${cbTx.length} items`;

  // Render Associated Transactions Feed
  const feed = document.getElementById('cbd-tx-feed');
  if (cbTx.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-receipt"></i>
        <p>No transaction items logged under this income stream.</p>
      </div>`;
  } else {
    feed.innerHTML = cbTx.map(tx => {
      const acc = appState.accounts.find(a => a.id === tx.accountId);
      const currency = acc ? acc.currency : tx.currency;
      const isIncome = tx.type === 'income';
      const amountClass = isIncome ? 'income' : 'expense';
      const sign = isIncome ? '+' : '-';
      
      const receiptHtml = tx.receipt 
        ? `<button class="tx-receipt-indicator" onclick="viewReceiptImage('${tx.id}')"><i class="fa-solid fa-receipt"></i></button>`
        : '';

      return `
        <div class="tx-feed-item">
          <div class="tx-category-badge ${amountClass}">
            <i class="${isIncome ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down'}"></i>
          </div>
          <div class="tx-details">
            <div class="tx-meta-row">
              <span class="tx-title">${tx.description || tx.category}</span>
              <span class="tx-tag" style="background: var(--primary-glow); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">${tx.category}</span>
            </div>
            <span class="tx-desc">${acc ? acc.name : 'Unknown Account'}</span>
          </div>
          <div class="tx-feed-right">
            <span class="tx-amount ${amountClass}">
              ${isIncome ? '<i class="fa-solid fa-caret-up" style="color: var(--income-green); margin-right: 4px;"></i>' : '<i class="fa-solid fa-caret-down" style="color: var(--expense-rose); margin-right: 4px;"></i>'}
              ${sign}${formatCurrency(tx.amount, currency)}
            </span>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${receiptHtml}
              <span class="tx-date-badge">${tx.date}</span>
              <button class="tx-delete-btn" onclick="deleteLedgerTx('${tx.id}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // Switch SPA viewport directly to our new detailed page tab subview
  appState.currentTab = 'cashbook-detail';
  
  // Hide active markers from other navbar tabs
  document.querySelectorAll('.nav-link-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

  document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
  document.getElementById('view-cashbook-detail').classList.add('active');

  document.getElementById('current-view-title').innerText = `${cb.name} Detail`;
}

async function handleCashbookSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('cb-name-input').value;
  const icon = document.getElementById('cb-icon-input').value || '💼';
  const description = document.getElementById('cb-desc-input').value;

  await window.StorageService.addCashbook({ name, icon, description });
  closeModal('cashbook-modal');
  initializeDashboardData();
}

async function deleteLedgerCb(event, cbId) {
  event.stopPropagation(); // Avoid triggering card tap active selectors
  showDrawerConfirm('Deleting this stream channel keeps transactions but removes the stream filter. Continue?', async () => {
    await window.StorageService.deleteCashbook(cbId);
    initializeDashboardData();
  });
}

async function handleAccountSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('acc-name-input').value;
  const currency = document.getElementById('acc-currency-input').value;
  const symbol = document.getElementById('acc-symbol-input').value;
  const balance = document.getElementById('acc-bal-input').value || 0;

  await window.StorageService.addAccount({ name, currency, symbol, balance });
  closeModal('account-modal');
  initializeDashboardData();
}

function updateCurrencySymbolDefault(val) {
  const symbols = { USD: '$', EUR: '€', GBP: '£', KES: 'KSh', JPY: '¥' };
  document.getElementById('acc-symbol-input').value = symbols[val] || '$';
}

async function deleteAccount(accId) {
  showDrawerConfirm('Are you sure you want to delete this currency account? It will alter the net worth calculations.', async () => {
    await window.StorageService.deleteAccount(accId);
    initializeDashboardData();
  });
}

async function handleBudgetSubmit(event) {
  event.preventDefault();
  const category = document.getElementById('bg-cat-input').value;
  const limit = document.getElementById('bg-limit-input').value;

  await window.StorageService.addBudget({ category, limit, period: 'monthly' });
  closeModal('budget-modal');
  initializeDashboardData();
}

async function deleteBudget(bgId) {
  showDrawerConfirm('Delete monthly category budget limit?', async () => {
    await window.StorageService.deleteBudget(bgId);
    initializeDashboardData();
  });
}

async function handleGoalSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('gl-name-input').value;
  const target = document.getElementById('gl-target-input').value;
  const current = document.getElementById('gl-seed-input').value || 0;

  await window.StorageService.addGoal({ name, target, current, currency: appState.baseCurrency });
  closeModal('goal-modal');
  initializeDashboardData();
}

async function contributeToGoal(goalId) {
  const input = document.getElementById(`contrib-input-${goalId}`);
  const amount = input.value;
  
  if (!amount || amount <= 0) {
    showDrawerAlert('Please enter a valid savings contribution amount.');
    return;
  }

  await window.StorageService.updateGoalContribution(goalId, amount);
  
  // Reset input field
  input.value = '';
  initializeDashboardData();
}

async function deleteGoal(glId) {
  showDrawerConfirm('Remove this savings goal?', async () => {
    await window.StorageService.deleteGoal(glId);
    initializeDashboardData();
  });
}

async function handleSubscriptionSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('sub-name-input').value;
  const amount = document.getElementById('sub-amount-input').value;
  const accountId = document.getElementById('sub-account-input').value;
  const frequency = document.getElementById('sub-freq-input').value;
  const nextBill = document.getElementById('sub-date-input').value;

  const acc = appState.accounts.find(a => a.id === accountId);
  if (!acc) {
    showDrawerAlert('Invalid Account select');
    return;
  }

  await window.StorageService.addSubscription({
    name,
    amount,
    accountId,
    currency: acc.currency,
    frequency,
    nextBill
  });

  closeModal('subscription-modal');
  initializeDashboardData();
}

async function deleteSubscription(subId) {
  showDrawerConfirm('Cancel tracking of this subscription bill?', async () => {
    await window.StorageService.deleteSubscription(subId);
    initializeDashboardData();
  });
}

// Settings updates
async function updateCustomExchangeRate(currency, rate) {
  const parsedRate = parseFloat(rate);
  if (isNaN(parsedRate) || parsedRate <= 0) {
    showDrawerAlert('Enter valid exchange multiplier.');
    return;
  }

  const rates = { ...appState.exchangeRates };
  rates[currency] = parsedRate;
  
  await window.StorageService.updateSettings({ exchangeRates: rates });
  initializeDashboardData();
}

async function changeBaseCurrency(newVal) {
  await window.StorageService.updateSettings({ baseCurrency: newVal });
  initializeDashboardData();
}

async function createNewCategory() {
  const type = document.getElementById('new-cat-type').value;
  const name = document.getElementById('new-cat-name').value.trim();
  
  if (!name) {
    showDrawerAlert('Please enter a category name.');
    return;
  }

  await window.StorageService.addCategory(type, name);
  document.getElementById('new-cat-name').value = '';
  initializeDashboardData();
}

// Receipt image large display modal
function viewReceiptImage(txId) {
  const tx = appState.transactions.find(t => t.id === txId);
  if (!tx || !tx.receipt) return;

  const titleText = `${tx.description || tx.category} — ${formatCurrency(tx.amount, tx.currency)}`;
  document.getElementById('receipt-modal-tx-details').innerText = titleText;
  document.getElementById('receipt-modal-img').src = tx.receipt;
  
  openModal('receipt-modal');
}

// ==========================================
// DATA BACKUP & RESTORE COMMANDS
// ==========================================
async function triggerDatabaseBackup() {
  const backupStr = await window.StorageService.exportBackup();
  
  // Build a download file trigger
  const blob = new Blob([backupStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AuraLedger_Backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerDatabaseRestore(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const success = await window.StorageService.importBackup(e.target.result);
    if (success) {
      showDrawerAlert('Ledger database restored successfully! Overwriting active state...');
      initializeDashboardData();
    } else {
      showDrawerAlert('Failed to restore. Please ensure a valid AuraLedger JSON backup file is uploaded.');
    }
  };
  reader.readAsText(file);
}

async function wipeDatabase() {
  showDrawerConfirm('CRITICAL WARNING: This will permanently wipe all your transaction records and configurations, resetting to the default sample database. Do you wish to continue?', async () => {
    localStorage.removeItem('aura_ledger_db');
    showDrawerAlert('Ledger completely reset to initial seed values.');
    initializeDashboardData();
  });
}

// ==========================================
// VISUAL SYSTEM THEME ENGINE
// ==========================================
// Dynamic Confirmation Drawer
let activeConfirmCallback = null;

function showDrawerConfirm(message, onConfirm) {
  document.getElementById('confirm-drawer-message').innerText = message;
  activeConfirmCallback = onConfirm;
  
  // Set up the Yes button trigger
  const yesBtn = document.getElementById('confirm-drawer-yes-btn');
  yesBtn.onclick = handleConfirmDrawerYes;
  
  openModal('confirm-drawer');
}

function handleConfirmDrawerYes() {
  closeModal('confirm-drawer');
  if (activeConfirmCallback) {
    activeConfirmCallback();
    activeConfirmCallback = null;
  }
}

// Dynamic Alert Drawer
function showDrawerAlert(message) {
  document.getElementById('alert-drawer-message').innerText = message;
  openModal('alert-drawer');
}

function applyThemeClasses() {
  const theme = localStorage.getItem('aura_theme') || 'system';
  const select = document.getElementById('settings-theme-select');
  if (select) select.value = theme;

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isLight = theme === 'light' || (theme === 'system' && !systemDark);
  
  if (isLight) {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }

  // Dynamically update PWA headers
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.setAttribute('name', 'theme-color');
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.setAttribute('content', isLight ? '#ffffff' : '#0b0e11');

  let appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleStatusBarMeta) {
    appleStatusBarMeta.setAttribute('content', isLight ? 'default' : 'black-translucent');
  }
}

function applyUserThemeSelection(themeName) {
  localStorage.setItem('aura_theme', themeName);
  applyThemeClasses();
}

// Add system media listener on startup to react in real-time
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const theme = localStorage.getItem('aura_theme') || 'system';
  if (theme === 'system') {
    applyThemeClasses();
  }
});

// ==========================================
// BOOTSTRAP INITIALIZATION ON LOAD
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // Apply visual theme selection on initial load
  applyThemeClasses();

  // 1. Establish current date values for transaction input forms
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('sub-date-input').value = new Date().toISOString().split('T')[0];

  // 2. Check if a cached user session exists, bypassing or loading Auth overlay
  const cachedUser = localStorage.getItem('aura_user_session');
  if (cachedUser) {
    appState.user = JSON.parse(cachedUser);
    hideAuthScreen();
    initializeDashboardData().then(() => {
      // Execute the router on load to mount the right page URL!
      handleRouting();
    });
  } else {
    // Directly show Email / Password form section on load
    const emailSec = document.getElementById('auth-sec-email');
    if (emailSec) emailSec.style.display = 'block';
  }
});
