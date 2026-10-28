import React from 'react';

interface LoginViewProps {
  operator: string;
  setOperator: (val: string) => void;
  userRole: string;
  setUserRole: (val: string) => void;
  techPassword: string;
  setTechPassword: (val: string) => void;
  shift: string;
  setShift: (val: string) => void;
  date: string;
  setDate: (val: string) => void;
  onLogin: (e: React.FormEvent) => void;
}

export function LoginView({
  operator,
  setOperator,
  userRole,
  setUserRole,
  techPassword,
  setTechPassword,
  shift,
  setShift,
  date,
  setDate,
  onLogin
}: LoginViewProps) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-start sm:items-center justify-center p-3 sm:p-4 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="bg-white p-6 sm:p-8 rounded-2xl w-full max-w-md shadow-2xl border border-slate-800 transition-all">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">
            🏭
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-3 tracking-tight">
            Ashok Leyland Limited
          </h2>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mt-0.5">
            Alwar Assembly Plant • Maintenance Terminal
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Sign in to log equipment, view telemetry, or access the SOP bot
          </p>
        </div>

        <form onSubmit={onLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Operator / Technician Name
            </label>
            <input
              type="text"
              value={operator}
              onChange={e => setOperator(e.target.value)}
              maxLength={60}
              placeholder="e.g. Shreyansh Choudhary"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-900 text-sm placeholder:text-slate-400 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Station Role
            </label>
            <select
              value={userRole}
              onChange={e => {
                setUserRole(e.target.value);
                setTechPassword('');
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 text-slate-900 transition-all outline-none text-sm font-semibold"
            >
              <option value="Operator">👷 Line Operator</option>
              <option value="Technician">🔧 Maintenance Technician</option>
            </select>
          </div>

          {userRole === 'Technician' && (
            <div className="animate-fadeIn">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Technician Authorization Password
              </label>
              <input
                type="password"
                value={techPassword}
                onChange={e => setTechPassword(e.target.value)}
                placeholder="Enter technician key"
                className="w-full px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50/30 focus:ring-2 focus:ring-rose-500 text-slate-900 transition-all outline-none text-sm font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Plant Shift
              </label>
              <select
                value={shift}
                onChange={e => setShift(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 text-slate-900 transition-all outline-none text-sm font-semibold"
              >
                <option value="A">Shift A (Morning)</option>
                <option value="B">Shift B (Evening)</option>
                <option value="C">Shift C (Night)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-100 transition-all transform active:scale-95 text-xs uppercase tracking-wider mt-2"
          >
            Access Maintenance Console
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-mono">
            Digital Transformation Initiatives • Ashok Leyland Alwar
          </p>
        </div>
      </div>
    </div>
  );
}
