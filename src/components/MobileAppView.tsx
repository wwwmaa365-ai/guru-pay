import {
  ArrowDownLeft,
  ArrowLeft,
  Bell,
  CheckCircle2,
  CreditCard,
  Flame,
  History,
  Home,
  Plus,
  Receipt,
  ShieldCheck,
  Smartphone,
  Tv,
  Wallet,
  Wifi,
  Zap,
  Droplets,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { saveToken, webApi, WebApiError } from '../api';
import {
  ApiTraceEntry,
  AppNotification,
  FetchedBill,
  Operator,
  RechargePlan,
  ServiceCategory,
  TransactionRecord,
  UserProfile,
} from '../types';

interface MobileAppViewProps {
  user: UserProfile | null;
  unreadCount: number;
  traces: ApiTraceEntry[];
  onAuthSuccess: (user: UserProfile, token: string) => void;
  onRefreshUser: () => Promise<void>;
  onOpenAdmin: () => void;
}

type MobileScreen =
  | 'home'
  | 'recharge'
  | 'bills'
  | 'wallet'
  | 'history'
  | 'notifications';

const SERVICE_TILES: {
  id: ServiceCategory;
  label: string;
  screen: 'recharge' | 'bills';
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}[] = [
  { id: 'mobile', label: 'Mobile', screen: 'recharge', icon: Smartphone, tint: 'bg-emerald-50 text-emerald-700' },
  { id: 'dth', label: 'DTH TV', screen: 'recharge', icon: Tv, tint: 'bg-sky-50 text-sky-700' },
  { id: 'electricity', label: 'Electricity', screen: 'bills', icon: Zap, tint: 'bg-amber-50 text-amber-700' },
  { id: 'broadband', label: 'Broadband', screen: 'bills', icon: Wifi, tint: 'bg-indigo-50 text-indigo-700' },
  { id: 'water', label: 'Water', screen: 'bills', icon: Droplets, tint: 'bg-cyan-50 text-cyan-700' },
  { id: 'gas', label: 'Piped Gas', screen: 'bills', icon: Flame, tint: 'bg-orange-50 text-orange-700' },
];

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  user,
  unreadCount,
  traces,
  onAuthSuccess,
  onRefreshUser,
  onOpenAdmin,
}) => {
  const [screen, setScreen] = useState<MobileScreen>('home');

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('user@paypulse.app');
  const [password, setPassword] = useState('PayPulse@2026');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Data state
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [plans, setPlans] = useState<RechargePlan[]>([]);

  // Recharge state
  const [rechargeCat, setRechargeCat] = useState<'mobile' | 'dth'>('mobile');
  const [selectedOp, setSelectedOp] = useState<Operator | null>(null);
  const [accountNumber, setAccountNumber] = useState('9876543210');
  const [circle, setCircle] = useState('Karnataka');
  const [selectedPlan, setSelectedPlan] = useState<RechargePlan | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [flowError, setFlowError] = useState<string | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);
  const [receipt, setReceipt] = useState<TransactionRecord | null>(null);

  // Bill payment state
  const [billCat, setBillCat] = useState<Exclude<ServiceCategory, 'mobile' | 'dth'>>('electricity');
  const [billOp, setBillOp] = useState<Operator | null>(null);
  const [billConsumer, setBillConsumer] = useState('4210984512');
  const [fetchedBill, setFetchedBill] = useState<FetchedBill | null>(null);

  // Wallet state
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [topUpMethod, setTopUpMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [walletNotice, setWalletNotice] = useState<string | null>(null);

  // History filter
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'RECHARGE' | 'BILL_PAY' | 'WALLET_TOPUP'>('ALL');

  const loadUserActivity = useCallback(async () => {
    if (!user) return;
    try {
      const [txnRes, ntfRes] = await Promise.all([
        webApi.getTransactions(),
        webApi.getNotifications(),
      ]);
      setTransactions(txnRes.transactions);
      setNotifications(ntfRes.notifications);
    } catch {
      // handled silently
    }
  }, [user]);

  useEffect(() => {
    loadUserActivity();
  }, [loadUserActivity]);

  useEffect(() => {
    if (screen === 'recharge') {
      setFlowError(null);
      webApi.getOperators(rechargeCat).then((res) => {
        setOperators(res.operators);
        const first = res.operators[0] || null;
        setSelectedOp(first);
        setSelectedPlan(null);
        setAccountNumber(rechargeCat === 'mobile' ? '9876543210' : '1049283746');
        if (first) {
          webApi.getPlans(first.id).then((p) => setPlans(p.plans));
        } else {
          setPlans([]);
        }
      });
    }
  }, [screen, rechargeCat]);

  useEffect(() => {
    if (screen === 'bills') {
      setFlowError(null);
      setFetchedBill(null);
      webApi.getOperators(billCat).then((res) => {
        setOperators(res.operators);
        setBillOp(res.operators[0] || null);
      });
    }
  }, [screen, billCat]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res =
        authMode === 'login'
          ? await webApi.login({ email: email.trim(), password })
          : await webApi.register({
              fullName: fullName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              password,
            });
      saveToken(res.token);
      onAuthSuccess(res.user, res.token);
    } catch (err) {
      setAuthError(err instanceof WebApiError ? err.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const quickLogin = async (role: 'user' | 'admin') => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const creds =
        role === 'admin'
          ? { email: 'admin@paypulse.app', password: 'Admin@2026' }
          : { email: 'user@paypulse.app', password: 'PayPulse@2026' };
      const res = await webApi.login(creds);
      saveToken(res.token);
      onAuthSuccess(res.user, res.token);
    } catch (err) {
      setAuthError(err instanceof WebApiError ? err.message : 'Quick sign-in failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectRechargeOp = async (op: Operator) => {
    setSelectedOp(op);
    setSelectedPlan(null);
    const res = await webApi.getPlans(op.id);
    setPlans(res.plans);
  };

  const handleExecuteRecharge = async () => {
    if (!selectedOp) return;
    setFlowError(null);
    const amount = selectedPlan ? selectedPlan.amount : Number(customAmount);
    if (!accountNumber.trim()) {
      setFlowError(`Enter ${selectedOp.accountLabel}.`);
      return;
    }
    if (!Number.isFinite(amount) || amount < 10) {
      setFlowError('Select a plan or enter an amount of at least ₹10.');
      return;
    }
    setFlowBusy(true);
    try {
      const res = await webApi.executeRecharge({
        operatorId: selectedOp.id,
        accountNumber: accountNumber.trim(),
        circle: rechargeCat === 'mobile' ? circle : undefined,
        planId: selectedPlan?.id,
        amount,
      });
      setReceipt(res.transaction);
      await onRefreshUser();
      await loadUserActivity();
    } catch (err) {
      setFlowError(err instanceof WebApiError ? err.message : 'Recharge failed.');
    } finally {
      setFlowBusy(false);
    }
  };

  const handleFetchBill = async () => {
    if (!billOp) return;
    setFlowError(null);
    setFlowBusy(true);
    try {
      const res = await webApi.fetchBill(billOp.id, billConsumer.trim());
      setFetchedBill(res.bill);
    } catch (err) {
      setFlowError(err instanceof WebApiError ? err.message : 'Unable to fetch bill.');
    } finally {
      setFlowBusy(false);
    }
  };

  const handlePayBill = async () => {
    if (!fetchedBill) return;
    setFlowError(null);
    setFlowBusy(true);
    try {
      const res = await webApi.payUtilityBill({
        operatorId: fetchedBill.operatorId,
        accountNumber: fetchedBill.accountNumber,
        amount: fetchedBill.amount,
        billNumber: fetchedBill.billNumber,
      });
      setReceipt(res.transaction);
      setFetchedBill(null);
      await onRefreshUser();
      await loadUserActivity();
    } catch (err) {
      setFlowError(err instanceof WebApiError ? err.message : 'Bill payment failed.');
    } finally {
      setFlowBusy(false);
    }
  };

  const handleWalletTopUp = async () => {
    setFlowError(null);
    setWalletNotice(null);
    const val = Number(topUpAmount);
    if (!Number.isFinite(val) || val < 50) {
      setFlowError('Enter at least ₹50.');
      return;
    }
    setFlowBusy(true);
    try {
      await webApi.topUpWallet(val, topUpMethod);
      setWalletNotice(`₹${val.toFixed(2)} added via ${topUpMethod}.`);
      await onRefreshUser();
      await loadUserActivity();
    } catch (err) {
      setFlowError(err instanceof WebApiError ? err.message : 'Top-up failed.');
    } finally {
      setFlowBusy(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await webApi.markNotificationRead(id);
    await onRefreshUser();
    await loadUserActivity();
  };

  const handleMarkAllRead = async () => {
    await webApi.markAllNotificationsRead();
    await onRefreshUser();
    await loadUserActivity();
  };

  const filteredHistory =
    historyFilter === 'ALL'
      ? transactions
      : transactions.filter((t) => t.type === historyFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Mobile App Viewport */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[400px] bg-slate-50 border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[700px] max-h-[760px]">
            {/* Mobile App Top Bar */}
            <div className="bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shrink-0">
              {user && (screen === 'recharge' || screen === 'bills') ? (
                <button
                  onClick={() => setScreen('home')}
                  className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-slate-700 hover:text-slate-900"
                  aria-label="Back to home"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-sm">PayPulse</span>
                </div>
              )}
              <span className="text-sm font-semibold text-slate-900 truncate">
                {!user
                  ? 'Account Access'
                  : screen === 'home'
                    ? 'Dashboard'
                    : screen === 'recharge'
                      ? 'Recharge'
                      : screen === 'bills'
                        ? 'Bill Payments'
                        : screen === 'wallet'
                          ? 'Wallet'
                          : screen === 'history'
                            ? 'History'
                            : 'Alerts'}
              </span>
              {user && user.role === 'admin' ? (
                <button
                  onClick={onOpenAdmin}
                  className="min-h-[36px] px-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>

            {/* Mobile Scrollable Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 relative">
              {!user ? (
                <div className="space-y-4 pt-2">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {authMode === 'login' ? 'Sign in to PayPulse' : 'Create your account'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Secure wallet, instant mobile & DTH recharges, and utility bill payments.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                        authMode === 'login'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError(null);
                      }}
                      className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                        authMode === 'register'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Register
                    </button>
                  </div>

                  <form
                    onSubmit={handleAuthSubmit}
                    className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                  >
                    {authMode === 'register' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Aarav Mehta"
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Mobile Number
                          </label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="10-digit mobile number"
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                            required
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                        required
                      />
                    </div>

                    {authError && (
                      <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {authLoading
                        ? 'Authenticating...'
                        : authMode === 'login'
                          ? 'Sign In Securely'
                          : 'Create Account'}
                    </button>
                  </form>

                  <div className="pt-1 space-y-2">
                    <p className="text-xs text-slate-500 text-center">Quick Demo Access</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => quickLogin('user')}
                        className="min-h-[44px] rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Customer Demo
                      </button>
                      <button
                        type="button"
                        onClick={() => quickLogin('admin')}
                        className="min-h-[44px] rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Admin Demo
                      </button>
                    </div>
                  </div>
                </div>
              ) : screen === 'home' ? (
                <>
                  {/* Wallet Hero Card */}
                  <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-400">Available Wallet Balance</p>
                        <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                          ₹{user.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        onClick={() => setScreen('wallet')}
                        className="min-h-[40px] px-3 rounded-xl bg-white text-slate-900 text-xs font-bold flex items-center gap-1 hover:bg-slate-100 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Money
                      </button>
                    </div>
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                      <span className="tabular-nums">
                        Cashback: ₹{user.cashbackEarned.toFixed(2)}
                      </span>
                      <span>KYC Verified · {user.role === 'admin' ? 'Admin' : 'Member'}</span>
                    </div>
                  </div>

                  {/* Quick Services Grid */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2.5">
                      Recharge & Bill Payments
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5">
                      {SERVICE_TILES.map((tile) => {
                        const Icon = tile.icon;
                        return (
                          <button
                            key={tile.id}
                            onClick={() => {
                              if (tile.screen === 'recharge') {
                                setRechargeCat(tile.id as 'mobile' | 'dth');
                                setScreen('recharge');
                              } else {
                                setBillCat(
                                  tile.id as Exclude<ServiceCategory, 'mobile' | 'dth'>
                                );
                                setScreen('bills');
                              }
                            }}
                            className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 hover:border-emerald-500 transition-colors min-h-[84px]"
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center ${tile.tint}`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-semibold text-slate-800">
                              {tile.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
                      <button
                        onClick={() => setScreen('history')}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 min-h-[32px]"
                      >
                        View all
                      </button>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                      {transactions.slice(0, 4).map((txn) => {
                        const isCredit =
                          txn.type === 'WALLET_TOPUP' || txn.type === 'REFUND';
                        return (
                          <button
                            key={txn.id}
                            onClick={() => setReceipt(txn)}
                            className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isCredit
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isCredit ? (
                                  <ArrowDownLeft className="w-4 h-4" />
                                ) : (
                                  <Zap className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {txn.operatorName}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {txn.accountNumber} · {txn.status}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-bold font-mono tabular-nums ml-2 shrink-0 ${
                                isCredit ? 'text-emerald-700' : 'text-slate-900'
                              }`}
                            >
                              {isCredit ? '+' : '-'}₹{txn.amount.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                      {transactions.length === 0 && (
                        <p className="p-4 text-xs text-slate-500 text-center">
                          No transactions recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : screen === 'recharge' ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl">
                    {(['mobile', 'dth'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setRechargeCat(cat)}
                        className={`min-h-[40px] rounded-lg text-xs font-semibold ${
                          rechargeCat === cat
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600'
                        }`}
                      >
                        {cat === 'mobile' ? 'Mobile Prepaid' : 'DTH TV'}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {operators.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => handleSelectRechargeOp(op)}
                        className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 ${
                          selectedOp?.id === op.id
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {op.name}
                      </button>
                    ))}
                  </div>

                  {selectedOp && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {selectedOp.accountLabel}
                        </label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder={selectedOp.accountPlaceholder}
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                        />
                      </div>

                      {rechargeCat === 'mobile' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Telecom Circle
                          </label>
                          <select
                            value={circle}
                            onChange={(e) => setCircle(e.target.value)}
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900"
                          >
                            <option>Karnataka</option>
                            <option>Maharashtra</option>
                            <option>Delhi NCR</option>
                            <option>Tamil Nadu</option>
                            <option>All India</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={selectedPlan ? String(selectedPlan.amount) : customAmount}
                          onChange={(e) => {
                            setSelectedPlan(null);
                            setCustomAmount(e.target.value);
                          }}
                          placeholder="Select a plan below or enter amount"
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-900">Available Plans</p>
                    {plans.map((plan) => {
                      const active = selectedPlan?.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          onClick={() => {
                            setSelectedPlan(plan);
                            setCustomAmount(String(plan.amount));
                          }}
                          className={`w-full text-left p-3.5 rounded-2xl border transition-colors ${
                            active
                              ? 'border-emerald-600 bg-emerald-50/70'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                              ₹{plan.amount}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              {plan.validity} · {plan.data}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 mt-1">
                            {plan.title}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {plan.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {flowError && (
                    <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                      {flowError}
                    </div>
                  )}

                  <button
                    onClick={handleExecuteRecharge}
                    disabled={flowBusy || !selectedOp}
                    className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
                  >
                    {flowBusy
                      ? 'Processing...'
                      : `Pay ₹${(selectedPlan?.amount || Number(customAmount) || 0).toFixed(2)} via Wallet`}
                  </button>
                </div>
              ) : screen === 'bills' ? (
                <div className="space-y-3.5">
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {(
                      [
                        ['electricity', 'Electricity'],
                        ['broadband', 'Broadband'],
                        ['water', 'Water'],
                        ['gas', 'Gas'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setBillCat(key)}
                        className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 ${
                          billCat === key
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {operators.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => {
                          setBillOp(op);
                          setFetchedBill(null);
                        }}
                        className={`w-full min-h-[46px] px-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                          billOp?.id === op.id
                            ? 'border-emerald-600 bg-emerald-50/50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <span>{op.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {(op.cashbackRate * 100).toFixed(1)}% cashback
                        </span>
                      </button>
                    ))}
                  </div>

                  {billOp && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {billOp.accountLabel}
                        </label>
                        <input
                          type="text"
                          value={billConsumer}
                          onChange={(e) => setBillConsumer(e.target.value)}
                          placeholder={billOp.accountPlaceholder}
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-900"
                        />
                      </div>
                      <button
                        onClick={handleFetchBill}
                        disabled={flowBusy}
                        className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                      >
                        {flowBusy ? 'Fetching Bill...' : 'Fetch Bill Details'}
                      </button>
                    </div>
                  )}

                  {flowError && (
                    <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                      {flowError}
                    </div>
                  )}

                  {fetchedBill && (
                    <div className="bg-white border border-emerald-600 rounded-2xl p-4 space-y-2.5">
                      <p className="text-xs font-bold text-slate-900">Bill Summary</p>
                      <div className="text-xs space-y-1.5 text-slate-600">
                        <div className="flex justify-between">
                          <span>Consumer</span>
                          <span className="font-semibold text-slate-900">
                            {fetchedBill.consumerName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bill Number</span>
                          <span className="font-mono text-slate-900">
                            {fetchedBill.billNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Due Date</span>
                          <span className="font-mono text-slate-900">
                            {fetchedBill.dueDate}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-slate-100">
                          <span className="font-semibold text-slate-900">Amount Due</span>
                          <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                            ₹{fetchedBill.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handlePayBill}
                        disabled={flowBusy}
                        className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold mt-2"
                      >
                        {flowBusy ? 'Paying...' : `Pay ₹${fetchedBill.amount.toFixed(2)} Now`}
                      </button>
                    </div>
                  )}
                </div>
              ) : screen === 'wallet' ? (
                <div className="space-y-4">
                  <div className="bg-slate-900 text-white rounded-2xl p-5">
                    <p className="text-xs text-slate-400">Wallet Balance</p>
                    <p className="text-3xl font-bold font-mono tabular-nums mt-1">
                      ₹{user.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-300 mt-2">
                      Lifetime Cashback: ₹{user.cashbackEarned.toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-bold text-slate-900">Add Money</p>
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold font-mono text-slate-900"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {[500, 1000, 2000, 5000].map((v) => (
                        <button
                          key={v}
                          onClick={() => setTopUpAmount(String(v))}
                          className={`min-h-[38px] rounded-lg text-xs font-semibold ${
                            Number(topUpAmount) === v
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          +₹{v}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {(['UPI', 'CARD', 'NETBANKING'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setTopUpMethod(m)}
                          className={`min-h-[40px] rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 ${
                            topUpMethod === m
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'border-slate-200 text-slate-700'
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          {m}
                        </button>
                      ))}
                    </div>

                    {flowError && (
                      <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">
                        {flowError}
                      </div>
                    )}
                    {walletNotice && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
                        {walletNotice}
                      </div>
                    )}

                    <button
                      onClick={handleWalletTopUp}
                      disabled={flowBusy}
                      className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                    >
                      {flowBusy ? 'Adding...' : 'Proceed to Top Up'}
                    </button>
                  </div>
                </div>
              ) : screen === 'history' ? (
                <div className="space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {(
                      [
                        ['ALL', 'All'],
                        ['RECHARGE', 'Recharge'],
                        ['BILL_PAY', 'Bills'],
                        ['WALLET_TOPUP', 'Top-Up'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setHistoryFilter(key)}
                        className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold whitespace-nowrap ${
                          historyFilter === key
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {filteredHistory.map((txn) => {
                      const isCredit =
                        txn.type === 'WALLET_TOPUP' || txn.type === 'REFUND';
                      return (
                        <button
                          key={txn.id}
                          onClick={() => setReceipt(txn)}
                          className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-left hover:border-slate-300"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {txn.operatorName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {txn.accountNumber} · {txn.status} · {txn.referenceId}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold font-mono tabular-nums shrink-0 ${
                              isCredit ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {isCredit ? '+' : '-'}₹{txn.amount.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">
                      Inbox ({unreadCount} unread)
                    </p>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-emerald-700 min-h-[32px]"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-colors ${
                          n.read
                            ? 'bg-white border-slate-200'
                            : 'bg-emerald-50/60 border-emerald-500'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900">{n.title}</p>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-2">
                          {n.category.toUpperCase()} · {n.read ? 'Read' : 'Unread'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Bottom Tab Bar */}
            {user && (
              <div className="bg-white border-t border-slate-200 h-16 grid grid-cols-4 shrink-0">
                {(
                  [
                    { id: 'home', label: 'Home', icon: Home },
                    { id: 'wallet', label: 'Wallet', icon: Wallet },
                    { id: 'history', label: 'History', icon: History },
                    { id: 'notifications', label: 'Alerts', icon: Bell },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = screen === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setScreen(tab.id)}
                      className={`flex flex-col items-center justify-center gap-0.5 relative ${
                        active ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-semibold">{tab.label}</span>
                      {tab.id === 'notifications' && unreadCount > 0 && (
                        <span className="absolute top-2 right-6 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Account Context & Secure API Telemetry */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Cross-Platform Recharge & Bill Payment Suite
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Interactive mobile application preview backed by real Express REST APIs, scrypt password hashing, HMAC-SHA256 JWT tokens, and atomic wallet ledgers.
                </p>
              </div>
              {user && (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Signed in as</p>
                  <p className="text-sm font-bold text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {user.email} · {user.role.toUpperCase()}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Mobile & DTH</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  Airtel, Jio, Vi, BSNL, Tata Play, Dish TV
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Utility BBPS</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  Electricity, Broadband, Water & Piped Gas
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Security Layer</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  Expo SecureStore + Nonce Replay Guard
                </p>
              </div>
            </div>
          </div>

          {/* Live Secure API Request Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Live API Request Log
                </h2>
                <p className="text-xs text-slate-500">
                  Every mobile action sends Bearer JWT + X-Request-Nonce + X-Request-Timestamp headers.
                </p>
              </div>
              <Receipt className="w-4 h-4 text-slate-400" />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Method</th>
                    <th className="py-2.5 px-3 font-semibold">Endpoint</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {traces.slice(0, 6).map((t) => (
                    <tr key={t.id} className="text-slate-700">
                      <td className="py-2 px-3 font-semibold text-slate-900">{t.method}</td>
                      <td className="py-2 px-3 truncate max-w-[220px]">{t.path}</td>
                      <td className="py-2 px-3">
                        <span
                          className={
                            t.status >= 400 ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{t.durationMs}ms</td>
                    </tr>
                  ))}
                  {traces.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 font-sans">
                        Interact with the mobile simulator to inspect live API traffic.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-bold">Transaction Receipt</span>
              </div>
              <button
                onClick={() => setReceipt(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              ₹{receipt.amount.toFixed(2)}
            </p>
            <div className="text-xs space-y-2 border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Reference ID</span>
                <span className="font-mono font-semibold text-slate-900">
                  {receipt.referenceId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Operator</span>
                <span className="font-semibold text-slate-900">{receipt.operatorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account</span>
                <span className="font-mono text-slate-900">{receipt.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold text-emerald-700">{receipt.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cashback Earned</span>
                <span className="font-mono font-semibold text-emerald-700">
                  ₹{receipt.cashback.toFixed(2)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setReceipt(null)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
