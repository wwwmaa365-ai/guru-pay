import {
  AdminOverview,
  ApiTraceEntry,
  AppNotification,
  ExpoSourceFile,
  FetchedBill,
  Operator,
  RechargePlan,
  ServiceCategory,
  TransactionRecord,
  TransactionStatus,
  UserProfile,
} from './types';

const TOKEN_STORAGE_KEY = 'paypulse_web_token';

type TraceListener = (entry: ApiTraceEntry) => void;
const listeners = new Set<TraceListener>();

export function subscribeApiTrace(fn: TraceListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // ignore storage errors
  }
}

export class WebApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const started = performance.now();
  const nonce =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Timestamp': String(Date.now()),
    'X-Request-Nonce': nonce,
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(path, { ...options, headers });
  const durationMs = Math.round(performance.now() - started);

  const trace: ApiTraceEntry = {
    id: nonce,
    method: options.method || 'GET',
    path,
    status: res.status,
    durationMs,
    timestamp: new Date().toLocaleTimeString(),
  };
  listeners.forEach((fn) => fn(trace));

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WebApiError(data?.error || 'Request failed', res.status);
  }
  return data as T;
}

export const webApi = {
  register(payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) {
    return request<{ token: string; user: UserProfile }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      false
    );
  },

  login(payload: { email: string; password: string }) {
    return request<{ token: string; user: UserProfile }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false
    );
  },

  getProfile() {
    return request<{ user: UserProfile }>('/api/auth/me');
  },

  getOperators(category?: ServiceCategory) {
    const q = category ? `?category=${encodeURIComponent(category)}` : '';
    return request<{ operators: Operator[] }>(`/api/operators${q}`, {}, false);
  },

  getPlans(operatorId: string) {
    return request<{ plans: RechargePlan[] }>(
      `/api/plans?operatorId=${encodeURIComponent(operatorId)}`,
      {},
      false
    );
  },

  fetchBill(operatorId: string, accountNumber: string) {
    return request<{ bill: FetchedBill }>('/api/bills/fetch', {
      method: 'POST',
      body: JSON.stringify({ operatorId, accountNumber }),
    });
  },

  topUpWallet(amount: number, paymentMethod: 'UPI' | 'CARD' | 'NETBANKING') {
    return request<{ transaction: TransactionRecord; user: UserProfile }>(
      '/api/wallet/topup',
      {
        method: 'POST',
        body: JSON.stringify({ amount, paymentMethod }),
      }
    );
  },

  executeRecharge(payload: {
    operatorId: string;
    accountNumber: string;
    circle?: string;
    planId?: string;
    amount: number;
  }) {
    return request<{ transaction: TransactionRecord; user: UserProfile }>(
      '/api/transactions/recharge',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  payUtilityBill(payload: {
    operatorId: string;
    accountNumber: string;
    amount: number;
    billNumber?: string;
  }) {
    return request<{ transaction: TransactionRecord; user: UserProfile }>(
      '/api/transactions/bill-pay',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  getTransactions() {
    return request<{ transactions: TransactionRecord[] }>('/api/transactions');
  },

  getNotifications() {
    return request<{ notifications: AppNotification[]; unreadCount: number }>(
      '/api/notifications'
    );
  },

  markNotificationRead(id: string) {
    return request<{ ok: boolean }>(`/api/notifications/${id}/read`, {
      method: 'POST',
    });
  },

  markAllNotificationsRead() {
    return request<{ ok: boolean }>('/api/notifications/read-all', {
      method: 'POST',
    });
  },

  getAdminOverview() {
    return request<AdminOverview>('/api/admin/overview');
  },

  updateTransactionStatus(id: string, status: TransactionStatus) {
    return request<{ transaction: TransactionRecord }>(
      `/api/admin/transactions/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
  },

  toggleOperator(id: string) {
    return request<{ operator: Operator }>(`/api/admin/operators/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  broadcastNotification(payload: {
    title: string;
    body: string;
    category: 'transaction' | 'wallet' | 'promo' | 'system';
  }) {
    return request('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getExpoFiles() {
    return request<{ files: ExpoSourceFile[] }>('/api/expo-files', {}, false);
  },
};
