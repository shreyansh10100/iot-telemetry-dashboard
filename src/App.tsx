import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db, TECH_PASSWORD } from './lib/firebase';
import { LogEntry, AssetComponent, ChatMessage, ToastMessage } from './types';
import { CompanyConfigContext, ToastContext, defaultCompanyConfig } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { LogsSheetView } from './components/LogsSheetView';
import { AssetCatalogueView } from './components/AssetCatalogueView';
import { ToolMaterialsPanel } from './components/ToolMaterialsPanel';
import { ToastContainer } from './components/ToastContainer';

function InjectGlobalStyles() {
  useEffect(() => {
    if (!document.getElementById('gf-link')) {
      const gf = document.createElement('link');
      gf.id = 'gf-link';
      gf.rel = 'stylesheet';
      gf.href =
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700;800&display=swap';
      document.head.appendChild(gf);
    }
    if (!document.getElementById('app-styles')) {
      const style = document.createElement('style');
      style.id = 'app-styles';
      style.textContent = `
        *, *::before, *::after { font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        code, .font-mono { font-family: 'IBM Plex Mono', monospace !important; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        .animate-fadeIn { animation: fadeIn 0.25s ease both; }
        .animate-slideIn { animation: slideIn 0.3s ease both; }
      `;
      document.head.appendChild(style);
    }
  }, []);
  return null;
}

export default function App() {
  const [page, setPage] = useState<'login' | 'dashboard' | 'logs_sheet' | 'catalogue' | 'bom_inventory'>('login');
  const [operator, setOperator] = useState('');
  const [userRole, setUserRole] = useState('Operator');
  const [techPassword, setTechPassword] = useState('');
  const [shift, setShift] = useState('A');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [assets, setAssets] = useState<AssetComponent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsubLogs = onValue(
      ref(db, 'logs'),
      snap => {
        const data = snap.val();
        setLogs(data ? Object.keys(data).map(k => ({ ...data[k], id: k })).reverse() : []);
        setIsLoading(false);
      },
      err => {
        setDbError(err.message);
        setIsLoading(false);
      }
    );

    const unsubAssets = onValue(ref(db, 'assets'), snap => {
      const data = snap.val();
      setAssets(data ? Object.keys(data).map(k => ({ ...data[k], id: k })) : []);
    });

    const unsubMessages = onValue(ref(db, 'messages'), snap => {
      const data = snap.val();
      setMessages(data ? Object.keys(data).map(k => ({ ...data[k], id: k })) : []);
    });

    return () => {
      unsubLogs();
      unsubAssets();
      unsubMessages();
    };
  }, []);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!operator.trim()) {
        addToast("Please enter your name to continue.", "error");
        return;
      }
      if (userRole === 'Technician' && techPassword !== TECH_PASSWORD) {
        addToast("Incorrect technician password. Access denied.", "error");
        return;
      }
      setPage('dashboard');
      addToast(`Welcome ${operator} (${userRole}) to Ashok Leyland Maintenance Console`, 'success');
    },
    [operator, userRole, techPassword, addToast]
  );

  const handleClearDatabase = useCallback(() => {
    if (resetConfirmText !== 'DELETE') {
      addToast("Type DELETE to confirm.", "error");
      return;
    }
    const updates: Record<string, null | string> = { '/logs': null, '/messages': null };
    assets.forEach(a => {
      updates[`/assets/${a.id}/statusFlag`] = 'OK';
    });
    updates['/toolMaterials'] = null;

    update(ref(db), updates)
      .then(() => {
        addToast("All test logs, messages, and tool materials cleared.", "success");
        setShowResetModal(false);
        setResetConfirmText('');
      })
      .catch(err => addToast(`Reset failed: ${err.message}`, "error"));
  }, [assets, addToast, resetConfirmText]);

  const handleLogout = useCallback(() => {
    setPage('login');
    setOperator('');
    setTechPassword('');
  }, []);

  return (
    <CompanyConfigContext.Provider value={defaultCompanyConfig}>
      <ToastContext.Provider value={{ addToast }}>
        <InjectGlobalStyles />

        {page === 'login' ? (
          <LoginView
            operator={operator}
            setOperator={setOperator}
            userRole={userRole}
            setUserRole={setUserRole}
            techPassword={techPassword}
            setTechPassword={setTechPassword}
            shift={shift}
            setShift={setShift}
            date={date}
            setDate={setDate}
            onLogin={handleLogin}
          />
        ) : (
          <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-12">
            <Navbar
              page={page}
              setPage={setPage}
              userRole={userRole}
              assetsCount={assets.length}
              isLoading={isLoading}
              onOpenResetModal={() => {
                setShowResetModal(true);
                setResetConfirmText('');
              }}
              onLogout={handleLogout}
              mobileMenuOpen={mobileMenuOpen}
              setMobileMenuOpen={setMobileMenuOpen}
            />

            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 md:mt-8">
              {dbError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium flex items-center justify-between">
                  <span>⚠️ Connection status: {dbError}</span>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Reconnect
                  </button>
                </div>
              )}

              {page === 'dashboard' && (
                <DashboardView
                  logs={logs}
                  assets={assets}
                  messages={messages}
                  operator={operator}
                  userRole={userRole}
                  shift={shift}
                />
              )}
              {page === 'logs_sheet' && <LogsSheetView logs={logs} />}
              {page === 'catalogue' && <AssetCatalogueView assets={assets} userRole={userRole} />}
              {page === 'bom_inventory' && <ToolMaterialsPanel />}
            </main>

            {showResetModal && (
              <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-sm p-6 space-y-4 animate-fadeIn">
                  <div className="text-center">
                    <span className="text-3xl">⚠️</span>
                    <h2 className="text-base font-bold text-slate-900 mt-2">Confirm Database Reset</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Permanently clears test logs, chat notifications, and tool materials. Asset records will be reset to OK.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-rose-700 mb-1">
                      Type <span className="font-mono bg-rose-50 px-1 rounded">DELETE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={resetConfirmText}
                      onChange={e => setResetConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-4 py-3 rounded-xl border border-rose-300 focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 font-mono font-bold text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowResetModal(false);
                        setResetConfirmText('');
                      }}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearDatabase}
                      disabled={resetConfirmText !== 'DELETE'}
                      className={`flex-1 py-2.5 font-bold rounded-xl text-xs transition-all text-white ${
                        resetConfirmText === 'DELETE'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-rose-300 cursor-not-allowed'
                      }`}
                    >
                      Confirm Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <ToastContainer toasts={toasts} />
      </ToastContext.Provider>
    </CompanyConfigContext.Provider>
  );
}
