import React, { useMemo, useRef, useEffect, useState } from 'react';
import { parseTranscript, TranscriptMessage } from '@/utils/transcriptParser';
import { Copy, Check, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

interface TranscriptViewProps {
    transcript: string;
    contactName: string;
}

const MessageBubble: React.FC<{ message: TranscriptMessage; isConsecutive: boolean }> = ({ message, isConsecutive }) => {
    // Owner (you) = LEFT in grey, Other party = RIGHT in green
    const isOwner = message.isOwner;

    return (
        <div
            className={`flex ${isOwner ? 'justify-start' : 'justify-end'} ${isConsecutive ? 'mt-1' : 'mt-3'}`}
            role="article"
            aria-label={`Message from ${message.speaker}`}
        >
            <div className={`max-w-[75%] space-y-0.5`}>
                {/* Speaker label (only on first of a consecutive group) */}
                {!isConsecutive && (
                    <p className={`text-[10px] font-semibold uppercase tracking-wider px-1 ${isOwner
                        ? 'text-left text-slate-500 dark:text-slate-400'
                        : 'text-right text-emerald-600 dark:text-emerald-400'
                        }`}>
                        {message.speaker}
                    </p>
                )}

                {/* Bubble */}
                <div className={`px-3.5 py-2 text-sm leading-relaxed ${isOwner
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-md'
                    : 'bg-emerald-500 dark:bg-emerald-600 text-white rounded-2xl rounded-tr-md'
                    }`}>
                    {message.text}
                </div>

                {/* Timestamp if available */}
                {message.timestamp && (
                    <p className={`text-[10px] text-slate-400 px-1 ${isOwner ? 'text-left' : 'text-right'}`}>
                        {message.timestamp}
                    </p>
                )}
            </div>
        </div>
    );
};

const TranscriptView: React.FC<TranscriptViewProps> = ({ transcript, contactName }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const messages = useMemo(
        () => parseTranscript(transcript, contactName),
        [transcript, contactName]
    );

    const isLong = messages.length > 8;
    const visibleMessages = isExpanded || !isLong ? messages : messages.slice(0, 6);

    // Auto-scroll to bottom when expanded
    useEffect(() => {
        if (isExpanded && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [isExpanded]);

    const handleCopy = () => {
        navigator.clipboard.writeText(transcript).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };


    return (
        <div className="mt-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle size={11} />
                    Conversation · {messages.length} messages
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded"
                        title="Copy transcript"
                    >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div
                ref={scrollRef}
                className={`bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800 ${isExpanded ? 'max-h-96 overflow-y-auto thin-scrollbar' : ''
                    }`}
                role="log"
                aria-label="Conversation transcript"
            >
                {visibleMessages.map((msg, i) => {
                    const prevMsg = i > 0 ? visibleMessages[i - 1] : null;
                    const isConsecutive = prevMsg?.speaker === msg.speaker;

                    return <MessageBubble key={i} message={msg} isConsecutive={isConsecutive} />;
                })}

                {/* Show more / less toggle */}
                {isLong && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full mt-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-1 transition-colors"
                    >
                        {isExpanded ? (
                            <>Show less <ChevronUp size={14} /></>
                        ) : (
                            <>Show {messages.length - 6} more messages <ChevronDown size={14} /></>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TranscriptView;
