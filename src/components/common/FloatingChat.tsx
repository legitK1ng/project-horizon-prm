/**
 * Horizon AI — Floating Chat Window
 * Premium Enterprise Intelligence Interface
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { 
  MessageCircle, 
  X, 
  Minimize2, 
  Bot, 
  Trash2, 
  Zap,
  Activity,
  Cpu,
  Mic,
  Terminal,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/utils/ui';
import { api } from '@/services/apiClient';
import { useUiStore } from '@/store/appStore';
import { triggerHaptic } from '@/utils/haptics';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'ai',
  text: "Neural link established. I'm your Relationship Intelligence Engine. How can I assist with your network strategy today?",
  timestamp: new Date(),
};

const SUGGESTED_PROMPTS = [
  "Relationship Health Audit",
  "Summarize Recent Transcripts",
  "Next Best Actions",
  "Network Growth Projections"
];

const MIN_WIDTH  = 340;
const MAX_WIDTH  = 680;
const MIN_HEIGHT = 450;
const MAX_HEIGHT = 850;

const NeuralBackground: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-30">
    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <motion.path
        d="M0,50 Q25,30 50,50 T100,50"
        fill="none"
        stroke="url(#neural-gradient)"
        strokeWidth="0.2"
        animate={{
          d: [
            "M0,50 Q25,30 50,50 T100,50",
            "M0,50 Q25,70 50,50 T100,50",
            "M0,50 Q25,30 50,50 T100,50"
          ]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" } as const}
      />
      <defs>
        <linearGradient id="neural-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const FloatingChat: React.FC = () => {
  const {
    chatOpen, setChatOpen,
    chatWidth, chatHeight, setChatSize,
    chatPosition, setChatPosition,
  } = useUiStore();

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText]  = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Drag control
  const dragControls = useDragControls();

  // Resize state
  const [resizing, setResizing]   = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, w: chatWidth, h: chatHeight });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Focus when opened
  useEffect(() => {
    if (chatOpen) {
      triggerHaptic('MEDIUM');
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [chatOpen]);

  // Handle Resize
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStart.current = { x: e.clientX, y: e.clientY, w: chatWidth, h: chatHeight };
    setResizing(true);
    triggerHaptic('LIGHT');
  }, [chatWidth, chatHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const newW = Math.min(MAX_WIDTH,  Math.max(MIN_WIDTH,  resizeStart.current.w + dx));
        const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStart.current.h + dy));
        setChatSize(newW, newH);
      }
    };
    const onUp = () => { 
      if (resizing) triggerHaptic('LIGHT');
      setResizing(false); 
    };

    if (resizing) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, setChatSize]);

  // ── Messaging ───────────────────────────────────────────────────────────────
  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || inputText).trim();
    if (!text || isThinking) return;

    triggerHaptic('MEDIUM');
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInputText('');
    setIsThinking(true);

    try {
      const data = await api.aiChat(text);
      triggerHaptic('LIGHT');
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'ai', text: data.message, timestamp: new Date() },
      ]);
    } catch (error: any) {
      triggerHaptic('HEAVY');
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          text: `SIGNAL_INTERRUPTED: ${error.message || "Uplink to intelligence engine lost."}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleListening = () => {
    triggerHaptic('HEAVY');
    setIsListening(!isListening);
    if (!isListening) {
      // Simulation: After 2 seconds, "transcribe" something
      setTimeout(() => {
        setIsListening(false);
        triggerHaptic('LIGHT');
      }, 3000);
    }
  };

  const clearChat = () => {
    triggerHaptic('MEDIUM');
    if (window.confirm('PURGE_HISTORY: Are you sure you want to clear the conversation?')) {
      setMessages([INITIAL_MESSAGE]);
      triggerHaptic('LIGHT');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    }
  };

  // Initialize Position
  useEffect(() => {
    if (chatPosition.x === 0 && chatPosition.y === 0) {
      const initX = window.innerWidth - chatWidth - 24; // 24px = 1.5rem
      const initY = window.innerHeight - chatHeight - 24;
      setChatPosition({ x: Math.max(0, initX), y: Math.max(0, initY) });
    }
  }, []);

  return (
    <div
      className={cn('fixed inset-0 pointer-events-none z-[9999] overflow-hidden', resizing ? 'cursor-nw-resize' : '')}
    >
      <AnimatePresence mode="wait">
        {chatOpen ? (
          /* ── EXPANDED CHAT WINDOW ── */
          <motion.div
            key="chat-window"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              setChatPosition({ x: info.point.x, y: info.point.y });
            }}
            initial={{ opacity: 0, scale: 0.9, y: chatPosition.y + 20, x: chatPosition.x, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: chatPosition.y, x: chatPosition.x, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, y: chatPosition.y + 20, x: chatPosition.x, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 } as const}
            style={{ width: chatWidth, height: chatHeight }}
            className="absolute pointer-events-auto glass-premium rounded-[2.5rem] shadow-2xl-premium flex flex-col overflow-hidden border border-white/10"
          >
            {/* 📡 Neural & Scanline Layer */}
            <NeuralBackground />
            <div className="scanline" />
            
            {/* Telemetry Bar */}
            <div className="h-6 bg-blue-500/10 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0 z-[60]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-black text-emerald-500/80 uppercase tracking-widest">Secure_Link</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity size={8} className="text-blue-500" />
                  <span className="text-[8px] font-black text-blue-500/80 uppercase tracking-widest">Load: 12.4%</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest italic">HZN_v2.0_PRM</span>
                <ShieldCheck size={10} className="text-white/20" />
              </div>
            </div>

            {/* Header — drag handle */}
            <div
              className="flex items-center justify-between px-6 py-5 bg-white/5 border-b border-white/10 cursor-grab active:cursor-grabbing flex-shrink-0 z-[55] backdrop-blur-xl"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-11 h-11 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-glow-blue overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-transparent animate-pulse" />
                    <Bot size={24} className="text-blue-500 relative z-10" />
                  </div>
                  <motion.div 
                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-glow-emerald flex items-center justify-center"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity } as const}
                  >
                    <div className="w-1 h-1 bg-white rounded-full" />
                  </motion.div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-[0.2em] italic">Horizon_Engine</p>
                    <span className="text-[9px] bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded font-black tracking-widest">PRO</span>
                  </div>
                  <p className="text-blue-500/60 text-[9px] font-bold uppercase tracking-widest mt-0.5">Strategic intelligence layer active</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={clearChat} 
                  className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-red-400 transition-all group" 
                  title="Purge Memory"
                >
                  <Trash2 size={16} className="group-hover:rotate-12" />
                </button>
                <button 
                  onClick={() => { triggerHaptic('LIGHT'); setChatOpen(false); }} 
                  className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-blue-500 transition-all" 
                  title="Minimize"
                >
                  <Minimize2 size={16} />
                </button>
                <button 
                  onClick={() => { triggerHaptic('MEDIUM'); setChatOpen(false); }} 
                  className="p-2.5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all" 
                  title="Terminate"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 luxury-scroll bg-black/10">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn('flex group', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'ai' && (
                    <div className="w-10 h-10 bg-blue-600/10 rounded-2xl flex items-center justify-center flex-shrink-0 mr-3 mt-1 border border-white/10 shadow-inner group-hover:rotate-6 transition-transform">
                      <Cpu size={18} className="text-blue-500" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] px-6 py-4 rounded-[1.75rem] text-sm leading-relaxed relative group transition-all duration-500',
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none font-medium shadow-xl shadow-blue-900/40'
                        : 'glass-premium dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 rounded-tl-none border border-white/10'
                    )}
                  >
                    {msg.role === 'ai' && (
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-transparent blur opacity-0 group-hover:opacity-100 transition-opacity rounded-[1.75rem]" />
                    )}
                    <span className="relative z-10">{msg.text}</span>
                    <div className={cn(
                      'flex items-center gap-2 mt-3 opacity-40',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}>
                      {msg.role === 'ai' && <RefreshCw size={8} className="animate-spin-slow" />}
                      <p className="text-[8px] font-black uppercase tracking-widest italic">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isThinking && (
                <div className="flex justify-start items-start gap-3">
                  <div className="w-10 h-10 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-white/10">
                    <Activity size={18} className="text-blue-500 animate-pulse" />
                  </div>
                  <div className="glass-premium px-6 py-4 rounded-[1.75rem] rounded-tl-none border border-white/10 flex flex-col gap-2 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      {[0, 0.1, 0.2].map((delay, i) => (
                        <motion.div 
                          key={i} 
                          className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay } as const}
                        />
                      ))}
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1 italic">Synthesizing...</span>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-blue-500"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" } as const}
                      />
                    </div>
                    <span className="text-[7px] text-white/30 uppercase tracking-[0.2em]">Analyzing relationship data model...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Suggested Prompts */}
            <div className="px-6 py-3 bg-white/5 border-t border-white/5 overflow-x-auto luxury-scroll whitespace-nowrap flex gap-2 z-[55]">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="px-4 py-2 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/40 rounded-full text-[9px] font-black text-slate-400 hover:text-blue-400 uppercase tracking-widest transition-all italic flex items-center gap-2 group"
                >
                  <Terminal size={10} className="group-hover:scale-110 transition-transform" />
                  {prompt}
                </button>
              ))}
            </div>

            {/* Input Wrapper */}
            <div className="px-6 pb-8 pt-4 border-t border-white/10 bg-white/5 backdrop-blur-3xl flex items-center gap-3 flex-shrink-0 z-[55] relative">
              {isListening && (
                <div className="absolute inset-x-0 -top-12 h-12 bg-blue-500/10 flex items-center justify-center gap-4 backdrop-blur-xl border-t border-blue-500/20">
                  <motion.div 
                    animate={{ scale: [1, 2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 bg-blue-500 rounded-full" 
                  />
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] italic animate-pulse">Listening_Now...</span>
                  <motion.div 
                    animate={{ scale: [1, 2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                    className="w-2 h-2 bg-blue-500 rounded-full" 
                  />
                </div>
              )}

              <button
                onClick={toggleListening}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
                  isListening 
                    ? "bg-red-500/20 border-red-500/40 text-red-500" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-blue-500 hover:border-blue-500/40"
                )}
              >
                <Mic size={20} className={cn(isListening && "animate-pulse")} />
              </button>

              <div className="relative flex-1 group">
                <div className="absolute -inset-0.5 bg-blue-500/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="EXECUTE_COMMAND..."
                  className="relative w-full bg-black/40 text-slate-900 dark:text-white placeholder:text-slate-600 rounded-2xl px-5 py-4 text-sm font-bold tracking-tight outline-none border border-white/10 focus:border-blue-500/50 transition-all italic"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => sendMessage()}
                disabled={!inputText.trim() || isThinking}
                className={cn(
                  "w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center transition-all flex-shrink-0 shadow-premium shadow-blue-600/30 active:shadow-none disabled:opacity-30",
                )}
              >
                <Zap size={20} className={cn(isThinking && "animate-pulse")} />
              </motion.button>

              {/* Resize handle — bottom-right corner */}
              <div
                onMouseDown={handleResizeMouseDown}
                className="absolute -bottom-1 -right-1 z-[60] p-3 text-white/10 hover:text-blue-500 cursor-nw-resize transition-all"
              >
                <div className="w-2 h-2 border-r-2 border-b-2 border-current rounded-sm" />
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── COLLAPSED BUBBLE ── */
          <motion.button
            key="chat-bubble"
            drag
            dragConstraints={{ left: 24, top: 24, right: window.innerWidth - 104, bottom: window.innerHeight - 104 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              setChatPosition({ x: info.point.x, y: info.point.y });
            }}
            initial={{ opacity: 0, scale: 0.5, rotate: -20, x: chatPosition.x, y: chatPosition.y }}
            animate={{ opacity: 1, scale: 1, rotate: 0, x: chatPosition.x, y: chatPosition.y }}
            exit={{ opacity: 0, scale: 0.5, rotate: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { triggerHaptic('MEDIUM'); setChatOpen(true); }}
            className="absolute pointer-events-auto group w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] shadow-premium shadow-blue-500/40 flex items-center justify-center overflow-hidden border border-white/20"
            title="Initialize Horizon Intelligence"
          >
            <div className="absolute inset-0 scanline opacity-20 pointer-events-none" />
            <motion.div 
              className="absolute inset-0 bg-blue-400 opacity-20 blur-xl"
              animate={{ opacity: [0.1, 0.4, 0.1] }}
              transition={{ duration: 3, repeat: Infinity } as const}
            />
            <MessageCircle size={32} className="text-white relative z-10 drop-shadow-glow" />
            
            <div className="absolute right-full mr-6 whitespace-nowrap glass-premium text-white text-[10px] font-black uppercase tracking-[0.3em] px-5 py-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none shadow-2xl border border-white/20 italic translate-x-4 group-hover:translate-x-0">
              Initialize_Intelligence
              <div className="absolute top-1/2 right-0 translate-x-full -translate-y-1/2 border-[6px] border-transparent border-l-white/20" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingChat;
