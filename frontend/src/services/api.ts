const API_BASE = 'http://localhost:8000/api/v1';

// ── Token Management ──────────────────────────────────────────────────────────

let _token: string | null = localStorage.getItem('sw_token');
let _user: any = JSON.parse(localStorage.getItem('sw_user') || 'null');

export function getStoredToken() { return _token; }
export function getStoredUser() { return _user; }

export function persistUser(user: any) {
  _user = user;
  if (user) localStorage.setItem('sw_user', JSON.stringify(user));
  else localStorage.removeItem('sw_user');
}

function persistSession(data: { access_token?: string; user?: any }) {
  if (data.access_token) {
    _token = data.access_token;
    localStorage.setItem('sw_token', _token);
  }
  if (data.user) persistUser(data.user);
}

/** Login with email + password */
export async function login(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/token`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Invalid credentials');
  const data = await res.json();
  persistSession(data);
  return data;
}

/** Register a new user */
export async function register(email: string, password: string, full_name: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name })
  });
  if (!res.ok) throw new Error('Registration failed');
  const data = await res.json();
  persistSession(data);
  return data;
}

export function logout() {
  _token = null;
  _user = null;
  localStorage.removeItem('sw_token');
  localStorage.removeItem('sw_user');
}

export function notifyDataChanged() {
  document.dispatchEvent(new CustomEvent('sw:data-changed'));
}

// ── Authenticated fetch helper ─────────────────────────────────────────────────

async function authFetch(url: string, options: RequestInit = {}) {
  if (!_token) throw new Error('Not authenticated');
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${_token}`,
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    logout();
    window.dispatchEvent(new CustomEvent('sw:auth-lost'));
    throw new Error('Session expired');
  }
  return res;
}

export async function fetchMe() {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error('Could not load profile');
  const user = await res.json();
  persistUser(user);
  return user;
}

export async function updateProfile(data: { full_name?: string; currency?: string }) {
  const res = await authFetch(`${API_BASE}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Could not update profile');
  const user = await res.json();
  persistUser(user);
  return user;
}

// ── Health ─────────────────────────────────────────────────────────────────────

export async function fetchHealth() {
  const res = await fetch('http://localhost:8000/health');
  return res.json();
}

// ── Transactions ───────────────────────────────────────────────────────────────

export async function fetchMonthlySummary(month?: number, year?: number) {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  const res = await authFetch(`${API_BASE}/transactions/summary/monthly?${params}`);
  return res.json();
}

export async function fetchTransactions(filters?: Record<string, string>) {
  const params = filters ? new URLSearchParams(filters).toString() : '';
  const res = await authFetch(`${API_BASE}/transactions/${params ? '?' + params : ''}`);
  return res.json();
}

export async function createTransaction(data: {
  merchant: string;
  description?: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category_id?: string;
  transaction_date?: string;
}) {
  const payload = {
    ...data,
    transaction_date: data.transaction_date
      ? (data.transaction_date.includes('T') ? data.transaction_date : `${data.transaction_date}T12:00:00`)
      : undefined,
  };
  const res = await authFetch(`${API_BASE}/transactions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (res.ok) notifyDataChanged();
  return json;
}

export async function deleteTransaction(txId: string) {
  const res = await authFetch(`${API_BASE}/transactions/${txId}`, { method: 'DELETE' });
  const json = await res.json().catch(() => ({}));
  if (res.ok) notifyDataChanged();
  return json;
}

export async function fetchCategories() {
  const res = await authFetch(`${API_BASE}/transactions/categories`);
  return res.json();
}

// ── Groups ─────────────────────────────────────────────────────────────────────

export async function fetchGroups() {
  const res = await authFetch(`${API_BASE}/groups/`);
  return res.json();
}

export async function createGroup(data: { name: string; description?: string; member_names?: string[] }) {
  const res = await authFetch(`${API_BASE}/groups/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_names: [], ...data }),
  });
  return res.json();
}

export async function fetchGroupBalances(groupId: string) {
  const res = await authFetch(`${API_BASE}/groups/${groupId}/balances`);
  return res.json();
}

export async function addGroupExpense(groupId: string, data: {
  description: string;
  amount: number;
  paid_by_name: string;
  paid_by: string;
  splits?: Array<{ user_id: string; user_name: string; amount_owed: number }>;
}) {
  const res = await authFetch(`${API_BASE}/groups/${groupId}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ splits: [], ...data }),
  });
  return res.json();
}

// ── Receipt OCR ───────────────────────────────────────────────────────────────

export async function scanReceipt(rawText = '', file?: File) {
  const formData = new FormData();
  if (rawText.trim()) formData.append('raw_text', rawText);
  if (file) formData.append('file', file);
  const res = await authFetch(`${API_BASE}/receipts/scan`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  if (res.ok) notifyDataChanged();
  return json;
}

export async function fetchReceipts() {
  const res = await authFetch(`${API_BASE}/receipts/`);
  return res.json();
}

// ── Intelligence ──────────────────────────────────────────────────────────────

export async function fetchCategorizeBenchmark(merchant: string, description: string) {
  const params = new URLSearchParams({ merchant, description }).toString();
  const res = await authFetch(`${API_BASE}/intelligence/categorize-benchmark?${params}`);
  return res.json();
}

export async function fetchAnomalies() {
  const res = await authFetch(`${API_BASE}/intelligence/anomalies`);
  return res.json();
}

export async function fetchRecurring() {
  const res = await authFetch(`${API_BASE}/intelligence/recurring`);
  return res.json();
}

export async function fetchCashflowForecast(days = 30) {
  const res = await authFetch(`${API_BASE}/intelligence/cashflow-forecast?days=${days}`);
  return res.json();
}

export async function fetchBudgets() {
  const res = await authFetch(`${API_BASE}/intelligence/budgets`);
  return res.json();
}

export async function fetchInsights() {
  const res = await authFetch(`${API_BASE}/intelligence/insights`);
  return res.json();
}

// ── Copilot ───────────────────────────────────────────────────────────────────

export async function queryCopilot(query: string) {
  const res = await authFetch(`${API_BASE}/copilot/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}
