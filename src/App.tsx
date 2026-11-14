import React, { useCallback, useEffect, useState } from 'react';
import { getToken, saveToken, subscribeApiTrace, webApi } from './api';
import { AdminConsoleView } from './components/AdminConsoleView';
import { ExpoProjectView } from './components/ExpoProjectView';
import { MobileAppView } from './components/MobileAppView';
import { ApiTraceEntry, UserProfile } from './types';

type ActiveTab = 'mobile' | 'admin' | 'expo';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mobile');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [traces, setTraces] = useState<ApiTraceEntry[]>([]);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    return subscribeApiTrace((entry) => {
      setTraces((prev) => [entry, ...prev].slice(0, 20));
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const [meRes, ntfRes] = await Promise.all([
        webApi.getProfile(),
        webApi.getNotifications(),
      ]);
      setUser(meRes.user);
      setUnreadCount(ntfRes.unreadCount);
    } catch {
      saveToken(null);
      setUser(null);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        await refreshUser();
      }
      setBooting(false);
    })();
  }, [refreshUser]);

  const handleAuthSuccess = (nextUser: UserProfile, _token: string) => {
    setUser(nextUser);
    webApi
      .getNotifications()
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => undefined);
  };

  const handleSignOut = () => {
    saveToken(null);
    setUser(null);
    setUnreadCount(0);
  };

  const handleQuickCustomer = async () => {
    const res = await webApi.login({
      email: 'user@paypulse.app',
      password: 'PayPulse@2026',
    });
    saveToken(res.token);
    handleAuthSuccess(res.user, res.token);
    setActiveTab('mobile');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Three-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#mobile"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('mobile');
            }}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            PayPulse
          </a>

          <nav className="flex items-center gap-6 text-sm font-medium">
            <button
              onClick={() => setActiveTab('mobile')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                activeTab === 'mobile'
                  ? 'text-slate-900 font-semibold border-b-2 border-emerald-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mobile App
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                activeTab === 'admin'
                  ? 'text-slate-900 font-semibold border-b-2 border-emerald-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin Console
            </button>
            <button
              onClick={() => setActiveTab('expo')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                activeTab === 'expo'
                  ? 'text-slate-900 font-semibold border-b-2 border-emerald-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expo & EAS
            </button>
          </nav>

          <div className="shrink-0">
            {user ? (
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={handleQuickCustomer}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Launch Demo
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {booting ? (
          <div className="py-24 text-center text-sm text-slate-500">
            Initializing session...
          </div>
        ) : activeTab === 'mobile' ? (
          <MobileAppView
            user={user}
            unreadCount={unreadCount}
            traces={traces}
            onAuthSuccess={handleAuthSuccess}
            onRefreshUser={refreshUser}
            onOpenAdmin={() => setActiveTab('admin')}
          />
        ) : activeTab === 'admin' ? (
          <AdminConsoleView
            user={user}
            onAuthSuccess={handleAuthSuccess}
            onRefreshUser={refreshUser}
          />
        ) : (
          <ExpoProjectView />
        )}
      </main>
    </div>
  );
}
