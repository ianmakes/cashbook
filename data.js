// Default seed data for Aura Ledger Cash Book
const DEFAULT_DATA = {
  accounts: [
    { id: 'acc-1', name: 'USD Wallet (Cash)', currency: 'USD', symbol: '$', balance: 4850.00 },
    { id: 'acc-2', name: 'EUR Bank Account', currency: 'EUR', symbol: '€', balance: 2450.00 },
    { id: 'acc-3', name: 'GBP Debit Card', currency: 'GBP', symbol: '£', balance: 350.00 }
  ],
  cashbooks: [
    { id: 'cb-1', name: 'Corporate Salary', icon: '💼', description: 'Primary 9-to-5 job stream' },
    { id: 'cb-2', name: 'Tech Consulting', icon: '💻', description: 'Freelance & consulting work' },
    { id: 'cb-3', name: 'Digital Store', icon: '🎨', description: 'Asset selling & passive side gigs' }
  ],
  categories: {
    income: ['Salary', 'Freelance', 'Investments', 'Digital Products', 'Gifts', 'Other'],
    expense: ['Rent & Housing', 'Groceries', 'Dining Out', 'Utilities', 'Transport', 'Subscriptions', 'Entertainment', 'Shopping', 'Health & Fitness']
  },
  transactions: [
    {
      id: 'tx-1',
      type: 'income',
      amount: 4500.00,
      currency: 'USD',
      accountId: 'acc-1',
      cashbookId: 'cb-1',
      category: 'Salary',
      date: '2026-05-01',
      description: 'Monthly payroll deposit',
      receipt: null
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 1200.00,
      currency: 'USD',
      accountId: 'acc-1',
      cashbookId: 'cb-1',
      category: 'Rent & Housing',
      date: '2026-05-02',
      description: 'Downtown Loft Rent',
      receipt: null
    },
    {
      id: 'tx-3',
      type: 'income',
      amount: 850.00,
      currency: 'EUR',
      accountId: 'acc-2',
      cashbookId: 'cb-2',
      category: 'Freelance',
      date: '2026-05-10',
      description: 'Vite UI Redesign Freelance Payment',
      receipt: null
    },
    {
      id: 'tx-4',
      type: 'expense',
      amount: 15.49,
      currency: 'USD',
      accountId: 'acc-1',
      cashbookId: 'cb-1',
      category: 'Subscriptions',
      date: '2026-05-12',
      description: 'Netflix UHD Subscription',
      receipt: null
    },
    {
      id: 'tx-5',
      type: 'expense',
      amount: 72.50,
      currency: 'GBP',
      accountId: 'acc-3',
      cashbookId: 'cb-1',
      category: 'Groceries',
      date: '2026-05-18',
      description: 'Sainsbury\'s Weekly Food Run',
      receipt: null
    },
    {
      id: 'tx-6',
      type: 'income',
      amount: 320.00,
      currency: 'USD',
      accountId: 'acc-1',
      cashbookId: 'cb-3',
      category: 'Digital Products',
      date: '2026-05-20',
      description: 'Icon Theme Pack sales',
      receipt: null
    },
    {
      id: 'tx-7',
      type: 'expense',
      amount: 110.00,
      currency: 'EUR',
      accountId: 'acc-2',
      cashbookId: 'cb-2',
      category: 'Utilities',
      date: '2026-05-22',
      description: 'Monthly Fiber Internet Bill',
      receipt: null
    },
    {
      id: 'tx-8',
      type: 'expense',
      amount: 95.00,
      currency: 'USD',
      accountId: 'acc-1',
      cashbookId: 'cb-1',
      category: 'Dining Out',
      date: '2026-05-24',
      description: 'Sushi dinner with friends',
      receipt: null
    },
    {
      id: 'tx-9',
      type: 'expense',
      amount: 10.00,
      currency: 'EUR',
      accountId: 'acc-2',
      cashbookId: 'cb-1',
      category: 'Subscriptions',
      date: '2026-05-25',
      description: 'Spotify Premium Family Plan',
      receipt: null
    }
  ],
  budgets: [
    { id: 'bg-1', category: 'Groceries', limit: 50000.00, period: 'monthly' },
    { id: 'bg-2', category: 'Subscriptions', limit: 15000.00, period: 'monthly' },
    { id: 'bg-3', category: 'Dining Out', limit: 25000.00, period: 'monthly' }
  ],
  goals: [
    { id: 'gl-1', name: 'Emergency Fund 🚨', target: 1500000.00, current: 1100000.00, currency: 'KES' },
    { id: 'gl-2', name: 'Japan Tokyo Trip 🇯🇵', target: 600000.00, current: 240000.00, currency: 'KES' }
  ],
  subscriptions: [
    { id: 'sub-1', name: 'Netflix Premium UHD', amount: 15.49, currency: 'USD', frequency: 'monthly', nextBill: '2026-06-01', category: 'Subscriptions', accountId: 'acc-1' },
    { id: 'sub-2', name: 'Spotify Premium Family', amount: 10.00, currency: 'EUR', frequency: 'monthly', nextBill: '2026-06-10', category: 'Subscriptions', accountId: 'acc-2' },
    { id: 'sub-3', name: 'Amazon Prime Video', amount: 8.99, currency: 'GBP', frequency: 'monthly', nextBill: '2026-06-15', category: 'Subscriptions', accountId: 'acc-3' },
    { id: 'sub-4', name: 'AWS Cloud Hosting Server', amount: 48.00, currency: 'USD', frequency: 'monthly', nextBill: '2026-06-05', category: 'Subscriptions', accountId: 'acc-1' },
    { id: 'sub-5', name: 'CrossFit Yearly Membership', amount: 399.00, currency: 'USD', frequency: 'annually', nextBill: '2026-11-20', category: 'Health & Fitness', accountId: 'acc-1' }
  ],
  settings: {
    baseCurrency: 'KES',
    exchangeRates: {
      USD: 130.0,   // 1 USD = 130 KES
      EUR: 141.0,   // 1 EUR = 141 KES
      GBP: 165.0,   // 1 GBP = 165 KES
      KES: 1.0,     // 1 KES = 1 KES
      JPY: 0.85     // 1 JPY = 0.85 KES
    }
  }
};

// Export to window so it is accessible by other loaded scripts globally in the browser
window.DEFAULT_DATA = DEFAULT_DATA;
