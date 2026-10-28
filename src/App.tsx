import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, memo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, update, child } from 'firebase/database';
import * as XLSX from 'xlsx';

if (!import.meta.env.VITE_FIREBASE_DATABASE_URL) {
  throw new Error('VITE_FIREBASE_DATABASE_URL is not set. Add it to your .env file.');
}
if (!import.meta.env.VITE_TECH_PASSWORD) {
  throw new Error('VITE_TECH_PASSWORD is not set. Add it to your .env file.');
}
const FIREBASE_CONFIG = {
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};
const app = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(app);

function fmtIp(ip: string): string {
  if (!ip || ip === '0.0.0.0') return '00.00.00.00';
  return ip.split('.').map(seg => seg.padStart(2, '0')).join('.');
}

interface LogEntry {
  id: string; category: string; timestamp: string; operator: string; shift: string;
  ipAddress: string; location: string; status: 'Normal' | 'Pending' | 'Fixed';
  details: {
    toolName?: string; deviceId?: string; line?: string; reportedStatus?: string; problemDetail?: string;
    temp?: string; mcbUp?: boolean; panelCleaned?: boolean; exhaustFan?: boolean; currentLoad?: string;
    filterCleaned?: boolean; coolingFan?: boolean; contentFeed?: boolean; powerStatus?: boolean;
    rootCause?: string; actionDone?: string;
  };
}
interface AssetComponent { id: string; componentName: string; category: string; make: string; controllerSerial: string; ipAddress: string; stageLocation: string; statusFlag: 'OK' | 'FAULT'; sopQrCode?: string; customFields?: Record<string,string>; }
interface ChatMessage { id: string; type: 'manual' | 'alert' | 'system'; refLogId?: string; sender: string; role: string; shift?: string; text: string; timestamp: string; resolved?: boolean; image?: string; }
interface ToastMessage { id: string; text: string; type: 'success' | 'error' | 'info'; }
interface ToolMaterialEntry { assetNo: string; assetName: string; count: number; stageCode: string; }

const compressAndEncodeImage = (file: File, maxDimension = 600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = (height / width) * maxDimension; width = maxDimension; }
          else { width = (width / height) * maxDimension; height = maxDimension; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        const b64 = canvas.toDataURL('image/jpeg', 0.65);
        // Reject if result exceeds 200KB — prevents DB bloat
        const MAX_BYTES = 200 * 1024;
        if (b64.length > MAX_BYTES) { reject(new Error('Image too large after compression. Please use a smaller image (max ~200KB).')); return; }
        resolve(b64);
      };
    };
    reader.onerror = reject;
  });
};

const CompanyConfigContext = createContext({ name: "Acme Manufacturing Co.", title: "Factory Control Dashboard", accentColor: "indigo" });
const ToastContext = createContext<{ addToast: (text: string, type: 'success' | 'error' | 'info') => void }>({ addToast: () => {} });

