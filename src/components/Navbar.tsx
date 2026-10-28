import React from 'react';

interface NavbarProps {
  page: 'dashboard' | 'logs_sheet' | 'catalogue' | 'bom_inventory';
  setPage: (page: 'dashboard' | 'logs_sheet' | 'catalogue' | 'bom_inventory') => void;
  userRole: string;
  assetsCount: number;
  isLoading: boolean;
  onOpenResetModal: () => void;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Navbar({
  page,
  setPage,
  userRole,
  assetsCount,
  isLoading,
  onOpenResetModal,
  onLogout,
  mobileMenuOpen,
  setMobileMenuOpen
}: NavbarProps) {
  return (
    <>
      <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl animate-pulse">🏭</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-extrabold tracking-tight text-white uppercase">
                  Ashok Leyland
                </h1>
                <span className="text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded">
                  Alwar Plant
                </span>
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center font-medium gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                Factory Telemetry Active {isLoading && <span className="text-slate-400 ml-1">(Syncing...)</span>}
              </p>
            </div>
          </div>

          {/* ── Desktop nav ── */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <button
              onClick={() => setPage('dashboard')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                page === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setPage('logs_sheet')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                page === 'logs_sheet' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              📊 Shift Logs
            </button>
            <button
              onClick={() => setPage('catalogue')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                page === 'catalogue' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              🌐 Assets ({isLoading ? "…" : assetsCount})
            </button>
            <button
              onClick={() => setPage('bom_inventory')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                page === 'bom_inventory' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              🔩 Tool Planner
            </button>
            {userRole === 'Technician' && (
              <button
                onClick={onOpenResetModal}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow transition-all ml-2 flex items-center gap-1"
              >
                🗑 Reset Data
              </button>
            )}
            <button
              onClick={onLogout}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition-all ml-2"
            >
              Exit
            </button>
          </nav>

          {/* ── Mobile hamburger ── */}
          <div className="flex md:hidden items-center gap-2">
            <span className="text-xs text-slate-400 font-medium capitalize">
              {page.replace('_', ' ').replace('bom inventory', 'Tool Planner')}
            </span>
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-all"
            >
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-down nav menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-1 animate-fadeIn z-40 relative">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: '🏠' },
            { id: 'logs_sheet' as const, label: 'Shift Logs', icon: '📊' },
            { id: 'catalogue' as const, label: `Assets (${assetsCount})`, icon: '🌐' },
            { id: 'bom_inventory' as const, label: 'Tool Planner', icon: '🔩' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setPage(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                page === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className="border-t border-slate-800 pt-2 space-y-1">
            {userRole === 'Technician' && (
              <button
                onClick={() => {
                  onOpenResetModal();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 text-amber-400 hover:bg-slate-800 transition-all"
              >
                🗑 Reset Data
              </button>
            )}
            <button
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3 text-rose-400 hover:bg-slate-800 transition-all"
            >
              🚪 Exit
            </button>
          </div>
        </div>
      )}
    </>
  );
}
