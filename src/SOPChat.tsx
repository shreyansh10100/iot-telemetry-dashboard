import React, { useState, useEffect, useRef } from 'react';

// Define the structure for our decision tree nodes
interface SOPNode {
  id: string;
  botMessage: string;
  options?: { text: string; nextNode: string }[];
  isHandoff?: boolean;
  isResolved?: boolean;
}

// Define the conversational decision tree
const SOP_TREE: Record<string, SOPNode> = {
  start: {
    id: 'start',
    botMessage: 'Hello! I am your SOP Diagnostic Bot. What kind of telemetry issue are you facing today?',
    options: [
      { text: 'Device is Offline / No Connection', nextNode: 'device_offline' },
      { text: 'Data Ingestion/Gap Errors', nextNode: 'data_gaps' },
      { text: 'Incorrect Sensor Readings', nextNode: 'bad_readings' },
      { text: 'Something else', nextNode: 'technician_handoff' }
    ]
  },
  device_offline: {
    id: 'device_offline',
    botMessage: 'Got it. First, check the physical hardware: Is the device status LED blinking green?',
    options: [
      { text: 'Yes, it is blinking green.', nextNode: 'net_check' },
      { text: 'No, it is solid red or off.', nextNode: 'power_cycle' }
    ]
  },
  power_cycle: {
    id: 'power_cycle',
    botMessage: 'SOP Step 1: Power cycle the device by disconnecting power for 10 seconds. Re-connect and wait 1 minute. Did it come back online?',
    options: [
      { text: 'Yes, it fixed it!', nextNode: 'resolved' },
      { text: 'No, still offline.', nextNode: 'technician_handoff' }
    ]
  },
  net_check: {
    id: 'net_check',
    botMessage: 'Green LED means basic power is OK. Let’s check local network. Is your MQTT broker/gateway reachable from your local subnet?',
    options: [
      { text: 'Yes, ping is successful.', nextNode: 'technician_handoff' },
      { text: 'No, gateway is unreachable.', nextNode: 'fix_gateway' }
    ]
  },
  fix_gateway: {
    id: 'fix_gateway',
    botMessage: 'SOP Step 2: Restart your local edge gateway and verify router DHCP configurations. Did this restore the telemetry stream?',
    options: [
      { text: 'Yes, stream restored.', nextNode: 'resolved' },
      { text: 'No, still failing.', nextNode: 'technician_handoff' }
    ]
  },
  data_gaps: {
    id: 'data_gaps',
    botMessage: 'Data gaps usually mean packet drops. Are you using UDP or MQTT/TCP for ingestion?',
    options: [
      { text: 'MQTT / TCP', nextNode: 'mqtt_buffer' },
      { text: 'UDP', nextNode: 'technician_handoff' }
    ]
  },
  mqtt_buffer: {
    id: 'mqtt_buffer',
    botMessage: 'SOP Step 3: Check your broker broker metrics. If QoS is set to 0, data will drop during network blips. Change client QoS to 1. Did that resolve the gap?',
    options: [
      { text: 'Yes, fixed!', nextNode: 'resolved' },
      { text: 'No, still dropping packets.', nextNode: 'technician_handoff' }
    ]
  },
  bad_readings: {
    id: 'bad_readings',
    botMessage: 'Are the values completely static (frozen) or wildly fluctuating out of normal bounds?',
    options: [
      { text: 'Completely static/frozen', nextNode: 'sensor_freeze' },
      { text: 'Wildly fluctuating', nextNode: 'technician_handoff' }
    ]
  },
  sensor_freeze: {
    id: 'sensor_freeze',
    botMessage: 'SOP Step 4: A frozen value implies an unhandled I2C/SPI bus crash. Send a hardware soft-reset command `0xFE` via terminal. Did the sensor reset?',
    options: [
      { text: 'Yes, it reset and reads normally.', nextNode: 'resolved' },
      { text: 'No response.', nextNode: 'technician_handoff' }
    ]
  },
  technician_handoff: {
    id: 'technician_handoff',
    botMessage: '🚨 This looks like a new or complex issue outside standard SOP protocols. I have flagged this run and notified our on-duty technicians.',
    isHandoff: true
  },
  resolved: {
    id: 'resolved',
    botMessage: 'Awesome! Glad the SOP steps could resolve your issue. Let me know if you need anything else.',
    isResolved: true
  }
};

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
}

export default function SOPChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string>('start');
  const [history, setHistory] = useState<Message[]>([
    { id: 'init', sender: 'bot', text: SOP_TREE.start.botMessage }
  ]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleOptionClick = (option: { text: string; nextNode: string }) => {
    const nextNode = SOP_TREE[option.nextNode];
    if (!nextNode) return;

    // Append user's choice to history, then append bot's response
    setHistory((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: option.text },
      { id: `bot-${Date.now()}`, sender: 'bot', text: nextNode.botMessage }
    ]);

    setCurrentNodeId(option.nextNode);

    // If it's a technician handoff, trigger background alerts here
    if (nextNode.isHandoff) {
      triggerTechnicianAlert(option.text);
    }
  };

  const triggerTechnicianAlert = (lastUserAction: string) => {
    console.warn(`[ALERT] Handoff initiated. Routing system logs to technicans. Reason context: ${lastUserAction}`);
    // You could make an API POST call to your backend/Slack webhook here
  };

  const resetChat = () => {
    setCurrentNodeId('start');
    setHistory([{ id: 'init', sender: 'bot', text: SOP_TREE.start.botMessage }]);
  };

  const currentNode = SOP_TREE[currentNodeId];

  return (
    <div className="fixed bottom-6 left-6 z-[9999] font-sans">
      {/* Toggle Floating Action Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-xl font-bold text-sm transition-transform duration-200 hover:scale-105"
      >
        <span>🤖</span> {isOpen ? 'Close Assistant' : 'SOP Troubleshooting'}
      </button>

      {/* Chat Window Container */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 w-80 sm:w-96 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideIn">
          
          {/* Header */}
          <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-white text-sm font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                SOP Core Assistant
              </h3>
              <p className="text-slate-400 text-[11px]">Automated Telemetry Dispatch</p>
            </div>
            {(currentNode.isHandoff || currentNode.isResolved) && (
              <button 
                onClick={resetChat} 
                className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-2 py-1 rounded"
              >
                Restart
              </button>
            )}
          </div>

          {/* Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {history.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`p-3 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Options / Action Choices Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 max-h-[160px] overflow-y-auto">
            {currentNode.options && currentNode.options.length > 0 ? (
              <div className="flex flex-col gap-2">
                {currentNode.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(opt)}
                    className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  >
                    👉 {opt.text}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-[11px] text-slate-500 italic">
                {currentNode.isHandoff ? '⚠️ Support ticket created.' : '✅ Diagnostic cycle completed.'}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