function InjectStyles() {
  useEffect(() => {
    if (!document.getElementById('tw-cdn')) { const tw = document.createElement('script'); tw.id = 'tw-cdn'; tw.src = 'https://cdn.tailwindcss.com'; document.head.appendChild(tw); }
    if (!document.getElementById('gf-link')) { const gf = document.createElement('link'); gf.id = 'gf-link'; gf.rel = 'stylesheet'; gf.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700;800&display=swap'; document.head.appendChild(gf); }
    if (!document.getElementById('app-styles')) {
      const style = document.createElement('style'); style.id = 'app-styles';
      style.textContent = `*, *::before, *::after { font-family: 'IBM Plex Sans', sans-serif; } code, .font-mono { font-family: 'IBM Plex Mono', monospace !important; } @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } } @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } } .animate-fadeIn { animation: fadeIn 0.25s ease both; } .animate-slideIn { animation: slideIn 0.3s ease both; }`;
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
    const unsubLogs = onValue(ref(db, 'logs'), snap => {
      const data = snap.val();
      setLogs(data ? Object.keys(data).map(k => ({ ...data[k], id: k })).reverse() : []);
      setIsLoading(false);
    }, err => { setDbError(err.message); setIsLoading(false); });
    const unsubAssets = onValue(ref(db, 'assets'), snap => {
      const data = snap.val();
      setAssets(data ? Object.keys(data).map(k => ({ ...data[k], id: k })) : []);
    });
    const unsubMessages = onValue(ref(db, 'messages'), snap => {
      const data = snap.val();
      setMessages(data ? Object.keys(data).map(k => ({ ...data[k], id: k })) : []);
    });
    return () => { unsubLogs(); unsubAssets(); unsubMessages(); };
  }, []);

  const handleLogin = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!operator.trim()) { addToast("Please enter your name to continue.", "error"); return; }
    if (userRole === 'Technician' && techPassword !== import.meta.env.VITE_TECH_PASSWORD) { addToast("Incorrect password. Access denied.", "error"); return; }
    setPage('dashboard');
    addToast(`Welcome, ${operator} (${userRole})`, 'success');
  }, [operator, userRole, techPassword, addToast]);

  const handleClearDatabase = useCallback(() => {
    if (resetConfirmText !== 'DELETE') { addToast("Type DELETE to confirm.", "error"); return; }
    const updates: Record<string, null | string> = { '/logs': null, '/messages': null };
    assets.forEach(a => { updates[`/assets/${a.id}/statusFlag`] = 'OK'; });

    // ── TEST DATA BLOCK START ────────────────────────────────────────────────
    // This block wipes /toolMaterials and /assets on reset.
    // Current data is TEST DATA only — safe to delete.
    // When going live: comment out the two lines below to preserve real data.
    updates['/toolMaterials'] = null;
    updates['/assets'] = null;
    // ── TEST DATA BLOCK END ──────────────────────────────────────────────────

    update(ref(db), updates)
      .then(() => { addToast("All logs, messages, assets and tool materials cleared.", "success"); setShowResetModal(false); setResetConfirmText(''); })
      .catch(err => addToast(`Reset failed: ${err.message}`, "error"));
  }, [assets, addToast, resetConfirmText]);

  if (page === 'login') {
    return (
      <ToastContext.Provider value={{ addToast }}>
        <InjectStyles />
        <div className="min-h-screen bg-slate-100 flex items-start sm:items-center justify-center p-3 sm:p-4 font-sans selection:bg-indigo-500 selection:text-white">
          <div className="bg-white p-5 sm:p-8 rounded-2xl w-full max-w-md shadow-xl border border-slate-200 transition-all">
            <div className="text-center mb-8">
              <span className="text-4xl">🏭</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-3">Operator Login</h2>
              <p className="text-sm text-slate-500 mt-1">Acme Manufacturing — Floor Terminal</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Your Name</label>
                <input type="text" value={operator} onChange={e => setOperator(e.target.value)} maxLength={60} placeholder="e.g. John Smith" className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                <select value={userRole} onChange={e => { setUserRole(e.target.value); setTechPassword(''); }} className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 text-slate-900 transition-all outline-none">
                  <option value="Operator">👷 Operator</option>
                  <option value="Technician">🔧 Technician</option>
                </select>
              </div>
              {userRole === 'Technician' && (
                <div className="animate-fadeIn">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Technician Password</label>
                  <input type="password" value={techPassword} onChange={e => setTechPassword(e.target.value)} placeholder="Enter password" className="w-full px-4 py-3 rounded-xl border border-rose-300 bg-rose-50/30 focus:ring-2 focus:ring-rose-500 text-slate-900 transition-all outline-none"/>
                </div>
              )}
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Shift</label>
                  <select value={shift} onChange={e => setShift(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 text-slate-900 transition-all outline-none">
                    <option value="A">Shift A — Morning</option>
                    <option value="B">Shift B — Evening</option>
                    <option value="C">Shift C — Night</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                  <input type="date" value={date} max={new Date().toISOString().split('T')[0]} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"/>
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-indigo-100 transition-all transform active:scale-95 mt-2">Sign In</button>
            </form>
          </div>
          <ToastContainer toasts={toasts} />
        </div>
      </ToastContext.Provider>
    );
  }

  return (
    <CompanyConfigContext.Provider value={{ name: "Acme Manufacturing Co.", title: "Factory Control Dashboard", accentColor: "indigo" }}>
      <ToastContext.Provider value={{ addToast }}>
        <InjectStyles />
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-12">
          <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-md border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl animate-pulse">🏭</span>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white">Acme Operations Dashboard</h1>
                  <p className="text-xs text-emerald-400 flex items-center font-medium gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                    Live — Connected {isLoading && <span className="text-slate-400 ml-1">(Syncing...)</span>}
                  </p>
                </div>
              </div>
              {/* ── Desktop nav ── */}
              <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
                <button onClick={() => setPage('dashboard')} className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${page==='dashboard'?'bg-indigo-600 text-white shadow-sm':'text-slate-300 hover:bg-slate-800'}`}>Dashboard</button>
                <button onClick={() => setPage('logs_sheet')} className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${page==='logs_sheet'?'bg-indigo-600 text-white shadow-sm':'text-slate-300 hover:bg-slate-800'}`}>📊 Shift Logs</button>
                <button onClick={() => setPage('catalogue')} className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${page==='catalogue'?'bg-indigo-600 text-white shadow-sm':'text-slate-300 hover:bg-slate-800'}`}>🌐 Assets ({isLoading ? "…" : assets.length})</button>
                <button onClick={() => setPage('bom_inventory')} className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${page==='bom_inventory'?'bg-indigo-600 text-white shadow-sm':'text-slate-300 hover:bg-slate-800'}`}>🔩 Tool Materials</button>
                {userRole === 'Technician' && (
                  <button onClick={() => { setShowResetModal(true); setResetConfirmText(''); }} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow transition-all ml-2 flex items-center gap-1">🗑 Reset Data</button>
                )}
                <button onClick={() => { setPage('login'); setOperator(''); setTechPassword(''); }} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition-all ml-2">Exit</button>
              </nav>
              {/* ── Mobile hamburger ── */}
              <div className="flex md:hidden items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">{page.replace('_',' ').replace('bom inventory','Materials')}</span>
                <button onClick={() => setMobileMenuOpen(v => !v)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-all">
                  {mobileMenuOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                  )}
                </button>
              </div>
            </div>
          </header>
          {/* ── Mobile slide-down nav menu ── */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-1 animate-fadeIn z-40 relative">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
                { id: 'logs_sheet', label: 'Shift Logs', icon: '📊' },
                { id: 'catalogue', label: `Assets (${assets.length})`, icon: '🌐' },
                { id: 'bom_inventory', label: 'Tool Materials', icon: '🔩' },
              ].map(item => (
                <button key={item.id} onClick={() => { setPage(item.id as any); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${page === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
              <div className="border-t border-slate-800 pt-2 space-y-1">
                {userRole === 'Technician' && (
                  <button onClick={() => { setShowResetModal(true); setResetConfirmText(''); setMobileMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 text-amber-400 hover:bg-slate-800 transition-all">
                    🗑 Reset Data
                  </button>
                )}
                <button onClick={() => { setPage('login'); setOperator(''); setTechPassword(''); setMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 text-rose-400 hover:bg-slate-800 transition-all">
                  🚪 Exit
                </button>
              </div>
            </div>
          )}
          <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 md:mt-8">
            {dbError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium flex items-center justify-between">
                <span>⚠️ Connection lost. Details: {dbError}</span>
                <button onClick={() => window.location.reload()} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all">Reconnect</button>
              </div>
            )}
            {page === 'dashboard' && <DashboardView logs={logs} assets={assets} messages={messages} operator={operator} userRole={userRole} shift={shift} />}
            {page === 'logs_sheet' && <LogsSheetView logs={logs} />}
            {page === 'catalogue' && <AssetCatalogueView assets={assets} userRole={userRole} />}
            {page === 'bom_inventory' && <ToolMaterialsPanel />}
          </main>
          <ToastContainer toasts={toasts} />
          {showResetModal && (
            <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-sm p-6 space-y-4 animate-fadeIn">
                <div className="text-center">
                  <span className="text-3xl">⚠️</span>
                  <h2 className="text-base font-bold text-slate-900 mt-2">Confirm Database Reset</h2>
                  <p className="text-xs text-slate-500 mt-1">This will permanently delete all logs and chat messages. Asset statuses will be reset to OK.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1">Type <span className="font-mono bg-rose-50 px-1 rounded">DELETE</span> to confirm</label>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={e => setResetConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-4 py-3 rounded-xl border border-rose-300 focus:ring-2 focus:ring-rose-500 outline-none text-slate-900 font-mono font-bold text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowResetModal(false); setResetConfirmText(''); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all">Cancel</button>
                  <button onClick={handleClearDatabase} disabled={resetConfirmText !== 'DELETE'} className={`flex-1 py-2.5 font-bold rounded-xl text-xs transition-all text-white ${resetConfirmText === 'DELETE' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-300 cursor-not-allowed'}`}>Confirm Reset</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ToastContext.Provider>
    </CompanyConfigContext.Provider>
  );
}

function DashboardView({ logs, assets, messages, operator, userRole, shift }: { logs: LogEntry[], assets: AssetComponent[], messages: ChatMessage[], operator: string, userRole: string, shift: string }) {
  const { addToast } = useContext(ToastContext);
  const pendingIncidents = useMemo(() => logs.filter(l => l.status === 'Pending'), [logs]);
  const errorDataCounts = useMemo(() => logs.reduce((acc, curr) => {
    if (curr.status === 'Pending') acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, { "Tools": 0, "TVs & Scanners": 0, "UPS": 0, "Panels": 0 } as Record<string, number>), [logs]);

  const resolveGlobalIssue = useCallback((logId: string) => {
    if (userRole !== 'Technician') { addToast("🔒 Only Technicians can resolve incidents.", "error"); return; }
    const matchedLog = logs.find(l => l.id === logId);
    if (!matchedLog) return;
    const updates: Record<string, string | boolean> = { [`/logs/${logId}/status`]: 'Fixed' };
    const matchedAsset = assets.find(a => a.ipAddress === matchedLog.ipAddress);
    if (matchedAsset) updates[`/assets/${matchedAsset.id}/statusFlag`] = 'OK';
    messages.forEach(m => { if (m.refLogId === logId) updates[`/messages/${m.id}/resolved`] = true; });
    const sysMsgKey = push(child(ref(db), 'messages')).key;
    if (sysMsgKey) updates[`/messages/${sysMsgKey}`] = { id: sysMsgKey, type: 'system', sender: 'SYSTEM HUB', role: 'System', text: `✅ Fault cleared on IP ${matchedLog.ipAddress} by Technician ${operator}.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } as any;
    update(ref(db), updates).then(() => addToast("Incident resolved.", "success")).catch(err => addToast(`Error: ${err.message}`, "error"));
  }, [userRole, logs, assets, messages, operator, addToast]);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Alarms</p><h3 className="text-3xl font-extrabold text-slate-900 mt-1">{pendingIncidents.length}</h3></div>
          <span className={`p-3 rounded-xl font-bold text-xl ${pendingIncidents.length > 0 ? 'bg-rose-50 text-rose-600 animate-bounce' : 'bg-slate-50 text-slate-400'}`}>🚨</span>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Assets</p><h3 className="text-3xl font-extrabold text-slate-900 mt-1">{assets.length}</h3></div>
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xl">🌐</span>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logged In As</p><h3 className="text-base font-bold text-slate-900 truncate mt-1 max-w-[150px]">{operator}</h3><p className="text-xs text-slate-400 font-medium">{userRole} • Shift {shift}</p></div>
          <span className="p-3 bg-amber-50 text-amber-600 rounded-xl font-bold text-xl">👤</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Faults by Category</p>
          <div className="flex items-end justify-between h-20 px-2 pt-2 gap-1.5">
            {Object.entries(errorDataCounts).map(([cat, count]) => {
              const maxCount = Math.max(...Object.values(errorDataCounts), 1);
              const heightPct = (count / maxCount) * 70;
              return (
                <div key={cat} className="flex flex-col items-center flex-1 group relative">
                  <span className="text-[11px] font-extrabold text-indigo-600 mb-0.5">{count}</span>
                  <div className="w-6 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t transition-all duration-500 shadow-sm" style={{ height: `${Math.max(heightPct, 8)}%` }} />
                  <span className="text-[9px] font-bold text-slate-400 truncate w-12 text-center mt-1">{cat === 'TVs & Scanners' ? 'TV/Scan' : cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-rose-600 uppercase tracking-wider flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          Open Incidents ({pendingIncidents.length})
        </h3>
        {pendingIncidents.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2"><span>🛡️</span> All clear. No open incidents.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pendingIncidents.map(issue => (
              <div key={issue.id} className="bg-rose-50/50 border border-rose-200 rounded-xl overflow-hidden flex flex-col justify-between">
                <div className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                    <span className="font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md uppercase">{issue.category}</span>
                    <span className="text-slate-500 font-medium">By: {issue.operator} (Shf {issue.shift})</span>
                  </div>
                  <p className="text-slate-800 font-medium"><strong>IP:</strong> <code className="bg-white border border-rose-200 px-1.5 py-0.5 rounded font-mono text-rose-600 font-bold">{issue.ipAddress}</code></p>
                  <p className="text-slate-700"><strong>Location:</strong> {issue.location}</p>
                  <div className="bg-white p-2.5 rounded-lg border border-rose-100 font-semibold text-rose-700 text-xs mt-2">⚠️ {issue.details?.reportedStatus}: {issue.details?.problemDetail || issue.details?.rootCause || 'Diagnostics pending'}</div>
                </div>
                <div className="p-3 bg-rose-100/50 border-t border-rose-200">
                  {userRole === 'Technician' ? (
                    <button onClick={() => resolveGlobalIssue(issue.id)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all">✓ Mark as Resolved</button>
                  ) : (
                    <div className="text-center text-[11px] font-bold text-rose-500 bg-white/80 py-1.5 border border-rose-200 rounded-lg">🔒 Waiting for a Technician</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-7"><UnifiedFiveStepForm operator={operator} shift={shift} assets={assets} /></div>
        <div className="lg:col-span-5"><IntercomChat messages={messages} operator={operator} userRole={userRole} shift={shift} onResolve={resolveGlobalIssue} /></div>
      </div>
    </div>
  );
}

function UnifiedFiveStepForm({ operator, shift, assets }: { operator: string, shift: string, assets: AssetComponent[] }) {
  const { addToast } = useContext(ToastContext);
  const [activeTab, setActiveTab] = useState('Tools');
  const [common, setCommon] = useState({ toolName: '', deviceId: '', location: '', line: '', ipAddress: '' });
  const [specTools, setSpecTools] = useState({ problemDetail: '' });
  const [specPanels, setSpecPanels] = useState({ temp: '', mcbUp: true, panelCleaned: false, exhaustFan: true });
  const [specUps, setSpecUps] = useState({ currentLoad: '', filterCleaned: false, coolingFan: true });
  const [specTvs, setSpecTvs] = useState({ contentFeed: true, powerStatus: true });
  const [formStatus, setFormStatus] = useState('Working / Normal');
  const [issueFields, setIssueFields] = useState({ rootCause: '', actionDone: '', resolutionState: 'Pending' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!common.location.trim()) errs.location = "Stage location is required.";
    if (!common.ipAddress.trim()) errs.ipAddress = "IP address is required.";
    else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(common.ipAddress.trim())) errs.ipAddress = "Invalid IP format.";
    if (common.deviceId && !/^\d+$/.test(common.deviceId.trim())) errs.deviceId = "Device ID must be numbers only.";
    if (activeTab === 'Panels' && specPanels.temp && !/^-?\d+$/.test(specPanels.temp.trim())) errs.temp = "Temperature must be a whole number.";
    if (activeTab === 'UPS' && specUps.currentLoad && !/^\d+$/.test(specUps.currentLoad.trim())) errs.currentLoad = "Current load must be a positive whole number.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [common, activeTab, specPanels.temp, specUps.currentLoad]);

  const executeFormSubmit = useCallback(() => {
    if (!validateForm()) { addToast("Please fix the errors before submitting.", "error"); return; }
    let detailPacket: Record<string, unknown> = {};
    if (activeTab === 'Tools') detailPacket = { ...specTools };
    if (activeTab === 'Panels') detailPacket = { ...specPanels, temp: specPanels.temp ? `${specPanels.temp}°C` : '' };
    if (activeTab === 'UPS') detailPacket = { ...specUps };
    if (activeTab === 'TVs & Scanners') detailPacket = { ...specTvs };
    if (formStatus !== 'Working / Normal') { detailPacket.rootCause = issueFields.rootCause; detailPacket.actionDone = issueFields.actionDone; }
    const isPendingIssue = formStatus !== 'Working / Normal' && issueFields.resolutionState === 'Pending';
    const logKey = push(child(ref(db), 'logs')).key;
    if (!logKey) return;
    const payloadLog: LogEntry = { id: logKey, category: activeTab, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), operator, shift, ipAddress: common.ipAddress.trim(), location: common.location.trim(), status: isPendingIssue ? 'Pending' : 'Normal', details: { toolName: common.toolName.trim(), deviceId: common.deviceId.trim(), line: common.line.trim(), reportedStatus: formStatus, ...detailPacket } };
    const updates: Record<string, unknown> = { [`/logs/${logKey}`]: payloadLog };
    if (isPendingIssue) {
      const matchedAsset = assets.find(a => a.ipAddress === common.ipAddress.trim());
      if (matchedAsset) updates[`/assets/${matchedAsset.id}/statusFlag`] = 'FAULT';
      const msgKey = push(child(ref(db), 'messages')).key;
      if (msgKey) updates[`/messages/${msgKey}`] = { id: msgKey, type: 'alert', refLogId: logKey, sender: 'CRITICAL SYSTEM GATE', role: 'System', text: `🚨 [${formStatus.toUpperCase()}] Fault at ${common.location} (IP: ${common.ipAddress.trim()}).`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), resolved: false };
    }
    update(ref(db), updates).then(() => {
      addToast("Log saved successfully.", "success");
      setCommon({ toolName: '', deviceId: '', location: '', line: '', ipAddress: '' });
      setSpecTools({ problemDetail: '' }); setSpecPanels({ temp: '', mcbUp: true, panelCleaned: false, exhaustFan: true });
      setSpecUps({ currentLoad: '', filterCleaned: false, coolingFan: true }); setSpecTvs({ contentFeed: true, powerStatus: true });
      setFormStatus('Working / Normal'); setIssueFields({ rootCause: '', actionDone: '', resolutionState: 'Pending' }); setErrors({});
    }).catch(err => addToast(`Save failed: ${err.message}`, "error"));
  }, [validateForm, activeTab, specTools, specPanels, specUps, specTvs, formStatus, issueFields, operator, shift, common, assets, addToast]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-800"><h3 className="text-sm font-bold text-white uppercase tracking-wider">Log Equipment Status</h3></div>
      <div className="bg-slate-50 p-2 flex border-b border-slate-200 gap-1">
        {['Tools', 'TVs & Scanners', 'UPS', 'Panels'].map(tab => (
          <button key={tab} type="button" onClick={() => { setActiveTab(tab); setErrors({}); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}>{tab}</button>
        ))}
      </div>
      <div className="p-6 space-y-6">
        <div>
          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Step 1: Equipment Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div><label className="block font-semibold text-slate-700 mb-1">Equipment Name</label><input type="text" value={common.toolName} onChange={e => setCommon({...common, toolName: e.target.value})} maxLength={100} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900" placeholder="e.g. CNC Spindle"/></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Device ID</label><input type="text" value={common.deviceId} onChange={e => setCommon({...common, deviceId: e.target.value})} className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${errors.deviceId?'border-rose-400':'border-slate-300 focus:ring-indigo-500'}`} maxLength={20} placeholder="e.g. 2004"/>{errors.deviceId&&<p className="text-[10px] text-rose-600 mt-1">{errors.deviceId}</p>}</div>
            <div><label className="block font-semibold text-slate-700 mb-1">Stage Location *</label><input type="text" value={common.location} onChange={e => setCommon({...common, location: e.target.value})} className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${errors.location?'border-rose-400':'border-slate-300 focus:ring-indigo-500'}`} maxLength={60} placeholder="e.g. stage-12"/>{errors.location&&<p className="text-[10px] text-rose-600 mt-1">{errors.location}</p>}</div>
            <div><label className="block font-semibold text-slate-700 mb-1">Line</label><input type="text" value={common.line} onChange={e => setCommon({...common, line: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900" maxLength={20} placeholder="e.g. Line 02"/></div>
            <div className="md:col-span-2"><label className="block font-semibold text-slate-700 mb-1">IP Address *</label><input type="text" value={common.ipAddress} onChange={e => setCommon({...common, ipAddress: e.target.value})} className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none font-mono font-bold text-slate-900 ${errors.ipAddress?'border-rose-400':'border-slate-300 focus:ring-indigo-500'}`} maxLength={15} placeholder="e.g. 192.168.1.55"/>{errors.ipAddress&&<p className="text-[10px] text-rose-600 mt-1">{errors.ipAddress}</p>}</div>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Step 2: Checklist — ({activeTab})</h4>
          {activeTab==='Tools'&&(<div className="text-xs"><label className="block font-semibold text-slate-700 mb-1">Fault Description</label><textarea value={specTools.problemDetail} onChange={e=>setSpecTools({...specTools,problemDetail:e.target.value})} className="w-full h-20 p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none resize-none" placeholder="Describe the fault..."/></div>)}
          {activeTab==='Panels'&&(<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"><div><label className="block font-semibold text-slate-700 mb-1">Temperature (°C)</label><input type="number" value={specPanels.temp} onChange={e=>setSpecPanels({...specPanels,temp:e.target.value})} className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${errors.temp?'border-rose-400':'border-slate-300 focus:ring-indigo-500'}`} placeholder="e.g. 42"/>{errors.temp&&<p className="text-[10px] text-rose-600 mt-1">{errors.temp}</p>}</div><div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200"><label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={specPanels.mcbUp} onChange={e=>setSpecPanels({...specPanels,mcbUp:e.target.checked})} className="rounded text-indigo-600 w-4 h-4"/>MCB is ON</label><label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={specPanels.panelCleaned} onChange={e=>setSpecPanels({...specPanels,panelCleaned:e.target.checked})} className="rounded text-indigo-600 w-4 h-4"/>Panel Filter Cleaned</label><label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={specPanels.exhaustFan} onChange={e=>setSpecPanels({...specPanels,exhaustFan:e.target.checked})} className="rounded text-indigo-600 w-4 h-4"/>Exhaust Fan Running</label></div></div>)}
          {activeTab==='UPS'&&(<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"><div><label className="block font-semibold text-slate-700 mb-1">Current Load (Amps)</label><input type="number" value={specUps.currentLoad} onChange={e=>setSpecUps({...specUps,currentLoad:e.target.value})} className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${errors.currentLoad?'border-rose-400':'border-slate-300 focus:ring-indigo-500'}`} placeholder="e.g. 15"/>{errors.currentLoad&&<p className="text-[10px] text-rose-600 mt-1">{errors.currentLoad}</p>}</div><div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-center"><label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={specUps.filterCleaned} onChange={e=>setSpecUps({...specUps,filterCleaned:e.target.checked})} className="rounded text-indigo-600 w-4 h-4"/>Air Filter Cleaned</label><label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={specUps.coolingFan} onChange={e=>setSpecUps({...specUps,coolingFan:e.target.checked})} className="rounded text-indigo-600 w-4 h-4"/>Cooling Fan Running</label></div></div>)}
          {activeTab==='TVs & Scanners'&&(<div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs"><label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={specTvs.contentFeed} onChange={e=>setSpecTvs({...specTvs,contentFeed:e.target.checked})} className="rounded text-indigo-600 w-4 h-4"/>Signal Feed Normal</label><label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={specTvs.powerStatus} onChange={e=>setSpecTvs({...specTvs,powerStatus:e.target.checked})} className="rounded text-indigo-600 w-4 h-4"/>Power Switch ON</label></div>)}
        </div>
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Step 3: Equipment Status</h4>
          <select value={formStatus} onChange={e=>setFormStatus(e.target.value)} className={`w-full p-3 rounded-xl border font-bold text-xs outline-none ${formStatus==='Working / Normal'?'bg-slate-50 border-slate-300 text-slate-800':'bg-rose-50 border-rose-300 text-rose-700'}`}>
            <option value="Working / Normal">✓ Working Normally</option>
            <option value="Need Maintenance">⚠️ Needs Maintenance</option>
            <option value="Fault Alert">🚨 Fault — System Down</option>
          </select>
        </div>
        {formStatus!=='Working / Normal'&&(
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-4 animate-fadeIn">
            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Step 4: Fault Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div><label className="block font-semibold text-rose-800 mb-1">Root Cause</label><input type="text" value={issueFields.rootCause} onChange={e=>setIssueFields({...issueFields,rootCause:e.target.value})} className="w-full p-2 rounded-lg border border-rose-200 focus:ring-1 focus:ring-rose-500 text-slate-900 outline-none" maxLength={200} placeholder="e.g. Overheated motor"/></div>
              <div><label className="block font-semibold text-rose-800 mb-1">Action Taken</label><input type="text" value={issueFields.actionDone} onChange={e=>setIssueFields({...issueFields,actionDone:e.target.value})} className="w-full p-2 rounded-lg border border-rose-200 focus:ring-1 focus:ring-rose-500 text-slate-900 outline-none" maxLength={200} placeholder="e.g. Stopped line"/></div>
            </div>
            <div className="border-t border-rose-100 pt-3">
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1.5">Step 5: Ticket Status</h4>
              <select value={issueFields.resolutionState} onChange={e=>setIssueFields({...issueFields,resolutionState:e.target.value})} className="w-full p-2.5 bg-white rounded-lg border border-rose-200 font-bold text-xs text-slate-800 outline-none">
                <option value="Pending">⏳ Keep Open — Alert the Team</option>
                <option value="Resolved">✅ Already Fixed</option>
              </select>
            </div>
          </div>
        )}
        <button type="button" onClick={executeFormSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all transform active:scale-95 text-xs uppercase tracking-wider">Submit Log Entry</button>
      </div>
    </div>
  );
}

function IntercomChat({ messages, operator, userRole, shift, onResolve }: { messages: ChatMessage[], operator: string, userRole: string, shift: string, onResolve: (id: string) => void }) {
  const [input, setInput] = useState('');
  const [showBot, setShowBot] = useState(false);

  const submitChat = useCallback((e: React.FormEvent | null, customText?: string, base64Image?: string) => {
    if (e) e.preventDefault();
    const finalMessageText = customText || input.trim();
    if (!finalMessageText && !base64Image) return;
    const msgKey = push(child(ref(db), 'messages')).key;
    if (!msgKey) return;
    const newChat: ChatMessage = { id: msgKey, type: 'manual', sender: operator, role: userRole, shift, text: finalMessageText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...(base64Image && { image: base64Image }) };
    set(ref(db, `messages/${msgKey}`), newChat);
    if (!customText) setInput('');
  }, [input, operator, userRole, shift]);

  const handleBotEscalate = useCallback((payload: { device: string; issueDetails: string }) => {
    const msgKey = push(child(ref(db), 'messages')).key;
    if (!msgKey) return;
    set(ref(db, `messages/${msgKey}`), { id: msgKey, type: 'alert', sender: `BOT / ${payload.device}`, role: 'System', text: `🚨 ESCALATION: ${payload.issueDetails} reported by Operator ${operator}.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), resolved: false });
  }, [operator]);

  const handleBotResolve = useCallback((payload: { device: string; issueDetails: string }) => {
    const msgKey = push(child(ref(db), 'messages')).key;
    if (!msgKey) return;
    set(ref(db, `messages/${msgKey}`), { id: msgKey, type: 'system', sender: 'SOP ASSISTANT', role: 'System', text: `✅ SOP Resolved: Operator ${operator} fixed ${payload.device} (${payload.issueDetails}).`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  }, [operator]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[500px] md:h-[650px]">
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><span>💬</span> Team Intercom</h4>
        <button onClick={() => setShowBot(!showBot)} className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all ${showBot?'bg-indigo-600 border-indigo-500 text-white':'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700'}`}>{showBot?"Hide SOP Bot":"🤖 Open SOP Bot"}</button>
      </div>
      {showBot&&(<div className="p-3 bg-slate-900 border-b border-slate-800 animate-fadeIn overflow-y-auto max-h-[320px]"><SopBotWidget operatorContext={{ name: operator }} onEscalate={handleBotEscalate} onResolve={handleBotResolve} /></div>)}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">
        {messages.length===0&&<div className="text-center text-slate-400 font-medium text-xs mt-12 italic">No messages yet.</div>}
        {messages.map(msg => (
          <div key={msg.id} className={`p-3 rounded-xl border transition-all text-xs ${msg.type==='alert'?(msg.resolved?'bg-emerald-50/70 border-emerald-200 text-slate-700':'bg-rose-50 border-rose-200 shadow-sm animate-pulse text-slate-800'):(msg.type==='system'?'bg-slate-100 border-slate-200 text-slate-600 italic':'bg-white border-slate-200 shadow-sm text-slate-800')} ${msg.role==='Technician'?'border-l-4 border-l-amber-500':(msg.role==='Operator'?'border-l-4 border-l-indigo-500':'')}`}>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-1">
              <span>{msg.role==='Technician'?'🔧 ':(msg.role==='Operator'?'👷 ':'🤖 ')}{msg.sender} {msg.shift?`[Shift ${msg.shift}]`:''}</span>
              <span>{msg.timestamp}</span>
            </div>
            <p className={`${msg.type==='alert'&&!msg.resolved?'font-bold text-rose-700':'font-medium'}`}>{msg.text}</p>
            {msg.image&&(<div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-black max-w-xs"><img src={msg.image} alt="upload" className="w-full object-contain max-h-40 cursor-pointer" onClick={()=>{ if(msg.image?.startsWith('data:image/')) window.open(msg.image); }}/></div>)}
            {msg.type==='alert'&&!msg.resolved&&(
              <div className="mt-3 border-t border-rose-200/60 pt-2">
                {userRole==='Technician'?(<button onClick={()=>onResolve(msg.refLogId!)} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold py-1.5 px-2 rounded-md text-[11px] transition-all">⚡ Resolve This Alarm</button>):(<span className="text-[10px] text-rose-500 font-bold bg-white px-2 py-0.5 rounded border border-rose-200">🔒 Technician access required</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={(e)=>submitChat(e)} className="p-3 border-t border-slate-200 bg-white flex gap-2 items-center">
        <label className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer transition-all border border-slate-300">
          📷
          <input type="file" accept="image/*" className="hidden" onChange={async(e)=>{if(e.target.files?.[0]){try{const b64=await compressAndEncodeImage(e.target.files[0],500);submitChat(null,"[Image Attachment]",b64);}catch{alert("Upload failed.");}}}}/>
        </label>
        <input type="text" value={input} onChange={e=>setInput(e.target.value)} maxLength={500} placeholder="Type a message..." className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"/>
        <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs tracking-wider transition-all">Send</button>
      </form>
    </div>
  );
}

function LogsSheetView({ logs }: { logs: LogEntry[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const processedLogs = useMemo(() => logs.filter(log => {
    const matchesSearch = log.location.toLowerCase().includes(searchTerm.toLowerCase()) || log.ipAddress.includes(searchTerm) || (log.details?.toolName||'').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && (categoryFilter==='ALL'||log.category===categoryFilter);
  }), [logs, searchTerm, categoryFilter]);

  const triggerCSVExport = useCallback(() => {
    if (!logs||logs.length===0) return;
    const headers = ["Timestamp","Category","IP Address","Location","Line","Operator","Shift","Status","Tool Name","Device ID","Root Cause","Action Done","Problem Detail","Temperature","MCB Status","Panel Cleaned","Exhaust Status","Current Load"];
    const csvRows = [headers.join(","), ...logs.map(log => [
      `"${log.timestamp||''}"`,`"${log.category||''}"`,`"${log.ipAddress||''}"`,`"${log.location||''}"`,`"${log.details?.line||''}"`,
      `"${log.operator||''}"`,`"${log.shift||''}"`,`"${log.status||''}"`,`"${log.details?.toolName||''}"`,`"${log.details?.deviceId||''}"`,
      `"${(log.details?.rootCause||'').replace(/"/g,'""')}"`,`"${(log.details?.actionDone||'').replace(/"/g,'""')}"`,`"${(log.details?.problemDetail||'').replace(/"/g,'""')}"`,
      `"${log.details?.temp||''}"`,`"${log.details?.mcbUp!==undefined?(log.details.mcbUp?'ON':'OFF'):''}"`,`"${log.details?.panelCleaned!==undefined?(log.details.panelCleaned?'Yes':'No'):''}"`,
      `"${log.details?.exhaustFan!==undefined?(log.details.exhaustFan?'Active':'Inactive'):''}"`,`"${log.details?.currentLoad||''}"`
    ].join(","))];
    const blob = new Blob([csvRows.join("\n")],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href",url); a.setAttribute("download",`Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [logs]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div><h3 className="text-base font-bold text-slate-900">Shift Log History</h3><p className="text-xs text-slate-500 mt-0.5">All equipment check-ins and fault reports.</p></div>
        <button onClick={triggerCSVExport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5">📥 Export CSV</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Search</label><input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="IP, location or device..." className="w-full text-xs p-2 rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"/></div>
        <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Category</label><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="w-full text-xs p-2 bg-white rounded-lg border border-slate-300 outline-none text-slate-900"><option value="ALL">All</option><option value="Tools">Tools</option><option value="TVs & Scanners">TVs & Scanners</option><option value="UPS">UPS</option><option value="Panels">Panels</option></select></div>
        <div className="flex items-end justify-end text-xs font-bold text-slate-400 pb-2">Showing {processedLogs.length} results</div>
      </div>
      {/* ── Mobile log cards ── */}
      <div className="md:hidden space-y-3">
        {processedLogs.length===0?(
          <p className="text-center text-slate-400 italic text-xs py-6">No logs match your search.</p>
        ):processedLogs.map(l=>(
          <div key={l.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-500">{l.timestamp}</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${l.status==='Pending'?'bg-rose-100 text-rose-700':(l.status==='Fixed'?'bg-indigo-100 text-indigo-700':'bg-emerald-100 text-emerald-700')}`}>{l.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <span className="text-slate-400 font-semibold">Category</span><span className="font-bold uppercase">{l.category}</span>
              <span className="text-slate-400 font-semibold">IP</span><span className="font-mono text-indigo-600 font-bold">{l.ipAddress}</span>
              <span className="text-slate-400 font-semibold">Location</span><span className="font-semibold">{l.location}</span>
              <span className="text-slate-400 font-semibold">Operator</span><span>{l.operator} · Shift {l.shift}</span>
            </div>
            {l.details?.rootCause&&(
              <div className="bg-white border border-rose-100 rounded-lg p-2 text-[11px]">
                <p><strong className="text-rose-600">Cause:</strong> {l.details.rootCause}</p>
                <p><strong>Action:</strong> {l.details.actionDone}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Desktop log table ── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead><tr className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]"><th className="p-3.5">Time</th><th className="p-3.5">Category</th><th className="p-3.5">IP / ID</th><th className="p-3.5">Location</th><th className="p-3.5">Operator</th><th className="p-3.5">Status</th><th className="p-3.5">Details</th></tr></thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {processedLogs.length===0?(<tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No logs match your search.</td></tr>):processedLogs.map((l,idx)=>(
              <tr key={l.id} className={idx%2===0?'bg-slate-50/50':'bg-white'}>
                <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono font-bold">{l.timestamp}</td>
                <td className="p-3.5 whitespace-nowrap"><span className="bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded font-bold text-[10px] uppercase">{l.category}</span></td>
                <td className="p-3.5 whitespace-nowrap font-mono text-indigo-600 font-bold">{l.ipAddress}<br/><span className="text-[10px] text-slate-400 font-sans">ID: {l.details?.deviceId||'—'}</span></td>
                <td className="p-3.5 whitespace-nowrap font-semibold">{l.location}<br/><span className="text-[10px] text-slate-400">Line: {l.details?.line||'N/A'}</span></td>
                <td className="p-3.5 whitespace-nowrap">{l.operator}<br/><span className="text-[10px] text-slate-400 font-bold">Shift {l.shift}</span></td>
                <td className="p-3.5 whitespace-nowrap"><span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${l.status==='Pending'?'bg-rose-100 text-rose-700':(l.status==='Fixed'?'bg-indigo-100 text-indigo-700':'bg-emerald-100 text-emerald-700')}`}>{l.status}</span></td>
                <td className="p-3.5 max-w-xs truncate text-[11px]">{l.details?.rootCause?(<div><p><strong className="text-rose-600">Cause:</strong> {l.details.rootCause}</p><p><strong>Action:</strong> {l.details.actionDone}</p></div>):(<span className="italic text-slate-400">No fault</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssetCatalogueView({ assets, userRole }: { assets: AssetComponent[], userRole: string }) {
  const { addToast } = useContext(ToastContext);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('Tools');
  const [newMake, setNewMake] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [newIp, setNewIp] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [extraFields, setExtraFields] = useState<{key:string;val:string}[]>([]);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editData, setEditData] = useState<Partial<AssetComponent>>({});
  const [editExtra, setEditExtra] = useState<{key:string;val:string}[]>([]);
  const [importing, setImporting] = useState(false);

  const addExtraField = () => setExtraFields(f=>[...f,{key:'',val:''}]);
  const removeExtraField = (i:number) => setExtraFields(f=>f.filter((_,idx)=>idx!==i));
  const updateExtraField = (i:number,k:'key'|'val',v:string) => setExtraFields(f=>f.map((x,idx)=>idx===i?{...x,[k]:v}:x));

  const registerNewAsset = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { addToast("Asset Name is required.", "error"); return; }
    const assetKey = push(child(ref(db),'assets')).key;
    if (!assetKey) return;
    const custom: Record<string,string>={};
    extraFields.filter(f=>f.key.trim()).forEach(f=>{custom[f.key.trim()]=f.val;});
    const payload: AssetComponent = { id:assetKey, componentName:newName.trim(), category:newCat, make:newMake.trim(), controllerSerial:newSerial.trim(), ipAddress:newIp.trim()||'0.0.0.0', stageLocation:newLoc.trim(), statusFlag:'OK', sopQrCode:'', ...(Object.keys(custom).length>0&&{customFields:custom}) };
    set(ref(db,`assets/${assetKey}`),payload)
      .then(()=>{addToast("Asset registered.","success");setNewName('');setNewMake('');setNewSerial('');setNewIp('');setNewLoc('');setExtraFields([]);})
      .catch(err=>addToast(`Failed: ${err.message}`,"error"));
  }, [newName,newCat,newMake,newSerial,newIp,newLoc,extraFields,addToast]);

  // Aliases: column name lowercased with spaces/underscores/dots/hyphens removed
  // 'name' removed — too broad, causes false matches on unrelated columns
  const KNOWN_FIELD_ALIASES: Record<string, keyof AssetComponent> = {
    'assetname':'componentName','componentname':'componentName',
    'assetno':'componentName','toolid':'componentName','componentno':'componentName',
    'category':'category',
    'make':'make','manufacturer':'make','brand':'make',
    'controllerserial':'controllerSerial','controllerserialno':'controllerSerial',
    'serialno':'controllerSerial',
    'ipaddress':'ipAddress','ipaddr':'ipAddress',
    'stagelocation':'stageLocation','stage':'stageLocation',
    'location':'stageLocation','loc':'stageLocation',
  };

  const handleAssetExcelImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data,{type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string,any>[] = XLSX.utils.sheet_to_json(ws,{defval:''});
        if (rows.length===0) { addToast("Excel file has no rows.","error"); setImporting(false); return; }
        const existingByName = new Map<string, AssetComponent>();
        assets.forEach(a=>existingByName.set(a.componentName.trim().toLowerCase(),a));
        const updates: Record<string,any>={};
        let createdCount=0, updatedCount=0;
        rows.forEach(row=>{
          const mapped: Partial<AssetComponent>={};
          const custom: Record<string,string>={};
          Object.entries(row).forEach(([colName,rawVal])=>{
            const val = rawVal===undefined||rawVal===null?'':String(rawVal).trim();
            // Normalise: lowercase, strip spaces/underscores/dots/hyphens
            const key = colName.trim().toLowerCase().replace(/[\s_.\-]+/g,'');
            const aliasTarget = KNOWN_FIELD_ALIASES[key];
            if (aliasTarget) { (mapped as any)[aliasTarget]=val; }
            else if (colName.trim()) { custom[colName.trim()]=val; }
          });
          const name = (mapped.componentName||'').trim();
          if (!name) return;
          const existing = existingByName.get(name.toLowerCase());
          if (existing) {
            const payload: Record<string,any>={};
            (['category','make','controllerSerial','ipAddress','stageLocation'] as const).forEach(f=>{ if(mapped[f]!==undefined&&mapped[f]!=='') payload[f]=mapped[f]; });
            if (Object.keys(custom).length>0) payload.customFields={...(existing.customFields||{}),...custom};
            if (Object.keys(payload).length>0) { Object.entries(payload).forEach(([k,v])=>{updates[`/assets/${existing.id}/${k}`]=v;}); updatedCount++; }
          } else {
            const assetKey = push(child(ref(db),'assets')).key;
            if (!assetKey) return;
            const payload: AssetComponent = { id:assetKey, componentName:name, category:mapped.category||'Tools', make:mapped.make||'', controllerSerial:mapped.controllerSerial||'', ipAddress:mapped.ipAddress||'0.0.0.0', stageLocation:mapped.stageLocation||'', statusFlag:'OK', sopQrCode:'', ...(Object.keys(custom).length>0&&{customFields:custom}) };
            updates[`/assets/${assetKey}`]=payload;
            existingByName.set(name.toLowerCase(),payload);
            createdCount++;
          }
        });
        update(ref(db),updates)
          .then(()=>addToast(`Import done: ${createdCount} added, ${updatedCount} updated.`,"success"))
          .catch(err=>addToast(`Import failed: ${err.message}`,"error"))
          .finally(()=>setImporting(false));
      } catch(err:any) { addToast(`Could not read file: ${err.message}`,"error"); setImporting(false); }
      finally { e.target.value=''; }
    };
    reader.readAsArrayBuffer(file);
  }, [assets, addToast]);

  const startEdit = (a: AssetComponent) => {
    setEditingId(a.id);
    setEditData({componentName:a.componentName,category:a.category,make:a.make||'',controllerSerial:a.controllerSerial||'',ipAddress:a.ipAddress,stageLocation:a.stageLocation});
    setEditExtra(Object.entries(a.customFields||{}).map(([k,v])=>({key:k,val:v as string})));
  };
  const saveEdit = async (id: string) => {
    const custom: Record<string,string>={};
    editExtra.filter(f=>f.key.trim()).forEach(f=>{custom[f.key.trim()]=f.val;});
    await update(ref(db,`assets/${id}`),{...editData,customFields:Object.keys(custom).length>0?custom:null})
      .then(()=>{addToast("Updated.","success");setEditingId(null);})
      .catch(err=>addToast(`Failed: ${err.message}`,"error"));
  };
  const iCell = (field: keyof typeof editData, placeholder='') => (
    <input type="text" value={(editData[field] as string)||''} onChange={e=>setEditData({...editData,[field]:e.target.value})} placeholder={placeholder} className="w-full p-1.5 border border-indigo-400 rounded-lg text-slate-900 outline-none text-xs font-semibold min-w-[80px]"/>
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Add New Asset</h4>
          <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm flex items-center gap-1.5 ${importing?'opacity-60 pointer-events-none':''}`}>
            {importing?'⏳ Importing...':'📥 Import Excel'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importing} onChange={handleAssetExcelImport}/>
          </label>
        </div>
        <form onSubmit={registerNewAsset} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div><label className="block font-semibold text-slate-700 mb-1">Asset Name *</label><input type="text" value={newName} onChange={e=>setNewName(e.target.value)} maxLength={30} placeholder="e.g. LT1111" className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"/></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Category</label><select value={newCat} onChange={e=>setNewCat(e.target.value)} className="w-full p-2.5 bg-white rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"><option>Tools</option><option>TVs &amp; Scanners</option><option>UPS</option><option>Panels</option></select></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Make</label><input type="text" value={newMake} onChange={e=>setNewMake(e.target.value)} maxLength={50} placeholder="e.g. Tohnichi" className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"/></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Controller Serial</label><input type="text" value={newSerial} onChange={e=>setNewSerial(e.target.value)} maxLength={30} placeholder="e.g. A06814" className="w-full p-2.5 font-mono rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"/></div>
            <div><label className="block font-semibold text-slate-700 mb-1">IP Address</label><input type="text" value={newIp} onChange={e=>setNewIp(e.target.value)} maxLength={15} placeholder="00.00.00.00" className="w-full p-2.5 font-mono font-bold rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"/></div>
            <div><label className="block font-semibold text-slate-700 mb-1">Location</label><input type="text" value={newLoc} onChange={e=>setNewLoc(e.target.value)} maxLength={60} placeholder="e.g. Stage-04LH" className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"/></div>
          </div>
          {extraFields.length>0&&(<div className="space-y-2"><p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Additional Fields</p>{extraFields.map((f,i)=>(<div key={i} className="flex gap-2 items-center"><input type="text" value={f.key} onChange={e=>updateExtraField(i,'key',e.target.value)} placeholder="Field name" className="w-40 p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none font-semibold"/><input type="text" value={f.val} onChange={e=>updateExtraField(i,'val',e.target.value)} placeholder="Value" className="flex-1 p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none"/><button type="button" onClick={()=>removeExtraField(i)} className="text-rose-500 hover:text-rose-700 font-bold text-base px-1">✕</button></div>))}</div>)}
          <div className="flex gap-3 pt-1">
            <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-lg shadow uppercase tracking-wider transition-all">Add Asset</button>
            <button type="button" onClick={addExtraField} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 px-4 rounded-lg border border-indigo-200 transition-all">+ Add Field</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Registered Assets ({assets.length})</h3>

        {/* ── Mobile cards (hidden on md+) ── */}
        {assets.length === 0 ? (
          <p className="text-center text-slate-400 italic text-xs py-8">No assets yet. Import the Excel or add manually.</p>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {assets.map(a => (
                <div key={a.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{a.componentName}</span>
                    <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${a.statusFlag==='FAULT'?'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse':'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>● {a.statusFlag}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-slate-400 font-semibold">Category</span><span className="text-slate-700 font-bold uppercase">{a.category}</span>
                    <span className="text-slate-400 font-semibold">Make</span><span className="text-slate-700">{a.make||'—'}</span>
                    <span className="text-slate-400 font-semibold">Serial</span><span className="font-mono text-slate-600">{a.controllerSerial||'—'}</span>
                    <span className="text-slate-400 font-semibold">IP</span><span className="font-mono text-indigo-600 font-bold">{fmtIp(a.ipAddress)}</span>
                    <span className="text-slate-400 font-semibold">Location</span><span className="text-slate-700">{a.stageLocation||'—'}</span>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-slate-200">
                    <label className="flex-1 text-center cursor-pointer bg-slate-900 text-white font-bold py-2 rounded-lg text-[11px]">
                      Upload QR
                      <input type="file" accept="image/*" className="hidden" onChange={async e=>{if(e.target.files?.[0]){try{const b64=await compressAndEncodeImage(e.target.files[0],400);update(ref(db,`assets/${a.id}`),{sopQrCode:b64}).then(()=>addToast("QR updated.","success")).catch(err=>addToast(`Failed: ${err.message}`,"error"));}catch(err:any){addToast(err.message,"error");}}}}/>
                    </label>
                    {userRole==='Technician'&&(<button onClick={()=>startEdit(a)} className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg text-[11px]">Modify</button>)}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]"><th className="p-4">Asset Name</th><th className="p-4">Category</th><th className="p-4">Make</th><th className="p-4">Controller Serial</th><th className="p-4">IP Address</th><th className="p-4">Location</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {assets.map((a,idx)=>{
                    const isEditing=editingId===a.id;
                    return (
                      <tr key={a.id} className={idx%2===0?'bg-slate-50/50':'bg-white'}>
                        <td className="p-4 font-bold text-slate-900">{isEditing?iCell('componentName','Asset name'):a.componentName}</td>
                        <td className="p-4">{isEditing?(<select value={editData.category||a.category} onChange={e=>setEditData({...editData,category:e.target.value})} className="p-1.5 bg-white border border-indigo-400 rounded-lg text-slate-900 outline-none text-[11px] font-bold"><option>Tools</option><option>TVs &amp; Scanners</option><option>UPS</option><option>Panels</option></select>):<span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px] uppercase border border-slate-200">{a.category}</span>}</td>
                        <td className="p-4 font-semibold text-slate-700">{isEditing?iCell('make','Make'):(a.make||'—')}</td>
                        <td className="p-4 font-mono font-bold text-slate-600">{isEditing?iCell('controllerSerial','Serial'):(a.controllerSerial||'—')}</td>
                        <td className="p-4 font-mono text-indigo-600 font-bold">{isEditing?iCell('ipAddress','IP'):fmtIp(a.ipAddress)}</td>
                        <td className="p-4 text-slate-600 font-semibold">{isEditing?iCell('stageLocation','Location'):a.stageLocation}</td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded font-extrabold text-[10px] tracking-wide ${a.statusFlag==='FAULT'?'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse':'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>● NODE {a.statusFlag}</span></td>
                        <td className="p-4 text-right whitespace-nowrap">
                          {isEditing?(
                            <div className="space-y-2">
                              {editExtra.map((f,i)=>(<div key={i} className="flex gap-1 items-center justify-end"><input type="text" value={f.key} onChange={e=>setEditExtra(ex=>ex.map((x,xi)=>xi===i?{...x,key:e.target.value}:x))} className="w-24 p-1 text-[10px] border border-indigo-300 rounded text-slate-800 outline-none" placeholder="Field"/><input type="text" value={f.val} onChange={e=>setEditExtra(ex=>ex.map((x,xi)=>xi===i?{...x,val:e.target.value}:x))} className="w-28 p-1 text-[10px] border border-indigo-300 rounded text-slate-800 outline-none" placeholder="Value"/><button type="button" onClick={()=>setEditExtra(ex=>ex.filter((_,xi)=>xi!==i))} className="text-rose-500 text-xs font-bold">✕</button></div>))}
                              <div className="flex items-center gap-1.5 justify-end">
                                <button type="button" onClick={()=>setEditExtra(ex=>[...ex,{key:'',val:''}])} className="text-[10px] text-indigo-500 font-bold underline">+field</button>
                                <button onClick={()=>saveEdit(a.id)} className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold">Save</button>
                                <button onClick={()=>setEditingId(null)} className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold">Cancel</button>
                              </div>
                            </div>
                          ):(
                            <div className="flex items-center gap-2 justify-end">
                              {Object.keys(a.customFields||{}).length>0&&<span className="text-[9px] text-slate-400 italic">+{Object.keys(a.customFields||{}).length} fields</span>}
                              {a.sopQrCode?(<img src={a.sopQrCode} alt="QR" className="w-8 h-8 rounded border border-slate-300 shadow-sm bg-white cursor-default"/>):<span className="text-[10px] text-slate-400 italic">No QR</span>}
                              <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm">
                                Upload QR
                                <input type="file" accept="image/*" className="hidden" onChange={async e=>{if(e.target.files?.[0]){try{const b64=await compressAndEncodeImage(e.target.files[0],400);update(ref(db,`assets/${a.id}`),{sopQrCode:b64}).then(()=>addToast("QR updated.","success")).catch(err=>addToast(`Failed: ${err.message}`,"error"));}catch(err:any){addToast(err.message,"error");}}}}/>
                              </label>
                              {userRole==='Technician'&&(<button onClick={()=>startEdit(a)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm">Modify</button>)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ToolMaterialsPanel() {
  const { addToast } = useContext(ToastContext);
  const [materialsData, setMaterialsData] = useState<Record<string, ToolMaterialEntry[]>>({});
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editCount, setEditCount] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [addRow, setAddRow] = useState({ material: '', assetNo: '', count: '', stageCode: '' });

  useEffect(() => {
    const unsub = onValue(ref(db, 'toolMaterials'), snap => {
      setMaterialsLoading(false);
      const data = snap.val();
      // data===null means either truly empty OR Firebase hasn't synced yet
      // We set empty only after confirmed first read (materialsLoading goes false)
      if (!data) { setMaterialsData({}); return; }
      const parsed: Record<string, ToolMaterialEntry[]> = {};
      Object.keys(data).forEach(material => {
        const assetsObj = data[material] || {};
        parsed[material] = Object.keys(assetsObj).map(assetNo => {
          const val = assetsObj[assetNo];
          // Support both legacy plain number and new {count, stageCode} object
          const count = typeof val === 'object' && val !== null ? Number(val.count) || 0 : Number(val) || 0;
          const stageCode = typeof val === 'object' && val !== null ? (val.stageCode || '') : '';
          const assetName = typeof val === 'object' && val !== null ? (val.assetName || '') : '';
          return { assetNo, assetName, count, stageCode };
        }).filter(e => e.count > 0);
      });
      setMaterialsData(parsed);
    });
    return () => unsub();
  }, []);

  const allMaterials = useMemo(() => Object.keys(materialsData).sort(), [materialsData]);
  const filteredMaterials = useMemo(() => allMaterials.filter(m => m.toLowerCase().includes(materialSearch.toLowerCase()) && !selectedMaterials.includes(m)), [allMaterials, materialSearch, selectedMaterials]);

  const mergedRows = useMemo(() => {
    const map = new Map<string, { assetNo: string; count: number; stageCode: string; materials: string[] }>();
    selectedMaterials.forEach(mat => {
      (materialsData[mat] || []).forEach(entry => {
        if (entry.count <= 0) return;
        const existing = map.get(entry.assetNo);
        if (existing) { existing.count += entry.count; existing.materials.push(mat); }
        else { map.set(entry.assetNo, { assetNo: entry.assetNo, assetName: entry.assetName || '', count: entry.count, stageCode: entry.stageCode || '', materials: [mat] }); }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.assetNo.localeCompare(b.assetNo));
  }, [selectedMaterials, materialsData]);

  const handleExcelImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length === 0) { addToast("Excel file has no rows.", "error"); setImporting(false); return; }
        const colMap: Record<string, string> = {};
        Object.keys(rows[0]).forEach(col => {
          const key = col.trim().toLowerCase().replace(/[\s_.]+/g, '');
          // Exact matches only — prevents AssetCategory/AssetType/AssetName grabbing the 'asset' slot
          if (key === 'materialcode' || key === 'material') colMap.material = col;
          else if (key === 'assetno' || key === 'assetid') colMap.asset = col;
          else if (key === 'count' || key === 'qty' || key === 'quantity') colMap.count = col;
          else if (key === 'stagecode') colMap.stageCode = col;
          else if (key === 'assetname') colMap.assetName = col;
        });
        if (!colMap.material || !colMap.asset || !colMap.count) {
          addToast(`Excel column mapping failed. Found: ${Object.keys(colMap).join(', ')}. Need: MaterialCode, AssetNo, Count.`, "error");
          setImporting(false); return;
        }
        const updates: Record<string, any> = {};
        let rowCount = 0;
        rows.forEach(row => {
          const material = String(row[colMap.material]).trim();
          const assetNo = String(row[colMap.asset]).trim();
          const count = Number(row[colMap.count]) || 0;
          const stageCode = colMap.stageCode ? String(row[colMap.stageCode] || '').trim() : '';
          const assetName = colMap.assetName ? String(row[colMap.assetName] || '').trim() : '';
          if (!material || !assetNo) return;
          const safeMat = material.replace(/[.#$\[\]/]/g,'_');
          const safeAsset = assetNo.replace(/[.#$\[\]/]/g,'_');
          updates[`/toolMaterials/${safeMat}/${safeAsset}`] = { count, stageCode, assetName };
          rowCount++;
        });
        update(ref(db), updates)
          .then(() => addToast(`Imported ${rowCount} rows.`, "success"))
          .catch(err => addToast(`Import failed: ${err.message}`, "error"))
          .finally(() => setImporting(false));
      } catch (err: any) { addToast(`Could not read file: ${err.message}`, "error"); setImporting(false); }
      finally { e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  }, [addToast]);

  const [editStageCode, setEditStageCode] = useState('');
  const saveEditCount = useCallback(async (material: string, assetNo: string) => {
    const num = Number(editCount);
    if (isNaN(num) || num < 0) { addToast("Count must be a non-negative number.", "error"); return; }
    await set(ref(db, `toolMaterials/${material.replace(/[.#$\[\]/]/g,'_')}/${assetNo.replace(/[.#$\[\]/]/g,'_')}`), { count: num, stageCode: editStageCode.trim() })
      .then(() => { addToast("Updated.", "success"); setEditingKey(null); })
      .catch(err => addToast(`Failed: ${err.message}`, "error"));
  }, [editCount, editStageCode, addToast]);

  const deleteEntry = useCallback(async (material: string, assetNo: string) => {
    if (!window.confirm(`Remove ${assetNo} from ${material}?`)) return;
    await set(ref(db, `toolMaterials/${material.replace(/[.#$\[\]/]/g,'_')}/${assetNo.replace(/[.#$\[\]/]/g,'_')}`), null)
      .then(() => addToast("Removed.", "success"))
      .catch(err => addToast(`Failed: ${err.message}`, "error"));
  }, [addToast]);

  const addNewEntry = useCallback(async () => {
    const material = addRow.material.trim();
    const assetNo = addRow.assetNo.trim();
    const count = Number(addRow.count);
    if (!material || !assetNo) { addToast("Material code and Asset No. are required.", "error"); return; }
    if (isNaN(count) || count <= 0) { addToast("Count must be greater than zero.", "error"); return; }
    await set(ref(db, `toolMaterials/${material.replace(/[.#$\[\]/]/g,'_')}/${assetNo.replace(/[.#$\[\]/]/g,'_')}`), { count, stageCode: addRow.stageCode.trim() })
      .then(() => { addToast("Entry added.", "success"); setAddRow({ material: '', assetNo: '', count: '' }); setShowAddRow(false); })
      .catch(err => addToast(`Failed: ${err.message}`, "error"));
  }, [addRow, addToast]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tool Materials — Asset Lookup</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Select material codes to see the required assets and their counts.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddRow(v => !v)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm">+ Add Entry</button>
            <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] tracking-wide transition-all shadow-sm flex items-center gap-1.5 ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
              {importing ? '⏳ Importing...' : '📥 Import Excel'}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importing} onChange={handleExcelImport}/>
            </label>
          </div>
        </div>

        {showAddRow && (
          <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs items-end">
              <div><label className="block font-semibold text-slate-700 mb-1">Material Code</label><input type="text" value={addRow.material} onChange={e=>setAddRow({...addRow,material:e.target.value})} maxLength={30} placeholder="e.g. CCG15099D00012" className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 font-mono"/></div>
              <div><label className="block font-semibold text-slate-700 mb-1">Asset No.</label><input type="text" value={addRow.assetNo} onChange={e=>setAddRow({...addRow,assetNo:e.target.value})} maxLength={20} placeholder="e.g. LT0988" className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 font-mono"/></div>
              <div><label className="block font-semibold text-slate-700 mb-1">Count</label><input type="number" min="1" value={addRow.count} onChange={e=>setAddRow({...addRow,count:e.target.value})} placeholder="e.g. 4" className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900"/></div>
              <div><label className="block font-semibold text-slate-700 mb-1">Stage Code</label><input type="text" maxLength={20} value={addRow.stageCode} onChange={e=>setAddRow({...addRow,stageCode:e.target.value})} placeholder="e.g. 0201CH12LH" className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 font-mono"/></div>
              <div className="flex gap-2"><button onClick={addNewEntry} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all">Save</button><button onClick={()=>setShowAddRow(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-all">Cancel</button></div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Select Materials</label>
            {selectedMaterials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedMaterials.map(m => (
                  <span key={m} className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5">
                    {m}
                    <button onClick={() => setSelectedMaterials(s => s.filter(x => x !== m))} className="text-indigo-500 hover:text-indigo-800 font-bold">✕</button>
                  </span>
                ))}
                <button onClick={() => setSelectedMaterials([])} className="text-[11px] text-rose-500 hover:text-rose-700 font-bold underline px-1">Clear all</button>
              </div>
            )}
            <div className="relative w-full md:w-96">
              <input type="text" value={materialSearch} onChange={e=>{setMaterialSearch(e.target.value);setShowDropdown(true);}} onFocus={()=>setShowDropdown(true)} onBlur={()=>setTimeout(()=>setShowDropdown(false),150)}
                placeholder={materialsLoading ? "Connecting to database..." : allMaterials.length===0 ? "No materials imported yet — use Import Excel above" : "Search material code..."}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
              {showDropdown && filteredMaterials.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto max-h-52">
                  {filteredMaterials.slice(0,50).map(m => (
                    <button key={m} type="button" onMouseDown={()=>{setSelectedMaterials(s=>[...s,m]);setMaterialSearch('');}}
                      className="w-full text-left px-4 py-2.5 text-xs font-mono font-bold text-slate-800 hover:bg-slate-50 transition-all">{m}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {materialsLoading ? (
            <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block"></span>
              Loading data from database...
            </div>
          ) : selectedMaterials.length === 0 ? (
            <div className="p-10 text-center italic text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">Select at least one material above to see required assets and counts.</div>
          ) : mergedRows.length === 0 ? (
            <div className="p-6 text-center italic text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">No assets with count &gt; 0 for selected material(s).</div>
          ) : (
            <>
              {/* ── Mobile cards ── */}
              <div className="md:hidden space-y-3">
                {mergedRows.map(row => {
                  const primaryMaterial = row.materials[0];
                  return (
                    <div key={row.assetNo} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-indigo-600 text-sm">{row.assetNo}</span>
                        <span className="font-mono text-indigo-700 font-bold text-[11px] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">{row.stageCode||'—'}</span>
                      </div>
                      <p className="font-semibold text-slate-700">{row.assetName||'—'}</p>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span className="text-slate-400 font-semibold">Count</span><span className="font-bold">{row.count}</span>
                        <span className="text-slate-400 font-semibold">Material</span><span className="font-mono truncate">{row.materials.join(', ')}</span>
                      </div>
                      {row.materials.length === 1 && (
                        <div className="flex gap-2 pt-1 border-t border-slate-200">
                          <button onClick={()=>{setEditingKey(`${primaryMaterial}|${row.assetNo}`);setEditCount(String(row.count));setEditStageCode(row.stageCode||'');}} className="flex-1 text-center py-2 text-[11px] text-indigo-600 font-bold border border-indigo-200 rounded-lg bg-indigo-50">Edit</button>
                          <button onClick={()=>deleteEntry(primaryMaterial,row.assetNo)} className="flex-1 text-center py-2 text-[11px] text-rose-500 font-bold border border-rose-200 rounded-lg bg-rose-50">Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop table ── */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">Asset No.</th><th className="p-3">Asset Name</th><th className="p-3">Count</th><th className="p-3">Stage Code</th><th className="p-3">From Material(s)</th><th className="p-3 text-right">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {mergedRows.map((row, idx) => {
                      const primaryMaterial = row.materials[0];
                      const editKey = `${primaryMaterial}|${row.assetNo}`;
                      const isEditing = editingKey === editKey;
                      return (
                        <tr key={row.assetNo} className={idx%2===0?'bg-white':'bg-slate-50/50'}>
                          <td className="p-3 font-mono font-bold text-indigo-600">{row.assetNo}</td>
                          <td className="p-3 text-slate-700 font-semibold text-[11px]">{row.assetName||'—'}</td>
                          <td className="p-3 font-bold text-slate-900">{isEditing?(<input type="number" min="0" value={editCount} onChange={e=>setEditCount(e.target.value)} className="w-20 p-1 border border-indigo-400 rounded-lg text-slate-900 outline-none font-bold"/>):row.count}</td>
                          <td className="p-3 font-mono text-indigo-700 font-bold text-[11px]">{isEditing?(<input type="text" maxLength={20} value={editStageCode} onChange={e=>setEditStageCode(e.target.value)} className="w-28 p-1 border border-indigo-400 rounded-lg text-slate-900 outline-none font-mono font-bold"/>):(row.stageCode||'—')}</td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">{row.materials.join(', ')}</td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {row.materials.length>1?(<span className="text-[10px] text-slate-400 italic">multi-source</span>):isEditing?(
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={()=>saveEditCount(primaryMaterial,row.assetNo)} className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold">Save</button>
                                <button onClick={()=>setEditingKey(null)} className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold">Cancel</button>
                              </div>
                            ):(
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={()=>{setEditingKey(editKey);setEditCount(String(row.count));setEditStageCode(row.stageCode||'');}} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline">Edit</button>
                                <button onClick={()=>deleteEntry(primaryMaterial,row.assetNo)} className="text-[11px] text-rose-500 hover:text-rose-700 font-bold underline">Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const DEEP_SOP_MATRIX: Record<string, { icon: string; issues: Record<string, { field: string; text: string }>; }> = {
  "WiFi Torque Wrench": { icon: "🛠️", issues: { "Network Pairing & Sync Failure": { field: "wrenchSync", text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)." }, "Memory Cache Full (Offline Lock)": { field: "wrenchCache", text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)." }, "Calibration Drift / Tolerances Out of Spec": { field: "wrenchCal", text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)." }, "Access Denied (MAC Filtering Error)": { field: "wrenchMac", text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)." } } },
  "Uninterruptible Power Supply (UPS)": { icon: "⚡", issues: { "Electrical Current Overload Warning (currentLoad)": { field: "currentLoad", text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning." }, "Air Intake Filter Grid Clogged (filterCleaned)": { field: "filterCleaned", text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning." }, "Internal Battery Degradation Alarm": { field: "batteryAlarm", text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning." }, "Static Inverter Bypass Mode Engaged": { field: "bypassMode", text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning." } } },
  "Industrial Barcode Scanner": { icon: "🖨️", issues: { "Character Corruption / Parsing Errors": { field: "scanParsing", text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot." }, "Aiming Illumination Laser Weak/Off": { field: "scanLaser", text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot." }, "Virtual COM Port Driver Crash": { field: "scanDriver", text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot." }, "Symbology Lock (Won't read 2D/QR codes)": { field: "scanSymbology", text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot." } } },
  "TV Displays & Status Monitors (Andon)": { icon: "📺", issues: { "Frozen Metric Telemetry / Web Socket Signal Drop": { field: "tvSocket", text: "Press Ctrl + F5 on the terminal keypad to force-refresh the interface page. If it is completely blank, cycle the physical power brick on the HDMI over Ethernet Extender box mounted behind the TV bezel. Set output properties to 1920x1080 @ 60Hz with a scale factor of 100%." }, "Aspect Ratio Distortion (Clipped Dashboard UI)": { field: "tvAspect", text: "Press Ctrl + F5 on the terminal keypad to force-refresh the interface page. If it is completely blank, cycle the physical power brick on the HDMI over Ethernet Extender box mounted behind the TV bezel. Set output properties to 1920x1080 @ 60Hz with a scale factor of 100%." }, "Screen Black / Client Box DHCP Lease Expiry": { field: "tvBlack", text: "Press Ctrl + F5 on the terminal keypad to force-refresh the interface page. If it is completely blank, cycle the physical power brick on the HDMI over Ethernet Extender box mounted behind the TV bezel. Set output properties to 1920x1080 @ 60Hz with a scale factor of 100%." } } },
  "Moxa Device (Serial-to-Ethernet)": { icon: "🔌", issues: { "IP Address Conflict / Gateway Unreachable": { field: "moxaIp", text: "Disconnect the Moxa LAN cable and run a terminal ping test to verify no other terminal matches the static IP. Open Moxa NPort Admin console, match serial port configuration settings directly to the machine manual requirements (e.g., Baud Rate 9600, Parity None, Stop Bit 1). Restart the Moxa NPort Real COM Engine service in Windows." }, "Serial Data Stream Timeout (RS-485/232 Fault)": { field: "moxaSerial", text: "Disconnect the Moxa LAN cable and run a terminal ping test to verify no other terminal matches the static IP. Open Moxa NPort Admin console, match serial port configuration settings directly to the machine manual requirements (e.g., Baud Rate 9600, Parity None, Stop Bit 1). Restart the Moxa NPort Real COM Engine service in Windows." }, "NPort Virtual COM Driver Mapping Disconnect": { field: "moxaMapping", text: "Disconnect the Moxa LAN cable and run a terminal ping test to verify no other terminal matches the static IP. Open Moxa NPort Admin console, match serial port configuration settings directly to the machine manual requirements (e.g., Baud Rate 9600, Parity None, Stop Bit 1). Restart the Moxa NPort Real COM Engine service in Windows." } } },
  "Machine Vision Systems": { icon: "📷", issues: { "Excessive Inspection False Rejects (Light Drift)": { field: "visionReject", text: "Close all structural line inspection hood shrouds to block factory roof lighting shifts. Clean the camera lens cover with an anti-static cloth. Access vision panel controls and initiate the Exposure Autofocus Self-Optimization Loop to re-teach the Golden Master reference template." }, "Pattern Alignment Drift / Missing Frame Triggers": { field: "visionAlign", text: "Close all structural line inspection hood shrouds to block factory roof lighting shifts. Clean the camera lens cover with an anti-static cloth. Access vision panel controls and initiate the Exposure Autofocus Self-Optimization Loop to re-teach the Golden Master reference template." }, "Industrial Fieldbus Drop (Profinet / EtherNet IP)": { field: "visionBus", text: "Close all structural line inspection hood shrouds to block factory roof lighting shifts. Clean the camera lens cover with an anti-static cloth. Access vision panel controls and initiate the Exposure Autofocus Self-Optimization Loop to re-teach the Golden Master reference template." } } }
};

const SopBotWidget = memo(function SopBotWidget({ operatorContext, onEscalate, onResolve }: { operatorContext: { name: string }, onEscalate: (p: any) => void, onResolve: (p: any) => void }) {
  const { addToast } = useContext(ToastContext);
  const [step, setStep] = useState<'category'|'issue'|'sop_display'|'new_issue_input'|'complete'>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIssue, setSelectedIssue] = useState('');
  const [customIssueText, setCustomIssueText] = useState('');

  const handleClearIssue = useCallback(async (modelId: string, issueField: string) => {
    try {
      const sanitizedModelId = modelId.replace(/[^a-zA-Z0-9-_]/g,"_");
      await update(ref(db,`telemetry/machines/${sanitizedModelId}`),{[issueField]:issueField==='filterCleaned'||issueField==='panelCleaned'?true:0,status:"Operational",lastClearedTimestamp:Date.now(),operatorSignature:operatorContext.name});
      onResolve({device:selectedCategory,issueDetails:selectedIssue});
      addToast("Issue cleared successfully.","success");
      setStep('complete');
    } catch { addToast("Sync failed. Check network.","error"); }
  }, [operatorContext.name,selectedCategory,selectedIssue,onResolve,addToast]);

  const handleNewIssueSubmit = useCallback(() => {
    if (!customIssueText.trim()) { addToast("Please describe the issue.","error"); return; }
    onEscalate({device:selectedCategory,issueDetails:`Emergency ticket: "${customIssueText.trim()}"`});
    setStep('complete');
  }, [customIssueText,selectedCategory,onEscalate,addToast]);

  return (
    <div className="bg-slate-950 rounded-xl border border-indigo-500/30 p-4 shadow-xl text-slate-200 text-xs w-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/><span className="font-bold text-indigo-400 tracking-wide text-[11px] uppercase">SOP Assistant</span></div>
      {step==='category'&&(<div className="space-y-2"><p className="text-[11px] text-slate-400 font-medium">Select the machine:</p><div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">{Object.keys(DEEP_SOP_MATRIX).map(catKey=>(<button key={catKey} type="button" onClick={()=>{setSelectedCategory(catKey);setStep('issue');}} className="w-full text-left bg-slate-900 hover:bg-slate-800 px-2.5 py-2 rounded-lg border border-slate-800 font-bold text-[11px] flex items-center gap-2 truncate"><span>{DEEP_SOP_MATRIX[catKey].icon}</span><span className="truncate">{catKey}</span></button>))}</div></div>)}
      {step==='issue'&&(<div className="space-y-2"><p className="text-[11px] text-slate-400">What issue are you seeing?</p><div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">{Object.keys(DEEP_SOP_MATRIX[selectedCategory]?.issues||{}).map(issueKey=>(<button key={issueKey} type="button" onClick={()=>{setSelectedIssue(issueKey);setStep('sop_display');}} className="w-full text-left bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded border border-slate-800 text-slate-300 text-[11px]">▪ {issueKey}</button>))}<button type="button" onClick={()=>setStep('new_issue_input')} className="w-full text-left bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 px-3 py-1.5 rounded border border-indigo-900/50 font-bold text-[11px]">+ New Issue (Not in List)</button></div><button onClick={()=>setStep('category')} className="text-[10px] text-slate-500 font-semibold underline block mt-2">← Back</button></div>)}
      {step==='sop_display'&&(<div className="space-y-3"><div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2"><div className="flex justify-between items-center text-amber-400 font-bold text-[11px]"><span>🔧 How to Fix It</span><span className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded font-mono text-slate-400 uppercase">SOP Steps</span></div><p className="text-slate-300 leading-relaxed text-[11px] bg-slate-950 p-2.5 rounded">{DEEP_SOP_MATRIX[selectedCategory].issues[selectedIssue].text}</p></div><button type="button" onClick={()=>handleClearIssue(selectedCategory,DEEP_SOP_MATRIX[selectedCategory].issues[selectedIssue].field)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-lg text-[11px] tracking-wide transition-all">✅ Issue Fixed — Mark Resolved</button><button onClick={()=>setStep('issue')} className="text-[10px] text-slate-500 font-semibold underline block">← Back</button></div>)}
      {step==='new_issue_input'&&(<div className="space-y-3"><div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-lg text-[11px] text-rose-300 font-medium">⚠️ Not in SOP. An urgent ticket will be created for the technician.</div><input type="text" value={customIssueText} onChange={e=>setCustomIssueText(e.target.value)} maxLength={300} placeholder="Describe the issue..." className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"/><div className="flex gap-2"><button type="button" onClick={()=>setStep('issue')} className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold text-xs">Cancel</button><button type="button" onClick={handleNewIssueSubmit} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs">Send Alert to Technician</button></div></div>)}
      {step==='complete'&&(<div className="text-center py-3 space-y-2 animate-fadeIn"><span className="text-2xl block">⚡</span><p className="text-[11px] text-emerald-400 font-bold">Done! Issue cleared and logged.</p><button type="button" onClick={()=>{setStep('category');setSelectedCategory('');setSelectedIssue('');setCustomIssueText('');}} className="text-[11px] text-indigo-400 font-bold underline block mx-auto">Start Over</button></div>)}
    </div>
  );
});

const ToastContainer = memo(function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`p-4 rounded-xl shadow-lg border text-xs font-bold pointer-events-auto flex items-center gap-2 animate-slideIn ${t.type==='success'?'bg-slate-900 border-slate-800 text-emerald-400':t.type==='error'?'bg-rose-600 border-rose-700 text-white':'bg-indigo-600 border-indigo-700 text-white'}`}>
          <span>{t.type==='success'?'✓':'⚠️'}</span>
          <p className="flex-1">{t.text}</p>
        </div>
      ))}
    </div>
  );
});
