import React, { useState, useCallback, useContext, memo } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { ToastContext } from '../context/AppContext';
import { DEEP_SOP_MATRIX } from '../constants/sopMatrix';

interface SopBotWidgetProps {
  operatorContext: { name: string };
  onEscalate: (payload: { device: string; issueDetails: string }) => void;
  onResolve: (payload: { device: string; issueDetails: string }) => void;
}

export const SopBotWidget = memo(function SopBotWidget({
  operatorContext,
  onEscalate,
  onResolve
}: SopBotWidgetProps) {
  const { addToast } = useContext(ToastContext);
  const [step, setStep] = useState<'category' | 'issue' | 'sop_display' | 'new_issue_input' | 'complete'>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIssue, setSelectedIssue] = useState('');
  const [customIssueText, setCustomIssueText] = useState('');

  const handleClearIssue = useCallback(async (modelId: string, issueField: string) => {
    try {
      const sanitizedModelId = modelId.replace(/[^a-zA-Z0-9-_]/g, "_");
      await update(ref(db, `telemetry/machines/${sanitizedModelId}`), {
        [issueField]: issueField === 'filterCleaned' || issueField === 'panelCleaned' ? true : 0,
        status: "Operational",
        lastClearedTimestamp: Date.now(),
        operatorSignature: operatorContext.name
      });
      onResolve({ device: selectedCategory, issueDetails: selectedIssue });
      addToast("Issue cleared successfully.", "success");
      setStep('complete');
    } catch {
      addToast("Sync failed. Check network.", "error");
    }
  }, [operatorContext.name, selectedCategory, selectedIssue, onResolve, addToast]);

  const handleNewIssueSubmit = useCallback(() => {
    if (!customIssueText.trim()) {
      addToast("Please describe the issue.", "error");
      return;
    }
    onEscalate({
      device: selectedCategory,
      issueDetails: `Emergency ticket: "${customIssueText.trim()}"`
    });
    setStep('complete');
  }, [customIssueText, selectedCategory, onEscalate, addToast]);

  return (
    <div className="bg-slate-950 rounded-xl border border-indigo-500/30 p-4 shadow-xl text-slate-200 text-xs w-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-bold text-indigo-400 tracking-wide text-[11px] uppercase">
          SOP Diagnostic Assistant
        </span>
      </div>

      {step === 'category' && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400 font-medium">Select the machine or equipment:</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {Object.keys(DEEP_SOP_MATRIX).map(catKey => (
              <button
                key={catKey}
                type="button"
                onClick={() => { setSelectedCategory(catKey); setStep('issue'); }}
                className="w-full text-left bg-slate-900 hover:bg-slate-800 px-2.5 py-2 rounded-lg border border-slate-800 font-bold text-[11px] flex items-center gap-2 truncate transition-colors"
              >
                <span>{DEEP_SOP_MATRIX[catKey].icon}</span>
                <span className="truncate">{catKey}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'issue' && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">What issue are you observing on {selectedCategory}?</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {Object.keys(DEEP_SOP_MATRIX[selectedCategory]?.issues || {}).map(issueKey => (
              <button
                key={issueKey}
                type="button"
                onClick={() => { setSelectedIssue(issueKey); setStep('sop_display'); }}
                className="w-full text-left bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded border border-slate-800 text-slate-300 text-[11px] transition-colors"
              >
                ▪ {issueKey}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStep('new_issue_input')}
              className="w-full text-left bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 px-3 py-1.5 rounded border border-indigo-900/50 font-bold text-[11px] transition-colors"
            >
              + New Issue (Not in standard SOP)
            </button>
          </div>
          <button
            onClick={() => setStep('category')}
            className="text-[10px] text-slate-500 font-semibold underline block mt-2"
          >
            ← Back to Equipment List
          </button>
        </div>
      )}

      {step === 'sop_display' && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-amber-400 font-bold text-[11px]">
              <span>🔧 Standard Recovery Procedure</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded font-mono text-slate-400 uppercase">
                SOP Steps
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px] bg-slate-950 p-2.5 rounded">
              {DEEP_SOP_MATRIX[selectedCategory]?.issues[selectedIssue]?.text}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleClearIssue(selectedCategory, DEEP_SOP_MATRIX[selectedCategory].issues[selectedIssue].field)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-lg text-[11px] tracking-wide transition-all shadow-md"
          >
            ✅ Issue Fixed — Mark Resolved
          </button>
          <button
            onClick={() => setStep('issue')}
            className="text-[10px] text-slate-500 font-semibold underline block"
          >
            ← Back
          </button>
        </div>
      )}

      {step === 'new_issue_input' && (
        <div className="space-y-3">
          <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-lg text-[11px] text-rose-300 font-medium">
            ⚠️ Issue not in SOP. An urgent alert ticket will be broadcasted to the duty technician.
          </div>
          <input
            type="text"
            value={customIssueText}
            onChange={e => setCustomIssueText(e.target.value)}
            maxLength={300}
            placeholder="Describe the fault or symptom in detail..."
            className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('issue')}
              className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNewIssueSubmit}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs"
            >
              Send Alert to Technician
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center py-3 space-y-2 animate-fadeIn">
          <span className="text-2xl block">⚡</span>
          <p className="text-[11px] text-emerald-400 font-bold">Done! Action logged and status updated.</p>
          <button
            type="button"
            onClick={() => {
              setStep('category');
              setSelectedCategory('');
              setSelectedIssue('');
              setCustomIssueText('');
            }}
            className="text-[11px] text-indigo-400 font-bold underline block mx-auto"
          >
            Diagnose Another Tool
          </button>
        </div>
      )}
    </div>
  );
});
