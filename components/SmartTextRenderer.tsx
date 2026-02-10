
import React from 'react';
import { ICONS } from '../constants';

interface SmartTextRendererProps {
  text: string;
  onTagClick?: (tag: string) => void;
}

const SmartTextRenderer: React.FC<SmartTextRendererProps> = ({ text, onTagClick }) => {
  if (!text) {
    return null;
  }

  // Regex patterns
  // 1. Tags: #word
  // 2. Dates/Times: Simple catch-all for weekdays, times, and dates like "Monday", "10:00 AM", "May 20th"
  const regex = /((?:#\w+)|(?:\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\b)|(?:\b\d{1,2}:\d{2}(?:\s?[AP]M)?\b))/g;

  const parts = text.split(regex);

  const handleDateClick = (dateStr: string) => {
    alert(`📅 Calendar Integration\n\nAnalyzing transcript to create calendar event for: "${dateStr}"...`);
  };

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(part);
              }}
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium mx-0.5"
            >
              {part}
            </button>
          );
        } else if (
          /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(part) || 
          /\d{1,2}:\d{2}/.test(part)
        ) {
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                handleDateClick(part);
              }}
              className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer mx-0.5"
            >
              <span className="mr-1 opacity-70 scale-75">{ICONS.Calendar}</span>
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default SmartTextRenderer;
