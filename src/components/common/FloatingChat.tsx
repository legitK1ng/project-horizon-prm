/**
 * Horizon AI — Floating Chat Window
 * Item 3: Resizable, collapsible, localStorage-persisted via Zustand
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MessageCircle, X, Send, Minimize2, Bot, Sparkles, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/utils/ui';
import { api } from '@/services/apiClient';
import { useUiStore } from '@/store/appStore';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'ai',
  text: "Hey! Welcome to Horizon. I'm your relationship intelligence assistant. Ask me anything about your contacts, recent calls, or relationship health.",
  timestamp: new Date(),
};

const MIN_WIDTH  = 320;
const MAX_WIDTH  = 640;
const MIN_HEIGHT = 400;
const MAX_HEIGHT = 800;

const FloatingChat: React.FC = () => {
  const {
    chatOpen, setChatOpen,
    chatWidth, chatHeight, setChatSize,
    chatPosition, setChatPosition,
  } = useUiStore();

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText]  = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Drag state
  const [dragging, setDragging]   = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Resize state
  const [resizing, setResizing]   = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, w: chatWidth, h: chatHeight });

  const containerRef  = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Focus when opened
  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [chatOpen]);

  // ── Drag Logic ──────────────────────────────────────────────────────────────
  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    e.preventDefault();
  }, []);

  // ── Resize Logic ─────────────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    resizeStart.current = { x: e.clientX, y: e.clientY, w: chatWidth, h: chatHeight };
    setResizing(true);
    e.preventDefault();
    e.stopPropagation();
  }, [chatWidth, chatHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        const x = e.clientX - dragOffset.current.x;
        const y = e.clientY - dragOffset.current.y;
        const maxX = window.innerWidth  - (containerRef.current?.offsetWidth  ?? chatWidth);
        const maxY = window.innerHeight - (containerRef.current?.offsetHeight ?? chatHeight);
        setChatPosition({
          x: Math.max(0, Math.min(x, maxX)),
          y: Math.max(0, Math.min(y, maxY)),
        });
      }
      if (resizing) {
        const dx = resizeStart.current.x - e.clientX; // dragging left corner → grow right
        const dy = resizeStart.current.y - e.clientY;
        const newW = Math.min(MAX_WIDTH,  Math.max(MIN_WIDTH,  resizeStart.current.w + dx));
        const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStart.current.h + dy));
        setChatSize(newW, newH);
      }
    };
    const onUp = () => { setDragging(false); setResizing(false); };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, resizing, setChatPosition, setChatSize]);

  // ── Messaging ───────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isThinking) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    try {
      const data = await api.aiChat(text);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'ai', text: data.message, timestamp: new Date() },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          text: `Error: ${error.message || "Couldn't reach the intelligence engine."}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('Clear conversation history?')) setMessages([INITIAL_MESSAGE]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Position style — default bottom-right when never moved
  const isDefaultPosition = chatPosition.x === 0 && chatPosition.y === 0;
  const positionStyle: React.CSSProperties = isDefaultPosition
    ? { position: 'fixed', bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))', right: '1.5rem' }
    : { position: 'fixed', left: chatPosition.x, top: chatPosition.y };

  return (
    <div
      ref={containerRef}
      style={{ ...positionStyle, zIndex: 9999 }}
      className={cn('transition-none', (dragging || resizing) ? 'cursor-grabbing select-none' : '')}
    >
      {chatOpen ? (
        /* ── EXPANDED CHAT WINDOW ── */
        <div
          style={{ width: chatWidth, height: chatHeight }}
          className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ring-1 ring-black/5 relative"
        >
          {/* Resize handle — top-left corner */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute top-3 left-3 z-10 p-1 text-white/40 hover:text-white/80 cursor-nw-resize transition-colors"
            title="Drag to resize"
          >
            <GripVertical size={14} />
          </div>

          {/* Header — drag handle */}
          <div
            className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 cursor-grab active:cursor-grabbing flex-shrink-0"
            onMouseDown={handleDragMouseDown}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Horizon AI</p>
                <p className="text-blue-200 text-[10px]">Relationship Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearChat} className="p-1.5 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition-colors" title="Clear Chat">
                <Trash2 size={15} />
              </button>
              <button onClick={() => setChatOpen(false)} className="p-1.5 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition-colors" title="Minimize">
                <Minimize2 size={15} />
              </button>
              <button onClick={() => setChatOpen(false)} className="p-1.5 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition-colors" title="Close">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scroll-smooth bg-slate-50/30 dark:bg-slate-950/20">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex animate-in fade-in slide-in-from-bottom-2 duration-200', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1 border border-blue-200/50 dark:border-blue-800/50">
                    <Bot size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700'
                  )}
                >
                  {msg.text}
                  <p className={cn('text-[9px] mt-1 opacity-50', msg.role === 'user' ? 'text-right' : 'text-left')}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start animate-in fade-in duration-200">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1 border border-blue-200/50">
                  <Bot size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="bg-white dark:bg-slate-800 px-4 py-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 flex items-center gap-1.5 shadow-sm">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Horizon anything..."
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-500 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all border border-transparent focus:border-blue-500/20"
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || isThinking}
              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-2xl flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-blue-600/20 active:scale-90"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* ── COLLAPSED BUBBLE ── */
        <button
          onClick={() => setChatOpen(true)}
          className="group relative w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/50 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center"
          title="Open Horizon AI"
        >
          <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
          <MessageCircle size={26} className="text-white relative z-10" />
          <div className="absolute right-full mr-3 whitespace-nowrap bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
            Ask Horizon AI
            <div className="absolute top-1/2 right-0 translate-x-full -translate-y-1/2 border-4 border-transparent border-l-slate-900 dark:border-l-white" />
          </div>
        </button>
      )}
    </div>
  );
};

export default FloatingChat;
