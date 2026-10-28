import React, { memo } from 'react';
import { ToastMessage } from '../types';

export const ToastContainer = memo(function ToastContainer({
  toasts
}: {
  toasts: ToastMessage[];
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`p-4 rounded-xl shadow-lg border text-xs font-bold pointer-events-auto flex items-center gap-2 animate-slideIn ${
            t.type === 'success'
              ? 'bg-slate-900 border-slate-800 text-emerald-400'
              : t.type === 'error'
              ? 'bg-rose-600 border-rose-700 text-white'
              : 'bg-indigo-600 border-indigo-700 text-white'
          }`}
        >
          <span>{t.type === 'success' ? '✓' : '⚠️'}</span>
          <p className="flex-1">{t.text}</p>
        </div>
      ))}
    </div>
  );
});
