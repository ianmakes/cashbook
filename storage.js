// storage.js - Real-Time Asynchronous Firebase Firestore & Cloudinary Cloud Service Driver

// Firebase Configuration Credentials
const firebaseConfig = {
  apiKey: "AIzaSyAwSMNITxGcpvgi0t2Typfc3z6ScTnxo-o",
  authDomain: "cashbook-7a92f.firebaseapp.com",
  projectId: "cashbook-7a92f",
  storageBucket: "cashbook-7a92f.firebasestorage.app",
  messagingSenderId: "925458507826",
  appId: "1:925458507826:web:117b355007bc234638342b"
};

// Initialize Firebase App
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Enable offline database caching persistence
db.enablePersistence().catch((err) => {
  console.warn("[Firestore Offline Persistence Warning]", err.code);
});

class StorageService {
  // Simulates cloud service round-trip latency to ensure UI transitions are smooth
  static async simulateDelay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Resolves the active user path scope (defaults to super user uid)
  static getUserId() {
    if (window.appState && window.appState.user && window.appState.user.uid) {
      return window.appState.user.uid;
    }
    return "WzNEwcXMeVa1RRgxIFbzL7WvRON2"; // Default Super User UID
  }

  // Native Web Crypto API SHA-1 Hasher for Cloudinary Upload Signatures
  static async hashSha1(string) {
    const utf8 = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest("SHA-1", utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  }

  // HTML5 canvas receipt compressor + secure Cloudinary signed uploader
  static async compressReceipt(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
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
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to standard JPEG format with 0.65 quality compression
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.65);
          
          try {
            // Upload directly to Cloudinary using signed signature
            const url = await StorageService.uploadToCloudinary(compressedBase64);
            resolve(url);
          } catch (err) {
            console.error("[StorageService Cloudinary Upload Error]", err);
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image file."));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }

  // HTML5 canvas 1:1 square crop profile image compressor + Cloudinary upload
  static async compressProfileImage(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const size = 200; // Force exactly 200x200px output
          canvas.width = size;
          canvas.height = size;
          
          const ctx = canvas.getContext("2d");
          
          // Crop to 1:1 center square
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
          if (img.width > img.height) {
            sx = (img.width - img.height) / 2;
            sWidth = img.height;
          } else {
            sy = (img.height - img.width) / 2;
            sHeight = img.width;
          }
          
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
          
          // Compress to JPEG with 0.8 quality
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
          
          try {
            const url = await StorageService.uploadToCloudinary(compressedBase64);
            resolve(url);
          } catch (err) {
            console.error("[StorageService Cloudinary Profile Image Upload Error]", err);
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image file."));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }

  // Secure Signed Cloudinary Image Uploader (Direct Client REST Post)
  static async uploadToCloudinary(base64Image) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiKey = "848866199679944";
    const apiSecret = "F7gd5v8m_baVRhjkIW0-KPklYgw";
    const cloudName = "dl3ee8etw";

    // Sorted alphabetically: timestamp={timestamp} + appSecret
    const stringToSign = `timestamp=${timestamp}${apiSecret}`;
    const signature = await this.hashSha1(stringToSign);

    const formData = new FormData();
    formData.append("file", base64Image);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(`Cloudinary upload failed: ${errData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.secure_url; // HTTPS URL of the uploaded receipt
  }

  static seededUserId = null;

  // Dynamic automatic seeding check
  static async checkAndSeedDatabase() {
    const userId = this.getUserId();
    if (this.seededUserId === userId) {
      return; // Already verified and seeded for this user in this session
    }

    const accountsRef = db.collection("users").doc(userId).collection("accounts");
    const snapshot = await accountsRef.limit(1).get();

    if (snapshot.empty) {
      console.log(`[StorageService] Firestore empty for user ${userId}. Seeding DEFAULT_DATA...`);
      const seed = window.DEFAULT_DATA;

      // Seed 1. Accounts
      for (const acc of seed.accounts) {
        await accountsRef.doc(acc.id).set(acc);
      }

      // Seed 2. Streams (Cashbooks)
      const cbRef = db.collection("users").doc(userId).collection("cashbooks");
      for (const cb of seed.cashbooks) {
        await cbRef.doc(cb.id).set(cb);
      }

      // Seed 3. Transactions
      const txRef = db.collection("users").doc(userId).collection("transactions");
      for (const tx of seed.transactions) {
        await txRef.doc(tx.id).set({
          ...tx,
          amount: parseFloat(tx.amount)
        });
      }

      // Seed 4. Budgets
      const bgRef = db.collection("users").doc(userId).collection("budgets");
      for (const bg of seed.budgets) {
        await bgRef.doc(bg.id).set(bg);
      }

      // Seed 5. Savings Goals
      const glRef = db.collection("users").doc(userId).collection("goals");
      for (const gl of seed.goals) {
        await glRef.doc(gl.id).set(gl);
      }

      // Seed 6. Subscriptions
      const subRef = db.collection("users").doc(userId).collection("subscriptions");
      for (const s of seed.subscriptions) {
        await subRef.doc(s.id).set(s);
      }

      // Seed 7. Metadata (Categories Cloud & Exchange Rates configs)
      await db.collection("users").doc(userId).collection("metadata").doc("categories").set(seed.categories);
      await db.collection("users").doc(userId).collection("metadata").doc("settings").set(seed.settings);

      console.log("[StorageService] Cloud seeding completed successfully!");
    }

    this.seededUserId = userId; // Cache verify success
  }

  // ==========================================
  // TRANSACTION SERVICE METHODS
  // ==========================================
  static async getTransactions() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const snapshot = await db.collection("users").doc(userId).collection("transactions").get();
    const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  static async addTransaction(transaction) {
    const userId = this.getUserId();
    const txId = `tx-${Date.now()}`;
    const newTx = {
      ...transaction,
      id: txId,
      amount: parseFloat(transaction.amount)
    };

    // Save transaction to cloud Firestore
    await db.collection("users").doc(userId).collection("transactions").doc(txId).set(newTx);

    // Adjust corresponding Account Balance in Firestore
    const accountRef = db.collection("users").doc(userId).collection("accounts").doc(transaction.accountId);
    const accountDoc = await accountRef.get();
    if (accountDoc.exists) {
      const account = accountDoc.data();
      let newBalance = parseFloat(account.balance || 0);
      if (transaction.type === "income") {
        newBalance += newTx.amount;
      } else {
        newBalance -= newTx.amount;
      }
      await accountRef.update({ balance: newBalance });
    }

    return newTx;
  }

  static async deleteTransaction(txId) {
    const userId = this.getUserId();
    const txRef = db.collection("users").doc(userId).collection("transactions").doc(txId);
    const txDoc = await txRef.get();

    if (txDoc.exists) {
      const tx = txDoc.data();
      
      // Reverse Account Balance adjustment in Firestore
      const accountRef = db.collection("users").doc(userId).collection("accounts").doc(tx.accountId);
      const accountDoc = await accountRef.get();
      if (accountDoc.exists) {
        const account = accountDoc.data();
        let newBalance = parseFloat(account.balance || 0);
        if (tx.type === "income") {
          newBalance -= tx.amount;
        } else {
          newBalance += tx.amount;
        }
        await accountRef.update({ balance: newBalance });
      }

      await txRef.delete();
      return true;
    }
    return false;
  }

  // ==========================================
  // CASHBOOK (INCOME STREAM) SERVICE METHODS
  // ==========================================
  static async getCashbooks() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const snapshot = await db.collection("users").doc(userId).collection("cashbooks").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async addCashbook(cashbook) {
    const userId = this.getUserId();
    const cbId = `cb-${Date.now()}`;
    const newCb = {
      ...cashbook,
      id: cbId
    };
    await db.collection("users").doc(userId).collection("cashbooks").doc(cbId).set(newCb);
    return newCb;
  }

  static async deleteCashbook(cbId) {
    const userId = this.getUserId();
    await db.collection("users").doc(userId).collection("cashbooks").doc(cbId).delete();
    return true;
  }

  // ==========================================
  // ACCOUNT (CURRENCY ACCOUNT) SERVICE METHODS
  // ==========================================
  static async getAccounts() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const snapshot = await db.collection("users").doc(userId).collection("accounts").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async addAccount(account) {
    const userId = this.getUserId();
    const accId = `acc-${Date.now()}`;
    const newAcc = {
      ...account,
      id: accId,
      balance: parseFloat(account.balance || 0)
    };
    await db.collection("users").doc(userId).collection("accounts").doc(accId).set(newAcc);
    return newAcc;
  }

  static async deleteAccount(accId) {
    const userId = this.getUserId();
    await db.collection("users").doc(userId).collection("accounts").doc(accId).delete();
    return true;
  }

  // ==========================================
  // BUDGET SERVICE METHODS
  // ==========================================
  static async getBudgets() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const snapshot = await db.collection("users").doc(userId).collection("budgets").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async addBudget(budget) {
    const userId = this.getUserId();
    const bgId = `bg-${Date.now()}`;
    const newBg = {
      ...budget,
      id: bgId,
      limit: parseFloat(budget.limit)
    };
    await db.collection("users").doc(userId).collection("budgets").doc(bgId).set(newBg);
    return newBg;
  }

  static async deleteBudget(bgId) {
    const userId = this.getUserId();
    await db.collection("users").doc(userId).collection("budgets").doc(bgId).delete();
    return true;
  }

  // ==========================================
  // SAVINGS GOALS SERVICE METHODS
  // ==========================================
  static async getGoals() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const snapshot = await db.collection("users").doc(userId).collection("goals").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async addGoal(goal) {
    const userId = this.getUserId();
    const glId = `gl-${Date.now()}`;
    const newGl = {
      ...goal,
      id: glId,
      target: parseFloat(goal.target),
      current: parseFloat(goal.current || 0)
    };
    await db.collection("users").doc(userId).collection("goals").doc(glId).set(newGl);
    return newGl;
  }

  static async updateGoalContribution(goalId, contributionAmount) {
    const userId = this.getUserId();
    const goalRef = db.collection("users").doc(userId).collection("goals").doc(goalId);
    const goalDoc = await goalRef.get();

    if (goalDoc.exists) {
      const goal = goalDoc.data();
      const newCurrent = parseFloat(goal.current || 0) + parseFloat(contributionAmount);
      await goalRef.update({ current: newCurrent });
      return { ...goal, current: newCurrent };
    }
    return null;
  }

  static async deleteGoal(glId) {
    const userId = this.getUserId();
    await db.collection("users").doc(userId).collection("goals").doc(glId).delete();
    return true;
  }

  // ==========================================
  // SUBSCRIPTIONS SERVICE METHODS
  // ==========================================
  static async getSubscriptions() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const snapshot = await db.collection("users").doc(userId).collection("subscriptions").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async addSubscription(subscription) {
    const userId = this.getUserId();
    const subId = `sub-${Date.now()}`;
    const newSub = {
      ...subscription,
      id: subId,
      amount: parseFloat(subscription.amount)
    };
    await db.collection("users").doc(userId).collection("subscriptions").doc(subId).set(newSub);
    return newSub;
  }

  static async deleteSubscription(subId) {
    const userId = this.getUserId();
    await db.collection("users").doc(userId).collection("subscriptions").doc(subId).delete();
    return true;
  }

  // ==========================================
  // SETTINGS & BACKUP SERVICE METHODS
  // ==========================================
  static async getSettings() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const doc = await db.collection("users").doc(userId).collection("metadata").doc("settings").get();
    return doc.exists ? doc.data() : window.DEFAULT_DATA.settings;
  }

  static async updateSettings(newSettings) {
    const userId = this.getUserId();
    const docRef = db.collection("users").doc(userId).collection("metadata").doc("settings");
    const doc = await docRef.get();
    const current = doc.exists ? doc.data() : window.DEFAULT_DATA.settings;
    const updated = { ...current, ...newSettings };
    await docRef.set(updated);
    return updated;
  }

  static async getCategories() {
    await this.checkAndSeedDatabase();
    const userId = this.getUserId();
    const doc = await db.collection("users").doc(userId).collection("metadata").doc("categories").get();
    return doc.exists ? doc.data() : window.DEFAULT_DATA.categories;
  }

  static async addCategory(type, categoryName) {
    const userId = this.getUserId();
    const docRef = db.collection("users").doc(userId).collection("metadata").doc("categories");
    const doc = await docRef.get();
    const categories = doc.exists ? doc.data() : window.DEFAULT_DATA.categories;

    if (type === "income" && !categories.income.includes(categoryName)) {
      categories.income.push(categoryName);
    } else if (type === "expense" && !categories.expense.includes(categoryName)) {
      categories.expense.push(categoryName);
    }

    await docRef.set(categories);
    return categories;
  }

  static async exportBackup() {
    const state = {
      transactions: await this.getTransactions(),
      accounts: await this.getAccounts(),
      cashbooks: await this.getCashbooks(),
      budgets: await this.getBudgets(),
      goals: await this.getGoals(),
      subscriptions: await this.getSubscriptions(),
      categories: await this.getCategories(),
      settings: await this.getSettings()
    };
    return JSON.stringify(state, null, 2);
  }

  static async importBackup(backupJsonString) {
    try {
      const parsed = JSON.parse(backupJsonString);
      if (parsed.transactions && parsed.accounts && parsed.cashbooks && parsed.settings) {
        const userId = this.getUserId();
        const batch = firebase.firestore().batch();

        // 1. Overwrite accounts
        const accountsRef = db.collection("users").doc(userId).collection("accounts");
        for (const acc of parsed.accounts) {
          batch.set(accountsRef.doc(acc.id), acc);
        }
        
        // 2. Overwrite cashbooks
        const cbRef = db.collection("users").doc(userId).collection("cashbooks");
        for (const cb of parsed.cashbooks) {
          batch.set(cbRef.doc(cb.id), cb);
        }
        
        // 3. Overwrite transactions
        const txRef = db.collection("users").doc(userId).collection("transactions");
        for (const tx of parsed.transactions) {
          batch.set(txRef.doc(tx.id), tx);
        }
        
        // 4. Overwrite budgets
        const bgRef = db.collection("users").doc(userId).collection("budgets");
        for (const bg of (parsed.budgets || [])) {
          batch.set(bgRef.doc(bg.id), bg);
        }
        
        // 5. Overwrite savings goals
        const glRef = db.collection("users").doc(userId).collection("goals");
        for (const gl of (parsed.goals || [])) {
          batch.set(glRef.doc(gl.id), gl);
        }
        
        // 6. Overwrite subscriptions
        const subRef = db.collection("users").doc(userId).collection("subscriptions");
        for (const s of (parsed.subscriptions || [])) {
          batch.set(subRef.doc(s.id), s);
        }

        // Overwrite metadata
        batch.set(db.collection("users").doc(userId).collection("metadata").doc("categories"), parsed.categories || window.DEFAULT_DATA.categories);
        batch.set(db.collection("users").doc(userId).collection("metadata").doc("settings"), parsed.settings || window.DEFAULT_DATA.settings);

        await batch.commit();
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
