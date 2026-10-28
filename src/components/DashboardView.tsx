import React, { useMemo, useCallback, useContext } from 'react';
import { ref, push, child, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { LogEntry, AssetComponent, ChatMessage } from '../types';
import { ToastContext } from '../context/AppContext';
import { UnifiedFiveStepForm } from './UnifiedFiveStepForm';
import { IntercomChat } from './IntercomChat';
import {
  SAMPLE_PLANT_ASSETS,
  SAMPLE_PLANT_LOGS,
  SAMPLE_PLANT_MESSAGES,
  SAMPLE_PLANT_BOM
} from '../constants/demoPlantData';

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

  const handleSeedPlantData = useCallback(() => {
    const updates: Record<string, any> = {};
    SAMPLE_PLANT_ASSETS.forEach(a => {
      updates[`/assets/${a.id}`] = a;
    });
    SAMPLE_PLANT_LOGS.forEach(l => {
      updates[`/logs/${l.id}`] = l;
    });
    SAMPLE_PLANT_MESSAGES.forEach(m => {
      updates[`/messages/${m.id}`] = m;
    });
    updates['/toolMaterials'] = SAMPLE_PLANT_BOM;

    update(ref(db), updates)
      .then(() => addToast("Loaded Ashok Leyland Alwar Plant telemetry & BOM demo data.", "success"))
      .catch(err => addToast(`Load failed: ${err.message}`, "error"));
  }, [addToast]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── Demo Data Seeder Banner (shown if database is empty) ── */}
      {assets.length === 0 && logs.length === 0 && (
        <div className="bg-indigo-900 border border-indigo-700/80 rounded-2xl p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg animate-fadeIn">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2 text-indigo-200">
              <span>🏭</span> Ashok Leyland Plant Database is Clean
            </h4>
            <p className="text-xs text-indigo-300 mt-1 max-w-2xl">
              Populate the dashboard with authentic Alwar Assembly Line assets (torque wrenches, nutrunners, vision systems, Andons, shift logs, and vehicle BOM schedules).
            </p>
          </div>
          <button
            onClick={handleSeedPlantData}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition-all whitespace-nowrap"
          >
            ⚡ Load Plant Demo Data
          </button>
        </div>
      )}

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

      {/* ── MTTR Response Time Reduction Framework (Section 6 of Report) ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-400">
              Section 6 • Maintenance Engineering Architecture
            </span>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
              <span>⏱️</span> MTTR Reduction Chain: Traditional Delay vs Digital Automation
            </h3>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-md self-start sm:self-auto">
            Target: Eliminate Preventable Stoppage Delays
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-900/40">
            <span className="text-[10px] text-indigo-400 font-bold block mb-1">1. DETECTION</span>
            <p className="text-slate-200 font-semibold mb-1">Instant Telemetry Push</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Replaces unrecorded verbal discovery with instant status logging on shopfloor terminals.
            </p>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-900/40">
            <span className="text-[10px] text-indigo-400 font-bold block mb-1">2. NOTIFICATION</span>
            <p className="text-slate-200 font-semibold mb-1">Automated Team Alert</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Eliminates physical walking across the shopfloor. Alarms push directly to intercom & duty technician console.
            </p>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-900/40">
            <span className="text-[10px] text-indigo-400 font-bold block mb-1">3. DIAGNOSIS</span>
            <p className="text-slate-200 font-semibold mb-1">SOP Decision Tree</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Deterministic recovery steps for 6 machine types prevent trial-and-error delays on the line.
            </p>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-900/40">
            <span className="text-[10px] text-indigo-400 font-bold block mb-1">4. LOGISTICS</span>
            <p className="text-slate-200 font-semibold mb-1">BOM Tool Sweep</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Technicians verify required tools against the day's vehicle plan before the line starts, not during assembly.
            </p>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-900/40">
            <span className="text-[10px] text-indigo-400 font-bold block mb-1">5. VERIFICATION</span>
            <p className="text-slate-200 font-semibold mb-1">Audit-Stamped Closure</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              One-click resolution with technician signature prevents repeated reporting during shift handover.
            </p>
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
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>🛡️</span> All lines clear. Zero open maintenance incidents.
            </div>
            {assets.length > 0 && (
              <button
                onClick={handleSeedPlantData}
                className="text-[11px] text-indigo-600 font-bold underline hover:text-indigo-800"
              >
                Reload sample fault scenario
              </button>
            )}
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
