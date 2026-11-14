import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
const EXPO_DIR = path.join(__dirname, 'expo-app');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.createHash('sha256').update(`paypulse-dev-${__dirname}`).digest('hex');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'user' | 'admin';
export type ServiceCategory =
  | 'mobile'
  | 'dth'
  | 'electricity'
  | 'broadband'
  | 'water'
  | 'gas';
export type TransactionType = 'RECHARGE' | 'BILL_PAY' | 'WALLET_TOPUP' | 'CASHBACK' | 'REFUND';
export type TransactionStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';

export interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  walletBalance: number;
  cashbackEarned: number;
  kycVerified: boolean;
  pushToken?: string;
  passwordHash: string;
  createdAt: string;
}

export interface PublicUser {
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

export interface NotificationItem {
  id: string;
  userId: string; // 'ALL' or specific userId
  title: string;
  body: string;
  category: 'transaction' | 'wallet' | 'promo' | 'system';
  readBy: string[];
  createdAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  operators: Operator[];
  plans: RechargePlan[];
  transactions: TransactionRecord[];
  notifications: NotificationItem[];
}

// ---------------------------------------------------------------------------
// Crypto & Auth Helpers
// ---------------------------------------------------------------------------

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHex] = stored.split(':');
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function signToken(user: StoredUser): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payloadObj: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${sig}`;
}

function verifyToken(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest()
  );
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as JwtPayload;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeUser(u: StoredUser): PublicUser {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    walletBalance: Number(u.walletBalance.toFixed(2)),
    cashbackEarned: Number(u.cashbackEarned.toFixed(2)),
    kycVerified: u.kycVerified,
    createdAt: u.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Persistent Store & Seed Data
// ---------------------------------------------------------------------------

function createSeedDatabase(): DatabaseSchema {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  const standardUser: StoredUser = {
    id: 'usr_demo_01',
    fullName: 'Aarav Mehta',
    email: 'user@paypulse.app',
    phone: '+91 98765 43210',
    role: 'user',
    walletBalance: 4850.0,
    cashbackEarned: 245.5,
    kycVerified: true,
    passwordHash: hashPassword('PayPulse@2026'),
    createdAt: hoursAgo(240),
  };

  const adminUser: StoredUser = {
    id: 'usr_admin_01',
    fullName: 'Priya Nair',
    email: 'admin@paypulse.app',
    phone: '+91 98200 11223',
    role: 'admin',
    walletBalance: 18400.0,
    cashbackEarned: 620.0,
    kycVerified: true,
    passwordHash: hashPassword('Admin@2026'),
    createdAt: hoursAgo(720),
  };

  const operators: Operator[] = [
    {
      id: 'op_airtel',
      name: 'Airtel Prepaid',
      code: 'AIRTEL',
      category: 'mobile',
      commissionRate: 0.025,
      cashbackRate: 0.02,
      active: true,
      accountLabel: 'Mobile Number',
      accountPlaceholder: 'Enter 10-digit mobile number',
    },
    {
      id: 'op_jio',
      name: 'Jio True 5G',
      code: 'JIO',
      category: 'mobile',
      commissionRate: 0.022,
      cashbackRate: 0.02,
      active: true,
      accountLabel: 'Mobile Number',
      accountPlaceholder: 'Enter 10-digit Jio number',
    },
    {
      id: 'op_vi',
      name: 'Vi Max',
      code: 'VI',
      category: 'mobile',
      commissionRate: 0.028,
      cashbackRate: 0.025,
      active: true,
      accountLabel: 'Mobile Number',
      accountPlaceholder: 'Enter 10-digit Vi number',
    },
    {
      id: 'op_bsnl',
      name: 'BSNL Mobile',
      code: 'BSNL',
      category: 'mobile',
      commissionRate: 0.035,
      cashbackRate: 0.03,
      active: true,
      accountLabel: 'Mobile Number',
      accountPlaceholder: 'Enter 10-digit BSNL number',
    },
    {
      id: 'op_tataplay',
      name: 'Tata Play DTH',
      code: 'TATAPLAY',
      category: 'dth',
      commissionRate: 0.03,
      cashbackRate: 0.02,
      active: true,
      accountLabel: 'Subscriber ID',
      accountPlaceholder: 'Enter 10-digit Subscriber ID',
    },
    {
      id: 'op_airteldth',
      name: 'Airtel Digital TV',
      code: 'AIRTELDTH',
      category: 'dth',
      commissionRate: 0.032,
      cashbackRate: 0.02,
      active: true,
      accountLabel: 'Customer ID',
      accountPlaceholder: 'Enter 10-digit Customer ID',
    },
    {
      id: 'op_dishtv',
      name: 'Dish TV',
      code: 'DISHTV',
      category: 'dth',
      commissionRate: 0.034,
      cashbackRate: 0.025,
      active: true,
      accountLabel: 'Viewing Card No.',
      accountPlaceholder: 'Enter 11-digit VC Number',
    },
    {
      id: 'op_bescom',
      name: 'BESCOM Electricity',
      code: 'BESCOM',
      category: 'electricity',
      commissionRate: 0.012,
      cashbackRate: 0.01,
      active: true,
      accountLabel: 'Consumer Account ID',
      accountPlaceholder: 'e.g. 4210984512',
    },
    {
      id: 'op_tatapower',
      name: 'Tata Power',
      code: 'TATAPWR',
      category: 'electricity',
      commissionRate: 0.015,
      cashbackRate: 0.01,
      active: true,
      accountLabel: 'Consumer Number',
      accountPlaceholder: 'e.g. 9001234567',
    },
    {
      id: 'op_jiofiber',
      name: 'JioFiber Broadband',
      code: 'JIOFIBER',
      category: 'broadband',
      commissionRate: 0.018,
      cashbackRate: 0.015,
      active: true,
      accountLabel: 'Service / Landline ID',
      accountPlaceholder: 'e.g. 08045129800',
    },
    {
      id: 'op_act',
      name: 'ACT Fibernet',
      code: 'ACT',
      category: 'broadband',
      commissionRate: 0.02,
      cashbackRate: 0.015,
      active: true,
      accountLabel: 'Account Number',
      accountPlaceholder: 'e.g. 1029384756',
    },
    {
      id: 'op_bwssb',
      name: 'BWSSB Water Board',
      code: 'BWSSB',
      category: 'water',
      commissionRate: 0.01,
      cashbackRate: 0.005,
      active: true,
      accountLabel: 'RR Number',
      accountPlaceholder: 'e.g. WTR778899',
    },
    {
      id: 'op_mgl',
      name: 'Mahanagar Piped Gas',
      code: 'MGL',
      category: 'gas',
      commissionRate: 0.014,
      cashbackRate: 0.01,
      active: true,
      accountLabel: 'CA Number',
      accountPlaceholder: 'e.g. 1100223344',
    },
  ];

  const plans: RechargePlan[] = [
    {
      id: 'pln_1',
      operatorId: 'op_airtel',
      category: 'mobile',
      title: 'True 5G Unlimited 84D',
      amount: 859,
      validity: '84 Days',
      data: '2 GB / Day',
      tag: 'Popular',
      description: 'Unlimited 5G data, unlimited voice calls, 100 SMS/day + Wynk Music.',
    },
    {
      id: 'pln_2',
      operatorId: 'op_airtel',
      category: 'mobile',
      title: 'Monthly Smart Pack',
      amount: 349,
      validity: '28 Days',
      data: '2 GB / Day',
      tag: 'Unlimited',
      description: 'Unlimited 5G on eligible devices, unlimited voice, Apollo 24/7 Circle.',
    },
    {
      id: 'pln_3',
      operatorId: 'op_airtel',
      category: 'mobile',
      title: 'Data Booster 50GB',
      amount: 301,
      validity: 'Existing Plan',
      data: '50 GB',
      tag: 'Data',
      description: 'High-speed 4G/5G add-on data pack with existing base validity.',
    },
    {
      id: 'pln_4',
      operatorId: 'op_airtel',
      category: 'mobile',
      title: 'Annual Value 365D',
      amount: 3599,
      validity: '365 Days',
      data: '2 GB / Day',
      tag: 'Annual',
      description: 'Full-year worry-free 5G & voice plan with OTT benefits.',
    },
    {
      id: 'pln_5',
      operatorId: 'op_jio',
      category: 'mobile',
      title: 'Jio 5G Hero 84D',
      amount: 799,
      validity: '84 Days',
      data: '1.5 GB / Day',
      tag: 'Popular',
      description: 'Unlimited voice, 100 SMS/day, JioTV, JioCinema & JioCloud.',
    },
    {
      id: 'pln_6',
      operatorId: 'op_jio',
      category: 'mobile',
      title: 'Jio True 5G 28D',
      amount: 299,
      validity: '28 Days',
      data: '1.5 GB / Day',
      tag: 'Unlimited',
      description: 'Everyday value pack with unlimited calls and Jio apps suite.',
    },
    {
      id: 'pln_7',
      operatorId: 'op_jio',
      category: 'mobile',
      title: 'Jio Work-From-Home',
      amount: 219,
      validity: '30 Days',
      data: '30 GB',
      tag: 'Data',
      description: 'Pure high-speed 30 GB data voucher for remote work & travel.',
    },
    {
      id: 'pln_8',
      operatorId: 'op_vi',
      category: 'mobile',
      title: 'Vi Hero Unlimited',
      amount: 859,
      validity: '84 Days',
      data: '1.5 GB / Day',
      tag: 'Popular',
      description: 'Binge All Night (12AM–6AM) + Weekend Data Rollover.',
    },
    {
      id: 'pln_9',
      operatorId: 'op_bsnl',
      category: 'mobile',
      title: 'BSNL STV 599',
      amount: 599,
      validity: '84 Days',
      data: '3 GB / Day',
      tag: 'Popular',
      description: '3 GB daily data + unlimited local & STD calls across India.',
    },
    {
      id: 'pln_10',
      operatorId: 'op_tataplay',
      category: 'dth',
      title: 'Hindi Sports & HD Pack',
      amount: 499,
      validity: '30 Days',
      data: '115+ HD Channels',
      tag: 'Entertainment',
      description: 'Star Sports HD, Sony Six, Zee, Colors & 80 FTA channels.',
    },
    {
      id: 'pln_11',
      operatorId: 'op_tataplay',
      category: 'dth',
      title: 'Family Value Lite',
      amount: 299,
      validity: '30 Days',
      data: '85+ Channels',
      tag: 'Popular',
      description: 'Daily soaps, kids, news and regional entertainment bundle.',
    },
    {
      id: 'pln_12',
      operatorId: 'op_airteldth',
      category: 'dth',
      title: 'Dabangg Sports HD',
      amount: 460,
      validity: '30 Days',
      data: '105+ Channels',
      tag: 'Entertainment',
      description: 'Live cricket, cinema & news HD channels.',
    },
    {
      id: 'pln_13',
      operatorId: 'op_dishtv',
      category: 'dth',
      title: 'Super Family HD',
      amount: 390,
      validity: '30 Days',
      data: '95+ Channels',
      tag: 'Popular',
      description: 'Complete family entertainment in crisp HD quality.',
    },
  ];

  const transactions: TransactionRecord[] = [
    {
      id: 'txn_9001',
      referenceId: 'PP2611139001',
      userId: standardUser.id,
      userEmail: standardUser.email,
      userName: standardUser.fullName,
      type: 'RECHARGE',
      category: 'mobile',
      operatorId: 'op_airtel',
      operatorName: 'Airtel Prepaid',
      accountNumber: '9876543210',
      circle: 'Karnataka',
      amount: 859,
      fee: 0,
      cashback: 17.18,
      commission: 21.48,
      status: 'SUCCESS',
      paymentMethod: 'WALLET',
      metadata: { planTitle: 'True 5G Unlimited 84D' },
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
    },
    {
      id: 'txn_9002',
      referenceId: 'PP2611139002',
      userId: standardUser.id,
      userEmail: standardUser.email,
      userName: standardUser.fullName,
      type: 'BILL_PAY',
      category: 'electricity',
      operatorId: 'op_bescom',
      operatorName: 'BESCOM Electricity',
      accountNumber: '4210984512',
      amount: 2140,
      fee: 0,
      cashback: 21.4,
      commission: 25.68,
      status: 'SUCCESS',
      paymentMethod: 'WALLET',
      metadata: { billCycle: 'Oct 2026', consumerName: 'Aarav Mehta' },
      createdAt: hoursAgo(26),
      updatedAt: hoursAgo(26),
    },
    {
      id: 'txn_9003',
      referenceId: 'PP2611139003',
      userId: standardUser.id,
      userEmail: standardUser.email,
      userName: standardUser.fullName,
      type: 'RECHARGE',
      category: 'dth',
      operatorId: 'op_tataplay',
      operatorName: 'Tata Play DTH',
      accountNumber: '1049283746',
      amount: 499,
      fee: 0,
      cashback: 9.98,
      commission: 14.97,
      status: 'PENDING',
      paymentMethod: 'WALLET',
      metadata: { planTitle: 'Hindi Sports & HD Pack' },
      createdAt: hoursAgo(1),
      updatedAt: hoursAgo(1),
    },
    {
      id: 'txn_9004',
      referenceId: 'PP2611139004',
      userId: standardUser.id,
      userEmail: standardUser.email,
      userName: standardUser.fullName,
      type: 'WALLET_TOPUP',
      category: 'wallet',
      operatorName: 'PayPulse Wallet',
      accountNumber: 'UPI-9876543210',
      amount: 5000,
      fee: 0,
      cashback: 0,
      commission: 0,
      status: 'SUCCESS',
      paymentMethod: 'UPI',
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(48),
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'ntf_1',
      userId: standardUser.id,
      title: 'Mobile Recharge Successful',
      body: '₹859.00 Airtel Prepaid recharge for 9876543210 completed. ₹17.18 cashback credited.',
      category: 'transaction',
      readBy: [],
      createdAt: hoursAgo(3),
    },
    {
      id: 'ntf_2',
      userId: standardUser.id,
      title: 'DTH Order Awaiting Operator Confirmation',
      body: 'Your ₹499.00 Tata Play DTH order (PP2611139003) is queued with operator.',
      category: 'transaction',
      readBy: [],
      createdAt: hoursAgo(1),
    },
    {
      id: 'ntf_3',
      userId: 'ALL',
      title: 'Zero Convenience Fee on Utility Bills',
      body: 'Pay Electricity, Water, and Piped Gas bills via PayPulse Wallet with 0% platform fee and instant cashback.',
      category: 'promo',
      readBy: [],
      createdAt: hoursAgo(12),
    },
  ];

  return {
    users: [standardUser, adminUser],
    operators,
    plans,
    transactions,
    notifications,
  };
}

class PersistentStore {
  private db: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.db = JSON.parse(raw) as DatabaseSchema;
      } catch {
        this.db = createSeedDatabase();
        this.save();
      }
    } else {
      this.db = createSeedDatabase();
      this.save();
    }
  }

  save() {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  }

  get data(): DatabaseSchema {
    return this.db;
  }
}

const store = new PersistentStore();

// Replay-protection nonce cache (rolling 10-minute window)
const seenNonces = new Map<string, number>();
function checkReplayGuard(req: Request): boolean {
  const nonce = req.header('x-request-nonce');
  const tsRaw = req.header('x-request-timestamp');
  if (!nonce || !tsRaw) return true; // Optional for simple browser calls, enforced when present
  const ts = Number(tsRaw);
  const now = Date.now();
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 10 * 60 * 1000) {
    return false;
  }
  // Prune expired nonces
  for (const [k, exp] of seenNonces.entries()) {
    if (exp < now) seenNonces.delete(k);
  }
  if (seenNonces.has(nonce)) {
    return false;
  }
  seenNonces.set(nonce, now + 10 * 60 * 1000);
  return true;
}

// ---------------------------------------------------------------------------
// Express Middleware & Routes
// ---------------------------------------------------------------------------

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!checkReplayGuard(req)) {
    res.status(401).json({ error: 'Invalid or replayed request nonce' });
    return;
  }
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid token' });
    return;
  }
  const user = store.data.users.find((u) => u.id === payload.sub);
  if (!user) {
    res.status(401).json({ error: 'User account not found' });
    return;
  }
  req.authUser = user;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }
  next();
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

function genReference(): string {
  const num = crypto.randomInt(100000, 999999);
  return `PP${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${num}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'paypulse-api', timestamp: new Date().toISOString() });
  });

  // Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');

    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (store.data.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const newUser: StoredUser = {
      id: genId('usr'),
      fullName,
      email,
      phone,
      role: 'user',
      walletBalance: 1000.0, // Welcome bonus balance for immediate testing
      cashbackEarned: 0,
      kycVerified: true,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    store.data.users.push(newUser);
    store.data.notifications.unshift({
      id: genId('ntf'),
      userId: newUser.id,
      title: 'Welcome to PayPulse',
      body: 'Your account is active with ₹1,000.00 starter wallet balance ready for recharge & bill payments.',
      category: 'wallet',
      readBy: [],
      createdAt: new Date().toISOString(),
    });
    store.save();

    const token = signToken(newUser);
    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = store.data.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  });

  // Auth: Current Profile
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.authUser!) });
  });

  // Push Notification Token Registration (Expo Push Token)
  app.post('/api/notifications/push-token', requireAuth, (req: AuthedRequest, res) => {
    const pushToken = String(req.body?.pushToken || '').trim();
    if (!pushToken) {
      res.status(400).json({ error: 'Push token is required.' });
      return;
    }
    req.authUser!.pushToken = pushToken;
    store.save();
    res.json({ ok: true });
  });

  // Operators & Plans Catalog
  app.get('/api/operators', (req, res) => {
    const category = req.query.category as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';
    let list = store.data.operators;
    if (!includeInactive) {
      list = list.filter((op) => op.active);
    }
    if (category) {
      list = list.filter((op) => op.category === category);
    }
    res.json({ operators: list });
  });

  app.get('/api/plans', (req, res) => {
    const operatorId = req.query.operatorId as string | undefined;
    const category = req.query.category as string | undefined;
    let plans = store.data.plans;
    if (operatorId) {
      plans = plans.filter((p) => p.operatorId === operatorId);
    }
    if (category) {
      plans = plans.filter((p) => p.category === category);
    }
    res.json({ plans });
  });

  // Fetch Utility Bill Details (BBPS-style lookup)
  app.post('/api/bills/fetch', requireAuth, (req: AuthedRequest, res) => {
    const operatorId = String(req.body?.operatorId || '');
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const operator = store.data.operators.find((o) => o.id === operatorId && o.active);
    if (!operator) {
      res.status(404).json({ error: 'Selected utility provider is unavailable.' });
      return;
    }
    if (accountNumber.length < 6 || accountNumber.length > 24) {
      res.status(400).json({ error: `Enter a valid ${operator.accountLabel}.` });
      return;
    }

    // Deterministic bill generation from accountNumber hash
    const hash = crypto.createHash('sha256').update(`${operatorId}:${accountNumber}`).digest();
    const baseAmount = 320 + ((hash[0] * 17 + hash[1] * 7) % 3400);
    const amount = Math.round(baseAmount / 5) * 5;
    const dueDays = 4 + (hash[2] % 11);
    const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10);

    res.json({
      bill: {
        operatorId: operator.id,
        operatorName: operator.name,
        category: operator.category,
        accountNumber,
        consumerName: req.authUser!.fullName,
        billNumber: `BBPS-${hash.subarray(0, 4).toString('hex').toUpperCase()}`,
        billDate: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10),
        dueDate,
        amount,
        billCycle: 'Nov 2026',
        cashbackRate: operator.cashbackRate,
      },
    });
  });

  // Wallet Top-Up
  app.post('/api/wallet/topup', requireAuth, (req: AuthedRequest, res) => {
    const amount = Number(req.body?.amount);
    const method = String(req.body?.paymentMethod || 'UPI').toUpperCase() as
      | 'UPI'
      | 'CARD'
      | 'NETBANKING';
    if (!Number.isFinite(amount) || amount < 50 || amount > 50000) {
      res.status(400).json({ error: 'Top-up amount must be between ₹50 and ₹50,000.' });
      return;
    }
    if (!['UPI', 'CARD', 'NETBANKING'].includes(method)) {
      res.status(400).json({ error: 'Unsupported payment method.' });
      return;
    }

    const user = req.authUser!;
    user.walletBalance = Number((user.walletBalance + amount).toFixed(2));

    const nowIso = new Date().toISOString();
    const txn: TransactionRecord = {
      id: genId('txn'),
      referenceId: genReference(),
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      type: 'WALLET_TOPUP',
      category: 'wallet',
      operatorName: 'PayPulse Wallet',
      accountNumber: `${method}-${user.phone.slice(-4)}`,
      amount,
      fee: 0,
      cashback: 0,
      commission: 0,
      status: 'SUCCESS',
      paymentMethod: method,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.data.transactions.unshift(txn);
    store.data.notifications.unshift({
      id: genId('ntf'),
      userId: user.id,
      title: 'Wallet Credited',
      body: `₹${amount.toFixed(2)} added via ${method}. New balance: ₹${user.walletBalance.toFixed(2)}.`,
      category: 'wallet',
      readBy: [],
      createdAt: nowIso,
    });
    store.save();

    res.status(201).json({ transaction: txn, user: sanitizeUser(user) });
  });

  // Execute Mobile / DTH Recharge
  app.post('/api/transactions/recharge', requireAuth, (req: AuthedRequest, res) => {
    const operatorId = String(req.body?.operatorId || '');
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const circle = String(req.body?.circle || 'All India').trim();
    const planId = req.body?.planId ? String(req.body.planId) : undefined;
    const requestedAmount = Number(req.body?.amount);

    const operator = store.data.operators.find((o) => o.id === operatorId);
    if (!operator || !operator.active) {
      res.status(400).json({ error: 'Operator is currently unavailable.' });
      return;
    }
    if (!['mobile', 'dth'].includes(operator.category)) {
      res.status(400).json({ error: 'Selected operator is not a Mobile or DTH provider.' });
      return;
    }
    if (!/^[a-zA-Z0-9]{8,14}$/.test(accountNumber)) {
      res.status(400).json({ error: `Enter a valid ${operator.accountLabel} (8-14 characters).` });
      return;
    }

    const matchedPlan = planId ? store.data.plans.find((p) => p.id === planId) : undefined;
    const amount = matchedPlan ? matchedPlan.amount : requestedAmount;

    if (!Number.isFinite(amount) || amount < 10 || amount > 25000) {
      res.status(400).json({ error: 'Recharge amount must be between ₹10 and ₹25,000.' });
      return;
    }

    const user = req.authUser!;
    if (user.walletBalance < amount) {
      res.status(400).json({ error: 'Insufficient wallet balance. Please top up your wallet.' });
      return;
    }

    const cashback = Number((amount * operator.cashbackRate).toFixed(2));
    const commission = Number((amount * operator.commissionRate).toFixed(2));
    user.walletBalance = Number((user.walletBalance - amount + cashback).toFixed(2));
    user.cashbackEarned = Number((user.cashbackEarned + cashback).toFixed(2));

    const nowIso = new Date().toISOString();
    const txn: TransactionRecord = {
      id: genId('txn'),
      referenceId: genReference(),
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      type: 'RECHARGE',
      category: operator.category,
      operatorId: operator.id,
      operatorName: operator.name,
      accountNumber,
      circle,
      amount,
      fee: 0,
      cashback,
      commission,
      status: 'SUCCESS',
      paymentMethod: 'WALLET',
      metadata: matchedPlan ? { planTitle: matchedPlan.title, validity: matchedPlan.validity } : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.data.transactions.unshift(txn);
    store.data.notifications.unshift({
      id: genId('ntf'),
      userId: user.id,
      title: `${operator.category === 'dth' ? 'DTH' : 'Mobile'} Recharge Successful`,
      body: `₹${amount.toFixed(2)} ${operator.name} recharge for ${accountNumber} succeeded. Earned ₹${cashback.toFixed(2)} cashback.`,
      category: 'transaction',
      readBy: [],
      createdAt: nowIso,
    });
    store.save();

    res.status(201).json({ transaction: txn, user: sanitizeUser(user) });
  });

  // Execute Utility Bill Payment
  app.post('/api/transactions/bill-pay', requireAuth, (req: AuthedRequest, res) => {
    const operatorId = String(req.body?.operatorId || '');
    const accountNumber = String(req.body?.accountNumber || '').trim();
    const amount = Number(req.body?.amount);
    const billNumber = String(req.body?.billNumber || '').trim();

    const operator = store.data.operators.find((o) => o.id === operatorId);
    if (!operator || !operator.active) {
      res.status(400).json({ error: 'Biller is currently unavailable.' });
      return;
    }
    if (!['electricity', 'broadband', 'water', 'gas'].includes(operator.category)) {
      res.status(400).json({ error: 'Selected provider is not a utility biller.' });
      return;
    }
    if (accountNumber.length < 6 || accountNumber.length > 24) {
      res.status(400).json({ error: `Invalid ${operator.accountLabel}.` });
      return;
    }
    if (!Number.isFinite(amount) || amount < 10 || amount > 50000) {
      res.status(400).json({ error: 'Bill amount must be between ₹10 and ₹50,000.' });
      return;
    }

    const user = req.authUser!;
    if (user.walletBalance < amount) {
      res.status(400).json({ error: 'Insufficient wallet balance. Please top up your wallet.' });
      return;
    }

    const cashback = Number((amount * operator.cashbackRate).toFixed(2));
    const commission = Number((amount * operator.commissionRate).toFixed(2));
    user.walletBalance = Number((user.walletBalance - amount + cashback).toFixed(2));
    user.cashbackEarned = Number((user.cashbackEarned + cashback).toFixed(2));

    const nowIso = new Date().toISOString();
    const txn: TransactionRecord = {
      id: genId('txn'),
      referenceId: genReference(),
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      type: 'BILL_PAY',
      category: operator.category,
      operatorId: operator.id,
      operatorName: operator.name,
      accountNumber,
      amount,
      fee: 0,
      cashback,
      commission,
      status: 'SUCCESS',
      paymentMethod: 'WALLET',
      metadata: billNumber ? { billNumber } : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.data.transactions.unshift(txn);
    store.data.notifications.unshift({
      id: genId('ntf'),
      userId: user.id,
      title: 'Utility Bill Paid',
      body: `₹${amount.toFixed(2)} paid to ${operator.name} (${accountNumber}). ₹${cashback.toFixed(2)} cashback credited.`,
      category: 'transaction',
      readBy: [],
      createdAt: nowIso,
    });
    store.save();

    res.status(201).json({ transaction: txn, user: sanitizeUser(user) });
  });

  // User Transaction History
  app.get('/api/transactions', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const txns = store.data.transactions.filter((t) => t.userId === user.id);
    res.json({ transactions: txns });
  });

  // Notifications
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const items = store.data.notifications
      .filter((n) => n.userId === user.id || n.userId === 'ALL')
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        category: n.category,
        read: n.readBy.includes(user.id),
        createdAt: n.createdAt,
      }));
    const unreadCount = items.filter((i) => !i.read).length;
    res.json({ notifications: items, unreadCount });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const item = store.data.notifications.find((n) => n.id === req.params.id);
    if (!item || (item.userId !== user.id && item.userId !== 'ALL')) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    if (!item.readBy.includes(user.id)) {
      item.readBy.push(user.id);
      store.save();
    }
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    for (const item of store.data.notifications) {
      if ((item.userId === user.id || item.userId === 'ALL') && !item.readBy.includes(user.id)) {
        item.readBy.push(user.id);
      }
    }
    store.save();
    res.json({ ok: true });
  });

  // Admin: Overview & Analytics
  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
    const txns = store.data.transactions;
    const grossVolume = txns
      .filter((t) => t.status === 'SUCCESS' && t.type !== 'WALLET_TOPUP')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCommission = txns
      .filter((t) => t.status === 'SUCCESS')
      .reduce((sum, t) => sum + t.commission, 0);
    const pendingCount = txns.filter((t) => t.status === 'PENDING').length;
    const completedCount = txns.filter((t) => t.status === 'SUCCESS').length;
    const successRate =
      txns.length > 0 ? Number(((completedCount / txns.length) * 100).toFixed(1)) : 100;

    res.json({
      metrics: {
        grossVolume: Number(grossVolume.toFixed(2)),
        totalCommission: Number(totalCommission.toFixed(2)),
        totalUsers: store.data.users.length,
        totalTransactions: txns.length,
        pendingCount,
        successRate,
      },
      transactions: txns,
      users: store.data.users.map(sanitizeUser),
      operators: store.data.operators,
    });
  });

  // Admin: Moderate Transaction Status (Approve / Fail / Refund)
  app.patch(
    '/api/admin/transactions/:id/status',
    requireAuth,
    requireAdmin,
    (req: AuthedRequest, res) => {
      const nextStatus = String(req.body?.status || '').toUpperCase() as TransactionStatus;
      if (!['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'].includes(nextStatus)) {
        res.status(400).json({ error: 'Invalid transaction status.' });
        return;
      }

      const txn = store.data.transactions.find((t) => t.id === req.params.id);
      if (!txn) {
        res.status(404).json({ error: 'Transaction not found.' });
        return;
      }

      const prevStatus = txn.status;
      if (prevStatus === nextStatus) {
        res.json({ transaction: txn });
        return;
      }

      const targetUser = store.data.users.find((u) => u.id === txn.userId);
      // Refund wallet if transitioning from PENDING/SUCCESS to REFUNDED or FAILED on a debit txn
      if (
        targetUser &&
        txn.type !== 'WALLET_TOPUP' &&
        (prevStatus === 'PENDING' || prevStatus === 'SUCCESS') &&
        (nextStatus === 'REFUNDED' || nextStatus === 'FAILED')
      ) {
        const netDebit = Math.max(0, txn.amount - txn.cashback);
        targetUser.walletBalance = Number((targetUser.walletBalance + netDebit).toFixed(2));
        targetUser.cashbackEarned = Math.max(
          0,
          Number((targetUser.cashbackEarned - txn.cashback).toFixed(2))
        );
      }

      txn.status = nextStatus;
      txn.updatedAt = new Date().toISOString();

      store.data.notifications.unshift({
        id: genId('ntf'),
        userId: txn.userId,
        title: `Transaction ${nextStatus}`,
        body: `Order ${txn.referenceId} (${txn.operatorName} ₹${txn.amount.toFixed(2)}) updated to ${nextStatus}.`,
        category: 'system',
        readBy: [],
        createdAt: new Date().toISOString(),
      });
      store.save();

      res.json({ transaction: txn });
    }
  );

  // Admin: Toggle Operator Status
  app.patch('/api/admin/operators/:id/toggle', requireAuth, requireAdmin, (req, res) => {
    const op = store.data.operators.find((o) => o.id === req.params.id);
    if (!op) {
      res.status(404).json({ error: 'Operator not found.' });
      return;
    }
    op.active = !op.active;
    store.save();
    res.json({ operator: op });
  });

  // Admin: Broadcast Notification
  app.post('/api/admin/broadcast', requireAuth, requireAdmin, (req, res) => {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const category = (String(req.body?.category || 'system') as NotificationItem['category']);
    if (title.length < 3 || body.length < 5) {
      res.status(400).json({ error: 'Title and message body are required.' });
      return;
    }
    const item: NotificationItem = {
      id: genId('ntf'),
      userId: 'ALL',
      title,
      body,
      category: ['transaction', 'wallet', 'promo', 'system'].includes(category)
        ? category
        : 'system',
      readBy: [],
      createdAt: new Date().toISOString(),
    };
    store.data.notifications.unshift(item);
    store.save();
    res.status(201).json({ notification: item });
  });

  // Expo Source Explorer endpoint (reads /expo-app files dynamically for inspection)
  app.get('/api/expo-files', (_req, res) => {
    const files: { path: string; content: string; language: string }[] = [];
    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.expo') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const rel = path.relative(EXPO_DIR, full).replace(/\\/g, '/');
          const ext = path.extname(entry.name).slice(1);
          const lang =
            ext === 'json' ? 'json' : ext === 'js' ? 'javascript' : 'typescript';
          files.push({
            path: `expo-app/${rel}`,
            content: fs.readFileSync(full, 'utf8'),
            language: lang,
          });
        }
      }
    }
    walk(EXPO_DIR);
    files.sort((a, b) => a.path.localeCompare(b.path));
    res.json({ files });
  });

  const httpServer = http.createServer(app);

  // Vite Dev Middleware or Static Production Serve
  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    if (hmrDisabled) {
      app.use((req, res, next) => {
        if (req.url === '/@vite/client' || req.url.startsWith('/@vite/client?')) {
          res.setHeader('Content-Type', 'application/javascript');
          res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    prune() {},
    dispose() {},
    invalidate() {},
    decline() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay {}
`);
          return;
        }
        next();
      });
    }
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PayPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
