// storage.js - Async Storage Service for Aura Ledger
// Future-proofed to swap directly with Firebase Firestore and Cloudinary SDKs

const DB_KEY = 'aura_ledger_db';

class StorageService {
  // Simulates cloud service round-trip latency to ensure UI state transitions are tested
  static async simulateDelay(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get raw JSON Database state
  static _getRawDb() {
    let raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      // Seed default data if local storage is empty
      localStorage.setItem(DB_KEY, JSON.stringify(window.DEFAULT_DATA));
      raw = localStorage.stringify ? localStorage.getItem(DB_KEY) : JSON.stringify(window.DEFAULT_DATA);
    }
    return JSON.parse(raw);
  }

  // Save raw JSON Database state
  static _saveRawDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  // HTML5 canvas receipt image compressor
  // Compresses high-res camera uploads (~2MB-10MB) to highly compact JPGs (~30KB-50KB)
  // Ready to plug in Cloudinary upload API here in the future
  static async compressReceipt(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Target maximum dimensions of 450px for mobile thumbnails
          const MAX_DIMENSION = 450;
          if (width > height) {
            if (width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to standard JPEG format with 0.65 quality compression
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('Failed to load image file.'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  // ==========================================
  // TRANSACTION SERVICE METHODS
  // ==========================================
  static async getTransactions() {
    await this.simulateDelay();
    const db = this._getRawDb();
    return db.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  static async addTransaction(transaction) {
    await this.simulateDelay();
    const db = this._getRawDb();
    
    // Add unique transaction id and timestamp
    const newTx = {
      ...transaction,
      id: `tx-${Date.now()}`,
      amount: parseFloat(transaction.amount)
    };

    db.transactions.push(newTx);

    // Adjust Account Balance corresponding to income or expense
    const account = db.accounts.find(a => a.id === transaction.accountId);
    if (account) {
      if (transaction.type === 'income') {
        account.balance += newTx.amount;
      } else {
        account.balance -= newTx.amount;
      }
    }

    this._saveRawDb(db);
    return newTx;
  }

  static async deleteTransaction(txId) {
    await this.simulateDelay();
    const db = this._getRawDb();
    const txIndex = db.transactions.findIndex(t => t.id === txId);
    
    if (txIndex !== -1) {
      const tx = db.transactions[txIndex];
      // Reverse Account Balance adjustment
      const account = db.accounts.find(a => a.id === tx.accountId);
      if (account) {
        if (tx.type === 'income') {
          account.balance -= tx.amount;
        } else {
          account.balance += tx.amount;
        }
      }
      db.transactions.splice(txIndex, 1);
      this._saveRawDb(db);
      return true;
    }
    return false;
  }

  // ==========================================
  // CASHBOOK (INCOME STREAM) SERVICE METHODS
  // ==========================================
  static async getCashbooks() {
    await this.simulateDelay(100);
    const db = this._getRawDb();
    return db.cashbooks;
  }

  static async addCashbook(cashbook) {
    await this.simulateDelay();
    const db = this._getRawDb();
    const newCb = {
      ...cashbook,
      id: `cb-${Date.now()}`
    };
    db.cashbooks.push(newCb);
    this._saveRawDb(db);
    return newCb;
  }

  static async deleteCashbook(cbId) {
    await this.simulateDelay();
    const db = this._getRawDb();
    db.cashbooks = db.cashbooks.filter(c => c.id !== cbId);
    // Keep transactions associated but marked general or deleted if needed. We keep transactions.
    this._saveRawDb(db);
    return true;
  }

  // ==========================================
  // ACCOUNT (CURRENCY ACCOUNT) SERVICE METHODS
  // ==========================================
  static async getAccounts() {
    await this.simulateDelay(100);
    const db = this._getRawDb();
    return db.accounts;
  }

  static async addAccount(account) {
    await this.simulateDelay();
    const db = this._getRawDb();
    const newAcc = {
      ...account,
      id: `acc-${Date.now()}`,
      balance: parseFloat(account.balance || 0)
    };
    db.accounts.push(newAcc);
    this._saveRawDb(db);
    return newAcc;
  }

  static async deleteAccount(accId) {
    await this.simulateDelay();
    const db = this._getRawDb();
    db.accounts = db.accounts.filter(a => a.id !== accId);
    this._saveRawDb(db);
    return true;
  }

  // ==========================================
  // BUDGET SERVICE METHODS
  // ==========================================
  static async getBudgets() {
    await this.simulateDelay(100);
    const db = this._getRawDb();
    return db.budgets;
  }

  static async addBudget(budget) {
    await this.simulateDelay();
    const db = this._getRawDb();
    const newBg = {
      ...budget,
      id: `bg-${Date.now()}`,
      limit: parseFloat(budget.limit)
    };
    db.budgets.push(newBg);
    this._saveRawDb(db);
    return newBg;
  }

  static async deleteBudget(bgId) {
    await this.simulateDelay();
    const db = this._getRawDb();
    db.budgets = db.budgets.filter(b => b.id !== bgId);
    this._saveRawDb(db);
    return true;
  }

  // ==========================================
  // SAVINGS GOALS SERVICE METHODS
  // ==========================================
  static async getGoals() {
    await this.simulateDelay(100);
    const db = this._getRawDb();
    return db.goals;
  }

  static async addGoal(goal) {
    await this.simulateDelay();
    const db = this._getRawDb();
    const newGl = {
      ...goal,
      id: `gl-${Date.now()}`,
      target: parseFloat(goal.target),
      current: parseFloat(goal.current || 0)
    };
    db.goals.push(newGl);
    this._saveRawDb(db);
    return newGl;
  }

  static async updateGoalContribution(goalId, contributionAmount) {
    await this.simulateDelay();
    const db = this._getRawDb();
    const goal = db.goals.find(g => g.id === goalId);
    if (goal) {
      const parsedAmount = parseFloat(contributionAmount);
      goal.current += parsedAmount;

      // Automatically log as an expense (Saving Contribution) under the default USD or corresponding account
      // to keep overall ledger accurate if desired
      this._saveRawDb(db);
      return goal;
    }
    return null;
  }

  static async deleteGoal(glId) {
    await this.simulateDelay();
    const db = this._getRawDb();
    db.goals = db.goals.filter(g => g.id !== glId);
    this._saveRawDb(db);
    return true;
  }

  // ==========================================
  // SUBSCRIPTIONS SERVICE METHODS
  // ==========================================
  static async getSubscriptions() {
    await this.simulateDelay();
    const db = this._getRawDb();
    return db.subscriptions;
  }

  static async addSubscription(subscription) {
    await this.simulateDelay();
    const db = this._getRawDb();
    const newSub = {
      ...subscription,
      id: `sub-${Date.now()}`,
      amount: parseFloat(subscription.amount)
    };
    db.subscriptions.push(newSub);
    this._saveRawDb(db);
    return newSub;
  }

  static async deleteSubscription(subId) {
    await this.simulateDelay();
    const db = this._getRawDb();
    db.subscriptions = db.subscriptions.filter(s => s.id !== subId);
    this._saveRawDb(db);
    return true;
  }

  // ==========================================
  // SETTINGS & BACKUP SERVICE METHODS
  // ==========================================
  static async getSettings() {
    await this.simulateDelay(50);
    const db = this._getRawDb();
    return db.settings;
  }

  static async updateSettings(newSettings) {
    await this.simulateDelay();
    const db = this._getRawDb();
    db.settings = {
      ...db.settings,
      ...newSettings
    };
    this._saveRawDb(db);
    return db.settings;
  }

  static async getCategories() {
    await this.simulateDelay(50);
    const db = this._getRawDb();
    return db.categories;
  }

  static async addCategory(type, categoryName) {
    await this.simulateDelay();
    const db = this._getRawDb();
    if (type === 'income' && !db.categories.income.includes(categoryName)) {
      db.categories.income.push(categoryName);
    } else if (type === 'expense' && !db.categories.expense.includes(categoryName)) {
      db.categories.expense.push(categoryName);
    }
    this._saveRawDb(db);
    return db.categories;
  }

  static async exportBackup() {
    await this.simulateDelay();
    return JSON.stringify(this._getRawDb(), null, 2);
  }

  static async importBackup(backupJsonString) {
    await this.simulateDelay();
    try {
      const parsed = JSON.parse(backupJsonString);
      // Validate core structural properties
      if (parsed.transactions && parsed.accounts && parsed.cashbooks && parsed.settings) {
        this._saveRawDb(parsed);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}

// Export to window globally
window.StorageService = StorageService;
