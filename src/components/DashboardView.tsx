import React, { useMemo, useCallback, useContext } from 'react';
import { ref, push, child, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { LogEntry, AssetComponent, ChatMessage } from '../types';
import { ToastContext } from '../context/AppContext';
import { UnifiedFiveStepForm } from './UnifiedFiveStepForm';
import { IntercomChat } from './IntercomChat';

interface DashboardViewProps {
  logs: LogEntry[];
  assets: AssetComponent[];
  messages: ChatMessage[];
  operator: string;
  userRole: string;
  shift: string;
}

export function DashboardView({
  logs,
  assets,
  messages,
  operator,
  userRole,
  shift
}: DashboardViewProps) {
  const { addToast } = useContext(ToastContext);

  const pendingIncidents = useMemo(() => logs.filter(l => l.status === 'Pending'), [logs]);

  const errorDataCounts = useMemo(
    () =>
      logs.reduce(
        (acc, curr) => {
          if (curr.status === 'Pending') {
            acc[curr.category] = (acc[curr.category] || 0) + 1;
          }
          return acc;
        },
        { "Tools": 0, "TVs & Scanners": 0, "UPS": 0, "Panels": 0 } as Record<string, number>
      ),
    [logs]
  );

  const resolveGlobalIssue = useCallback(
    (logId: string) => {
      if (userRole !== 'Technician') {
        addToast("🔒 Only Technicians can resolve incidents.", "error");
        return;
      }
      const matchedLog = logs.find(l => l.id === logId);
      if (!matchedLog) return;

      const updates: Record<string, string | boolean> = { [`/logs/${logId}/status`]: 'Fixed' };
      const matchedAsset = assets.find(a => a.ipAddress === matchedLog.ipAddress);
      if (matchedAsset) {
        updates[`/assets/${matchedAsset.id}/statusFlag`] = 'OK';
      }
      messages.forEach(m => {
        if (m.refLogId === logId) updates[`/messages/${m.id}/resolved`] = true;
      });

      const sysMsgKey = push(child(ref(db), 'messages')).key;
      if (sysMsgKey) {
        updates[`/messages/${sysMsgKey}`] = {
          id: sysMsgKey,
          type: 'system',
          sender: 'MAINTENANCE CONTROL',
          role: 'System',
          text: `✅ Fault cleared on IP ${matchedLog.ipAddress} (${matchedLog.location}) by Technician ${operator}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } as any;
      }

      update(ref(db), updates)
        .then(() => addToast("Incident marked resolved and line status cleared.", "success"))
        .catch(err => addToast(`Error: ${err.message}`, "error"));
    },
    [userRole, logs, assets, messages, operator, addToast]
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Alarms</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{pendingIncidents.length}</h3>
          </div>
          <span
            className={`p-3 rounded-xl font-bold text-xl ${
              pendingIncidents.length > 0 ? 'bg-rose-50 text-rose-600 animate-bounce' : 'bg-slate-50 text-slate-400'
            }`}
          >
            🚨
          </span>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Line Assets</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{assets.length}</h3>
          </div>
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xl">🌐</span>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Station</p>
            <h3 className="text-base font-bold text-slate-900 truncate mt-1 max-w-[150px]">{operator}</h3>
            <p className="text-xs text-slate-400 font-medium">{userRole} • Shift {shift}</p>
          </div>
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
                  <div
                    className="w-6 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t transition-all duration-500 shadow-sm"
                    style={{ height: `${Math.max(heightPct, 8)}%` }}
                  />
                  <span className="text-[9px] font-bold text-slate-400 truncate w-12 text-center mt-1">
                    {cat === 'TVs & Scanners' ? 'TV/Scan' : cat}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Open Incidents Wall ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-rose-600 uppercase tracking-wider flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          Active Shopfloor Incidents ({pendingIncidents.length})
        </h3>
        {pendingIncidents.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span>🛡️</span> All lines clear. Zero open maintenance incidents.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pendingIncidents.map(issue => (
              <div
                key={issue.id}
                className="bg-rose-50/50 border border-rose-200 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                    <span className="font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md uppercase">
                      {issue.category}
                    </span>
                    <span className="text-slate-500 font-medium">
                      By: {issue.operator} (Shift {issue.shift})
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium">
                    <strong>IP:</strong>{' '}
                    <code className="bg-white border border-rose-200 px-1.5 py-0.5 rounded font-mono text-rose-600 font-bold">
                      {issue.ipAddress}
                    </code>
                  </p>
                  <p className="text-slate-700">
                    <strong>Stage:</strong> {issue.location}
                  </p>
                  <div className="bg-white p-2.5 rounded-lg border border-rose-100 font-semibold text-rose-700 text-xs mt-2">
                    ⚠️ {issue.details?.reportedStatus}:{' '}
                    {issue.details?.problemDetail || issue.details?.rootCause || 'Diagnostics pending'}
                  </div>
                </div>
                <div className="p-3 bg-rose-100/50 border-t border-rose-200">
                  {userRole === 'Technician' ? (
                    <button
                      onClick={() => resolveGlobalIssue(issue.id)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-sm"
                    >
                      ✓ Mark as Resolved
                    </button>
                  ) : (
                    <div className="text-center text-[11px] font-bold text-rose-500 bg-white/80 py-1.5 border border-rose-200 rounded-lg">
                      🔒 Waiting for Technician Resolution
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main Two-Column Layout: Form & Intercom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-7">
          <UnifiedFiveStepForm operator={operator} shift={shift} assets={assets} />
        </div>
        <div className="lg:col-span-5">
          <IntercomChat
            messages={messages}
            operator={operator}
            userRole={userRole}
            shift={shift}
            onResolve={resolveGlobalIssue}
          />
        </div>
      </div>
    </div>
  );
}
