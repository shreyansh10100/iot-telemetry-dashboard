import React, { useState, useMemo, useCallback } from 'react';
import { LogEntry } from '../types';

interface LogsSheetViewProps {
  logs: LogEntry[];
}

export function LogsSheetView({ logs }: LogsSheetViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const processedLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        log.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ipAddress.includes(searchTerm) ||
        (log.details?.toolName || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch && (categoryFilter === 'ALL' || log.category === categoryFilter);
    });
  }, [logs, searchTerm, categoryFilter]);

  const triggerCSVExport = useCallback(() => {
    if (!logs || logs.length === 0) return;
    const headers = [
      "Timestamp",
      "Category",
      "IP Address",
      "Location",
      "Line",
      "Operator",
      "Shift",
      "Status",
      "Tool Name",
      "Device ID",
      "Root Cause",
      "Action Done",
      "Problem Detail",
      "Temperature",
      "MCB Status",
      "Panel Cleaned",
      "Exhaust Status",
      "Current Load"
    ];
    const csvRows = [
      headers.join(","),
      ...logs.map(log =>
        [
          `"${log.timestamp || ''}"`,
          `"${log.category || ''}"`,
          `"${log.ipAddress || ''}"`,
          `"${log.location || ''}"`,
          `"${log.details?.line || ''}"`,
          `"${log.operator || ''}"`,
          `"${log.shift || ''}"`,
          `"${log.status || ''}"`,
          `"${log.details?.toolName || ''}"`,
          `"${log.details?.deviceId || ''}"`,
          `"${(log.details?.rootCause || '').replace(/"/g, '""')}"`,
          `"${(log.details?.actionDone || '').replace(/"/g, '""')}"`,
          `"${(log.details?.problemDetail || '').replace(/"/g, '""')}"`,
          `"${log.details?.temp || ''}"`,
          `"${log.details?.mcbUp !== undefined ? (log.details.mcbUp ? 'ON' : 'OFF') : ''}"`,
          `"${log.details?.panelCleaned !== undefined ? (log.details.panelCleaned ? 'Yes' : 'No') : ''}"`,
          `"${log.details?.exhaustFan !== undefined ? (log.details.exhaustFan ? 'Active' : 'Inactive') : ''}"`,
          `"${log.details?.currentLoad || ''}"`
        ].join(",")
      )
    ];
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `Ashok_Leyland_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [logs]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">Shift Log & Audit History</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete digital audit trail of equipment check-ins, fault reports, and maintenance resolutions.
          </p>
        </div>
        <button
          onClick={triggerCSVExport}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
        >
          📥 Export 18-Column CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Search Records</label>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by IP, location, device name..."
            className="w-full text-xs p-2 rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filter by Category</label>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full text-xs p-2 bg-white rounded-lg border border-slate-300 outline-none text-slate-900"
          >
            <option value="ALL">All Categories</option>
            <option value="Tools">Tools</option>
            <option value="TVs & Scanners">TVs & Scanners</option>
            <option value="UPS">UPS</option>
            <option value="Panels">Panels</option>
          </select>
        </div>
        <div className="flex items-end justify-end text-xs font-bold text-slate-400 pb-2">
          Showing {processedLogs.length} matching entries
        </div>
      </div>

      {/* ── Mobile card list ── */}
      <div className="md:hidden space-y-3">
        {processedLogs.length === 0 ? (
          <p className="text-center text-slate-400 italic text-xs py-6">No logs match your search.</p>
        ) : (
          processedLogs.map(l => (
            <div key={l.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-500">{l.timestamp}</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                    l.status === 'Pending'
                      ? 'bg-rose-100 text-rose-700'
                      : l.status === 'Fixed'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {l.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <span className="text-slate-400 font-semibold">Category</span>
                <span className="font-bold uppercase">{l.category}</span>
                <span className="text-slate-400 font-semibold">IP</span>
                <span className="font-mono text-indigo-600 font-bold">{l.ipAddress}</span>
                <span className="text-slate-400 font-semibold">Location</span>
                <span className="font-semibold">{l.location}</span>
                <span className="text-slate-400 font-semibold">Operator</span>
                <span>
                  {l.operator} · Shift {l.shift}
                </span>
              </div>
              {l.details?.rootCause && (
                <div className="bg-white border border-rose-100 rounded-lg p-2 text-[11px]">
                  <p>
                    <strong className="text-rose-600">Cause:</strong> {l.details.rootCause}
                  </p>
                  <p>
                    <strong>Action:</strong> {l.details.actionDone}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
              <th className="p-3.5">Time</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">IP / ID</th>
              <th className="p-3.5">Location</th>
              <th className="p-3.5">Operator</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {processedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                  No logs match your search.
                </td>
              </tr>
            ) : (
              processedLogs.map((l, idx) => (
                <tr key={l.id} className={idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                  <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono font-bold">{l.timestamp}</td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                      {l.category}
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap font-mono text-indigo-600 font-bold">
                    {l.ipAddress}
                    <br />
                    <span className="text-[10px] text-slate-400 font-sans">ID: {l.details?.deviceId || '—'}</span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap font-semibold">
                    {l.location}
                    <br />
                    <span className="text-[10px] text-slate-400">Line: {l.details?.line || 'N/A'}</span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    {l.operator}
                    <br />
                    <span className="text-[10px] text-slate-400 font-bold">Shift {l.shift}</span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                        l.status === 'Pending'
                          ? 'bg-rose-100 text-rose-700'
                          : l.status === 'Fixed'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="p-3.5 max-w-xs truncate text-[11px]">
                    {l.details?.rootCause ? (
                      <div>
                        <p>
                          <strong className="text-rose-600">Cause:</strong> {l.details.rootCause}
                        </p>
                        <p>
                          <strong>Action:</strong> {l.details.actionDone}
                        </p>
                      </div>
                    ) : (
                      <span className="italic text-slate-400">Regular check-in (Normal)</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
