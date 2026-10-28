import React, { useState, useCallback, useContext } from 'react';
import { ref, push, child, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { LogEntry, AssetComponent } from '../types';
import { ToastContext } from '../context/AppContext';

interface UnifiedFiveStepFormProps {
  operator: string;
  shift: string;
  assets: AssetComponent[];
}

export function UnifiedFiveStepForm({ operator, shift, assets }: UnifiedFiveStepFormProps) {
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
    if (!validateForm()) {
      addToast("Please fix the errors before submitting.", "error");
      return;
    }
    let detailPacket: Record<string, unknown> = {};
    if (activeTab === 'Tools') detailPacket = { ...specTools };
    if (activeTab === 'Panels') detailPacket = { ...specPanels, temp: specPanels.temp ? `${specPanels.temp}°C` : '' };
    if (activeTab === 'UPS') detailPacket = { ...specUps };
    if (activeTab === 'TVs & Scanners') detailPacket = { ...specTvs };
    if (formStatus !== 'Working / Normal') {
      detailPacket.rootCause = issueFields.rootCause;
      detailPacket.actionDone = issueFields.actionDone;
    }
    const isPendingIssue = formStatus !== 'Working / Normal' && issueFields.resolutionState === 'Pending';
    const logKey = push(child(ref(db), 'logs')).key;
    if (!logKey) return;

    const payloadLog: LogEntry = {
      id: logKey,
      category: activeTab,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operator,
      shift,
      ipAddress: common.ipAddress.trim(),
      location: common.location.trim(),
      status: isPendingIssue ? 'Pending' : 'Normal',
      details: {
        toolName: common.toolName.trim(),
        deviceId: common.deviceId.trim(),
        line: common.line.trim(),
        reportedStatus: formStatus,
        ...detailPacket
      }
    };

    const updates: Record<string, unknown> = { [`/logs/${logKey}`]: payloadLog };
    if (isPendingIssue) {
      const matchedAsset = assets.find(a => a.ipAddress === common.ipAddress.trim());
      if (matchedAsset) updates[`/assets/${matchedAsset.id}/statusFlag`] = 'FAULT';
      const msgKey = push(child(ref(db), 'messages')).key;
      if (msgKey) {
        updates[`/messages/${msgKey}`] = {
          id: msgKey,
          type: 'alert',
          refLogId: logKey,
          sender: 'CRITICAL SYSTEM GATE',
          role: 'System',
          text: `🚨 [${formStatus.toUpperCase()}] Fault at ${common.location} (IP: ${common.ipAddress.trim()}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          resolved: false
        };
      }
    }

    update(ref(db), updates)
      .then(() => {
        addToast("Log saved successfully.", "success");
        setCommon({ toolName: '', deviceId: '', location: '', line: '', ipAddress: '' });
        setSpecTools({ problemDetail: '' });
        setSpecPanels({ temp: '', mcbUp: true, panelCleaned: false, exhaustFan: true });
        setSpecUps({ currentLoad: '', filterCleaned: false, coolingFan: true });
        setSpecTvs({ contentFeed: true, powerStatus: true });
        setFormStatus('Working / Normal');
        setIssueFields({ rootCause: '', actionDone: '', resolutionState: 'Pending' });
        setErrors({});
      })
      .catch(err => addToast(`Save failed: ${err.message}`, "error"));
  }, [validateForm, activeTab, specTools, specPanels, specUps, specTvs, formStatus, issueFields, operator, shift, common, assets, addToast]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Log Equipment Status</h3>
          <p className="text-[11px] text-slate-400">Ashok Leyland Maintenance Checklist</p>
        </div>
        <span className="text-xs bg-indigo-900/60 text-indigo-300 font-mono px-2.5 py-1 rounded-md border border-indigo-700/50">
          Shift {shift}
        </span>
      </div>

      <div className="bg-slate-50 p-2 flex border-b border-slate-200 gap-1">
        {['Tools', 'TVs & Scanners', 'UPS', 'Panels'].map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setErrors({}); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Step 1: Equipment Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Equipment Name</label>
              <input
                type="text"
                value={common.toolName}
                onChange={e => setCommon({ ...common, toolName: e.target.value })}
                maxLength={100}
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900"
                placeholder="e.g. WiFi DC Torque Wrench"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Device ID</label>
              <input
                type="text"
                value={common.deviceId}
                onChange={e => setCommon({ ...common, deviceId: e.target.value })}
                className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${
                  errors.deviceId ? 'border-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                }`}
                maxLength={20}
                placeholder="e.g. 2004"
              />
              {errors.deviceId && <p className="text-[10px] text-rose-600 mt-1">{errors.deviceId}</p>}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Stage Location *</label>
              <input
                type="text"
                value={common.location}
                onChange={e => setCommon({ ...common, location: e.target.value })}
                className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${
                  errors.location ? 'border-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                }`}
                maxLength={60}
                placeholder="e.g. Stage-12 Chassis Line"
              />
              {errors.location && <p className="text-[10px] text-rose-600 mt-1">{errors.location}</p>}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assembly Line</label>
              <input
                type="text"
                value={common.line}
                onChange={e => setCommon({ ...common, line: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900"
                maxLength={20}
                placeholder="e.g. Line 02"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">IP Address *</label>
              <input
                type="text"
                value={common.ipAddress}
                onChange={e => setCommon({ ...common, ipAddress: e.target.value })}
                className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none font-mono font-bold text-slate-900 ${
                  errors.ipAddress ? 'border-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                }`}
                maxLength={15}
                placeholder="e.g. 192.168.1.55"
              />
              {errors.ipAddress && <p className="text-[10px] text-rose-600 mt-1">{errors.ipAddress}</p>}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Step 2: Checklist — ({activeTab})</h4>
          {activeTab === 'Tools' && (
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Fault Description / Observations</label>
              <textarea
                value={specTools.problemDetail}
                onChange={e => setSpecTools({ ...specTools, problemDetail: e.target.value })}
                className="w-full h-20 p-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 text-slate-900 outline-none resize-none"
                placeholder="Describe tool symptoms, torque deviation, or error codes..."
              />
            </div>
          )}
          {activeTab === 'Panels' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Internal Temperature (°C)</label>
                <input
                  type="number"
                  value={specPanels.temp}
                  onChange={e => setSpecPanels({ ...specPanels, temp: e.target.value })}
                  className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${
                    errors.temp ? 'border-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                  placeholder="e.g. 42"
                />
                {errors.temp && <p className="text-[10px] text-rose-600 mt-1">{errors.temp}</p>}
              </div>
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specPanels.mcbUp}
                    onChange={e => setSpecPanels({ ...specPanels, mcbUp: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                  MCB is ON / Engaged
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specPanels.panelCleaned}
                    onChange={e => setSpecPanels({ ...specPanels, panelCleaned: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                  Panel Filter Cleaned
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specPanels.exhaustFan}
                    onChange={e => setSpecPanels({ ...specPanels, exhaustFan: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                  Exhaust Fan Running
                </label>
              </div>
            </div>
          )}
          {activeTab === 'UPS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Load (Amps)</label>
                <input
                  type="number"
                  value={specUps.currentLoad}
                  onChange={e => setSpecUps({ ...specUps, currentLoad: e.target.value })}
                  className={`w-full p-2.5 rounded-lg border focus:ring-1 outline-none text-slate-900 ${
                    errors.currentLoad ? 'border-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                  placeholder="e.g. 15"
                />
                {errors.currentLoad && <p className="text-[10px] text-rose-600 mt-1">{errors.currentLoad}</p>}
              </div>
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-center">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specUps.filterCleaned}
                    onChange={e => setSpecUps({ ...specUps, filterCleaned: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                  Air Intake Filter Cleaned
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specUps.coolingFan}
                    onChange={e => setSpecUps({ ...specUps, coolingFan: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                  Cooling Fan Operational
                </label>
              </div>
            </div>
          )}
          {activeTab === 'TVs & Scanners' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={specTvs.contentFeed}
                  onChange={e => setSpecTvs({ ...specTvs, contentFeed: e.target.checked })}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                Signal / Video Feed Normal
              </label>
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={specTvs.powerStatus}
                  onChange={e => setSpecTvs({ ...specTvs, powerStatus: e.target.checked })}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                Power Switch ON
              </label>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Step 3: Equipment Status</h4>
          <select
            value={formStatus}
            onChange={e => setFormStatus(e.target.value)}
            className={`w-full p-3 rounded-xl border font-bold text-xs outline-none transition-colors ${
              formStatus === 'Working / Normal' ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-rose-50 border-rose-300 text-rose-700'
            }`}
          >
            <option value="Working / Normal">✓ Working Normally</option>
            <option value="Need Maintenance">⚠️ Needs Maintenance</option>
            <option value="Fault Alert">🚨 Fault — System Down</option>
          </select>
        </div>

        {formStatus !== 'Working / Normal' && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-4 animate-fadeIn">
            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Step 4: Fault Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-rose-800 mb-1">Root Cause</label>
                <input
                  type="text"
                  value={issueFields.rootCause}
                  onChange={e => setIssueFields({ ...issueFields, rootCause: e.target.value })}
                  className="w-full p-2 rounded-lg border border-rose-200 focus:ring-1 focus:ring-rose-500 text-slate-900 outline-none"
                  maxLength={200}
                  placeholder="e.g. Overheated motor, connector pin bend"
                />
              </div>
              <div>
                <label className="block font-semibold text-rose-800 mb-1">Action Taken / Immediate Workaround</label>
                <input
                  type="text"
                  value={issueFields.actionDone}
                  onChange={e => setIssueFields({ ...issueFields, actionDone: e.target.value })}
                  className="w-full p-2 rounded-lg border border-rose-200 focus:ring-1 focus:ring-rose-500 text-slate-900 outline-none"
                  maxLength={200}
                  placeholder="e.g. Swapped with backup tool, stopped line"
                />
              </div>
            </div>
            <div className="border-t border-rose-100 pt-3">
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1.5">Step 5: Ticket Status</h4>
              <select
                value={issueFields.resolutionState}
                onChange={e => setIssueFields({ ...issueFields, resolutionState: e.target.value })}
                className="w-full p-2.5 bg-white rounded-lg border border-rose-200 font-bold text-xs text-slate-800 outline-none"
              >
                <option value="Pending">⏳ Keep Open — Alert Maintenance Crew</option>
                <option value="Resolved">✅ Already Fixed</option>
              </select>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={executeFormSubmit}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all transform active:scale-95 text-xs uppercase tracking-wider"
        >
          Submit Log Entry
        </button>
      </div>
    </div>
  );
}
