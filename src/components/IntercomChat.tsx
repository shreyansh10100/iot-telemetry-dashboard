import React, { useState, useCallback } from 'react';
import { ref, push, child, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { ChatMessage } from '../types';
import { SopBotWidget } from './SopBotWidget';
import { compressAndEncodeImage } from '../utils/helpers';

interface IntercomChatProps {
  messages: ChatMessage[];
  operator: string;
  userRole: string;
  shift: string;
  onResolve: (id: string) => void;
}

export function IntercomChat({
  messages,
  operator,
  userRole,
  shift,
  onResolve
}: IntercomChatProps) {
  const [input, setInput] = useState('');
  const [showBot, setShowBot] = useState(false);

  const submitChat = useCallback(
    (e: React.FormEvent | null, customText?: string, base64Image?: string) => {
      if (e) e.preventDefault();
      const finalMessageText = customText || input.trim();
      if (!finalMessageText && !base64Image) return;
      const msgKey = push(child(ref(db), 'messages')).key;
      if (!msgKey) return;

      const newChat: ChatMessage = {
        id: msgKey,
        type: 'manual',
        sender: operator,
        role: userRole,
        shift,
        text: finalMessageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...(base64Image && { image: base64Image })
      };

      set(ref(db, `messages/${msgKey}`), newChat);
      if (!customText) setInput('');
    },
    [input, operator, userRole, shift]
  );

  const handleBotEscalate = useCallback(
    (payload: { device: string; issueDetails: string }) => {
      const msgKey = push(child(ref(db), 'messages')).key;
      if (!msgKey) return;
      set(ref(db, `messages/${msgKey}`), {
        id: msgKey,
        type: 'alert',
        sender: `BOT / ${payload.device}`,
        role: 'System',
        text: `🚨 ESCALATION: ${payload.issueDetails} reported by Operator ${operator}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resolved: false
      });
    },
    [operator]
  );

  const handleBotResolve = useCallback(
    (payload: { device: string; issueDetails: string }) => {
      const msgKey = push(child(ref(db), 'messages')).key;
      if (!msgKey) return;
      set(ref(db, `messages/${msgKey}`), {
        id: msgKey,
        type: 'system',
        sender: 'SOP ASSISTANT',
        role: 'System',
        text: `✅ SOP Resolved: Operator ${operator} fixed ${payload.device} (${payload.issueDetails}).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    },
    [operator]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[500px] md:h-[650px]">
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>💬</span> Cross-Shift Intercom
        </h4>
        <button
          onClick={() => setShowBot(!showBot)}
          className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all ${
            showBot
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700'
          }`}
        >
          {showBot ? "Hide SOP Bot" : "🤖 Open SOP Bot"}
        </button>
      </div>

      {showBot && (
        <div className="p-3 bg-slate-900 border-b border-slate-800 animate-fadeIn overflow-y-auto max-h-[320px]">
          <SopBotWidget
            operatorContext={{ name: operator }}
            onEscalate={handleBotEscalate}
            onResolve={handleBotResolve}
          />
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 font-medium text-xs mt-12 italic">
            No shift broadcast messages yet.
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-3 rounded-xl border transition-all text-xs ${
              msg.type === 'alert'
                ? msg.resolved
                  ? 'bg-emerald-50/70 border-emerald-200 text-slate-700'
                  : 'bg-rose-50 border-rose-200 shadow-sm animate-pulse text-slate-800'
                : msg.type === 'system'
                ? 'bg-slate-100 border-slate-200 text-slate-600 italic'
                : 'bg-white border-slate-200 shadow-sm text-slate-800'
            } ${
              msg.role === 'Technician'
                ? 'border-l-4 border-l-amber-500'
                : msg.role === 'Operator'
                ? 'border-l-4 border-l-indigo-500'
                : ''
            }`}
          >
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-1">
              <span>
                {msg.role === 'Technician' ? '🔧 ' : msg.role === 'Operator' ? '👷 ' : '🤖 '}
                {msg.sender} {msg.shift ? `[Shift ${msg.shift}]` : ''}
              </span>
              <span>{msg.timestamp}</span>
            </div>
            <p className={`${msg.type === 'alert' && !msg.resolved ? 'font-bold text-rose-700' : 'font-medium'}`}>
              {msg.text}
            </p>
            {msg.image && (
              <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-black max-w-xs">
                <img
                  src={msg.image}
                  alt="upload"
                  className="w-full object-contain max-h-40 cursor-pointer"
                  onClick={() => {
                    if (msg.image?.startsWith('data:image/')) window.open(msg.image);
                  }}
                />
              </div>
            )}
            {msg.type === 'alert' && !msg.resolved && (
              <div className="mt-3 border-t border-rose-200/60 pt-2">
                {userRole === 'Technician' ? (
                  <button
                    onClick={() => onResolve(msg.refLogId!)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold py-1.5 px-2 rounded-md text-[11px] transition-all shadow-sm"
                  >
                    ⚡ Resolve This Alarm
                  </button>
                ) : (
                  <span className="text-[10px] text-rose-500 font-bold bg-white px-2 py-0.5 rounded border border-rose-200 inline-block">
                    🔒 Technician access required to clear
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={e => submitChat(e)} className="p-3 border-t border-slate-200 bg-white flex gap-2 items-center">
        <label className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer transition-all border border-slate-300">
          📷
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              if (e.target.files?.[0]) {
                try {
                  const b64 = await compressAndEncodeImage(e.target.files[0], 500);
                  submitChat(null, "[Plant Image Attachment]", b64);
                } catch {
                  alert("Upload failed.");
                }
              }
            }}
          />
        </label>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={500}
          placeholder="Broadcast note to maintenance team..."
          className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs tracking-wider transition-all"
        >
          Send
        </button>
      </form>
    </div>
  );
}
