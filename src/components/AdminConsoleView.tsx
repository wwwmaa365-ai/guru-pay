import { RefreshCw, Send, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { saveToken, webApi, WebApiError } from '../api';
import { AdminOverview, TransactionStatus, UserProfile } from '../types';

interface AdminConsoleViewProps {
  user: UserProfile | null;
  onAuthSuccess: (user: UserProfile, token: string) => void;
  onRefreshUser: () => Promise<void>;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  user,
  onAuthSuccess,
  onRefreshUser,
}) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'system' | 'promo' | 'wallet'>('system');
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const res = await webApi.getAdminOverview();
      setOverview(res);
    } catch (err) {
      setError(err instanceof WebApiError ? err.message : 'Unable to load admin metrics.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleAdminDemoLogin = async () => {
    setError(null);
    const res = await webApi.login({
      email: 'admin@paypulse.app',
      password: 'Admin@2026',
    });
    saveToken(res.token);
    onAuthSuccess(res.user, res.token);
  };

  const handleStatusChange = async (id: string, status: TransactionStatus) => {
    await webApi.updateTransactionStatus(id, status);
    await loadOverview();
    await onRefreshUser();
  };

  const handleToggleOperator = async (id: string) => {
    await webApi.toggleOperator(id);
    await loadOverview();
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastFeedback(null);
    await webApi.broadcastNotification({
      title: title.trim(),
      body: body.trim(),
      category,
    });
    setTitle('');
    setBody('');
    setBroadcastFeedback('Alert delivered to all active user inboxes.');
    await onRefreshUser();
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Administrator Access Required
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Sign in with an administrator account to moderate pending transactions, toggle operator gateways, and broadcast push notifications.
          </p>
          <button
            onClick={handleAdminDemoLogin}
            className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
          >
            Sign In as Admin (admin@paypulse.app)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Operations Console</h1>
          <p className="text-sm text-slate-600">
            Monitor gross transaction volume, moderate pending orders, and manage operator gateways.
          </p>
        </div>
        <button
          onClick={loadOverview}
          disabled={loading}
          className="min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 flex items-center gap-2 hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {overview && (
        <>
          {/* 4-column KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Gross Transaction Volume</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                ₹{overview.metrics.grossVolume.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Platform Commission</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                ₹{overview.metrics.totalCommission.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Order Success Rate</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {overview.metrics.successRate}%
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Pending Moderation</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {overview.metrics.pendingCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Transactions Ledger & Moderation */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Recent Transactions ({overview.transactions.length})
                </h2>
                <span className="text-xs text-slate-500">
                  Refunds automatically credit user wallet
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Reference</th>
                      <th className="py-3 px-4 font-semibold">User</th>
                      <th className="py-3 px-4 font-semibold">Operator</th>
                      <th className="py-3 px-4 font-semibold text-right">Amount</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.transactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-slate-900">
                          {txn.referenceId}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{txn.userName}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {txn.operatorName} · {txn.accountNumber}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          ₹{txn.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {txn.status}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {txn.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(txn.id, 'SUCCESS')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusChange(txn.id, 'REFUNDED')}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
                              >
                                Refund
                              </button>
                            </>
                          )}
                          {txn.status === 'SUCCESS' && txn.type !== 'WALLET_TOPUP' && (
                            <button
                              onClick={() => handleStatusChange(txn.id, 'REFUNDED')}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100"
                            >
                              Issue Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Sidebar: Broadcast + Operator Toggles */}
            <div className="lg:col-span-4 space-y-6">
              <form
                onSubmit={handleBroadcast}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
              >
                <h2 className="text-sm font-bold text-slate-900">
                  Broadcast Push Notification
                </h2>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notification title"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                  required
                />
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as 'system' | 'promo' | 'wallet')
                  }
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                >
                  <option value="system">System Notice</option>
                  <option value="promo">Cashback Promotion</option>
                  <option value="wallet">Wallet Update</option>
                </select>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Message body for all mobile & web users..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
                  required
                />
                {broadcastFeedback && (
                  <p className="text-xs font-semibold text-emerald-700">
                    {broadcastFeedback}
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send to All Users
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Operator Gateways
                </h2>
                <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                  {overview.operators.map((op) => (
                    <div
                      key={op.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{op.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {op.category.toUpperCase()} · Margin {(op.commissionRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleOperator(op.id)}
                        className={`min-h-[32px] px-3 rounded-lg text-[11px] font-semibold ${
                          op.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {op.active ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
