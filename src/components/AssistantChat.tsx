import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Brain, X, Send, Sparkles } from 'lucide-react';
import { analyzeText } from '@/services/apiService';
import { cn } from '@/utils/ui';

type ChatState = 'collapsed' | 'suggestion_mode' | 'conversation_mode';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const AssistantChat: React.FC = () => {
    const [state, setState] = useState<ChatState>('collapsed');
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    
    const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Suggestions based on "page context" (mocked for now)
    const suggestions = [
        "Summarize my last call",
        "Who is Brandon Gilles?",
        "Check relationship health",
        "Upcoming follow-ups"
    ];

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (state === 'conversation_mode') {
            scrollToBottom();
        }
    }, [messages, state]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (state !== 'collapsed') return; // Only drag when collapsed
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: position.x,
            startPosY: position.y
        };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragRef.current) return;
        
        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;
        
        setPosition({
            x: dragRef.current.startPosX + deltaX,
            y: dragRef.current.startPosY + deltaY
        });
    }, [isDragging]);

    const handleMouseUp = () => {
        setIsDragging(false);
        dragRef.current = null;
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove]);

    const handleSendMessage = async (content: string) => {
        if (!content.trim()) return;
        
        const newMessages: Message[] = [...messages, { role: 'user', content }];
        setMessages(newMessages);
        setInputValue('');
        setIsProcessing(true);
        setState('conversation_mode');

        try {
            // Mocking Gemini response using analyzeText for now or just a timeout
            // In a real scenario, this would call a dedicated chat endpoint
            const response = await analyzeText(content);
            setMessages([...newMessages, { role: 'assistant', content: response.summary || "I'm analyzing that for you..." }]);
        } catch (error) {
            setMessages([...newMessages, { role: 'assistant', content: "Sorry, I encountered an error processing that request." }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleExpand = () => {
        if (state === 'collapsed') {
            setState('suggestion_mode');
        } else {
            setState('collapsed');
        }
    };

    return (
        <div 
            className="fixed z-[9999] transition-all duration-300 ease-spring"
            style={{ 
                left: state === 'collapsed' ? position.x : 'auto', 
                top: state === 'collapsed' ? position.y : 'auto',
                right: state !== 'collapsed' ? '24px' : 'auto',
                bottom: state !== 'collapsed' ? '24px' : 'auto'
            }}
        >
            {/* Collapsed Bubble */}
            {state === 'collapsed' && (
                <button
                    onMouseDown={handleMouseDown}
                    onClick={() => {
                        if (dragRef.current && Math.abs(dragRef.current.startPosX - position.x) < 5) {
                            toggleExpand();
                        }
                    }}
                    className={cn(
                        "w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform duration-200 cursor-grab active:cursor-grabbing",
                        isDragging && "scale-105"
                    )}
                >
                    <Brain size={28} />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
                </button>
            )}

            {/* Expanded Interface */}
            {state !== 'collapsed' && (
                <div className={cn(
                    "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200",
                    state === 'suggestion_mode' ? "w-80" : "w-96 h-[500px]"
                )}>
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
                                <Brain size={16} />
                            </div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white">Gemini Assistant</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => setState('collapsed')}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 thin-scrollbar">
                        {state === 'suggestion_mode' && (
                            <div className="space-y-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2">
                                        <Sparkles size={14} />
                                        How can I help you today?
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSendMessage(s)}
                                            className="w-full p-2.5 text-left text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-slate-700 dark:text-slate-300 flex items-center justify-between group"
                                        >
                                            {s}
                                            <Send size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {state === 'conversation_mode' && (
                            <div className="space-y-4">
                                {messages.map((msg, i) => (
                                    <div key={i} className={cn(
                                        "flex",
                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}>
                                        <div className={cn(
                                            "max-w-[85%] p-3 rounded-2xl text-sm",
                                            msg.role === 'user' 
                                                ? "bg-blue-600 text-white rounded-tr-none shadow-md" 
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700"
                                        )}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isProcessing && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700">
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Footer / Input */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                placeholder="Aks Gemini..."
                                className="w-full p-2.5 pr-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                            />
                            <button 
                                onClick={() => handleSendMessage(inputValue)}
                                disabled={!inputValue.trim() || isProcessing}
                                className="absolute right-2 p-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssistantChat;
