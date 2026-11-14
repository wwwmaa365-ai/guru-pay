import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  AdminOverview,
  AppNotification,
  FetchedBill,
  Operator,
  RechargePlan,
  ServiceCategory,
  TransactionRecord,
  TransactionStatus,
  UserProfile,
} from '../types';

const TOKEN_KEY = 'paypulse_jwt_token';
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Timestamp': String(Date.now()),
    'X-Request-Nonce': Crypto.randomUUID(),
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = await getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data?.error || 'Request failed', response.status);
  }
  return data as T;
}

export const api = {
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

  registerPushToken(pushToken: string) {
    return request<{ ok: boolean }>('/api/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
    });
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
};
