export type UserRole = 'user' | 'admin';

export type ServiceCategory =
  | 'mobile'
  | 'dth'
  | 'electricity'
  | 'broadband'
  | 'water'
  | 'gas';

export type TransactionType =
  | 'RECHARGE'
  | 'BILL_PAY'
  | 'WALLET_TOPUP'
  | 'CASHBACK'
  | 'REFUND';

export type TransactionStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  walletBalance: number;
  cashbackEarned: number;
  kycVerified: boolean;
  createdAt: string;
}

export interface Operator {
  id: string;
  name: string;
  code: string;
  category: ServiceCategory;
  commissionRate: number;
  cashbackRate: number;
  active: boolean;
  accountLabel: string;
  accountPlaceholder: string;
}

export interface RechargePlan {
  id: string;
  operatorId: string;
  category: 'mobile' | 'dth';
  title: string;
  amount: number;
  validity: string;
  data: string;
  tag: 'Popular' | 'Data' | 'Unlimited' | 'Annual' | 'Entertainment';
  description: string;
}

export interface FetchedBill {
  operatorId: string;
  operatorName: string;
  category: ServiceCategory;
  accountNumber: string;
  consumerName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  amount: number;
  billCycle: string;
  cashbackRate: number;
}

export interface TransactionRecord {
  id: string;
  referenceId: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: TransactionType;
  category: ServiceCategory | 'wallet';
  operatorId?: string;
  operatorName: string;
  accountNumber: string;
  circle?: string;
  amount: number;
  fee: number;
  cashback: number;
  commission: number;
  status: TransactionStatus;
  paymentMethod: 'WALLET' | 'UPI' | 'CARD' | 'NETBANKING';
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: 'transaction' | 'wallet' | 'promo' | 'system';
  read: boolean;
  createdAt: string;
}

export interface AdminOverview {
  metrics: {
    grossVolume: number;
    totalCommission: number;
    totalUsers: number;
    totalTransactions: number;
    pendingCount: number;
    successRate: number;
  };
  transactions: TransactionRecord[];
  users: UserProfile[];
  operators: Operator[];
}
