

export const APP_VIEW = {
  DASHBOARD: 'DASHBOARD',
  LOGS: 'LOGS',
  CONTACTS: 'CONTACTS',
  ACTIONS: 'ACTIONS',
  LAB: 'LAB',
} as const;

import {
  LayoutDashboard,
  PhoneCall,
  Users,
  FlaskConical,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Tag,
  ArrowRight,
  Sun,
  Moon,
  History,
  Calendar,
  Pin,
  PinOff,
  Filter,
  CheckSquare,
  Undo2,
  RefreshCw,
} from 'lucide-react';

export const ICONS = {
  Dashboard: <LayoutDashboard size={20} />,
  Logs: <PhoneCall size={20} />,
  Contacts: <Users size={20} />,
  Actions: <History size={20} />,
  Lab: <FlaskConical size={20} />,
  Search: <Search size={18} />,
  Success: <CheckCircle2 size={16} className="text-emerald-500" />,
  Pending: <Clock size={16} className="text-amber-500" />,
  Error: <AlertCircle size={16} className="text-rose-500" />,
  Chevron: <ChevronRight size={18} />,
  Trend: <TrendingUp size={16} />,
  Tag: <Tag size={14} />,
  Action: <ArrowRight size={16} className="text-blue-500" />,
  Sun: <Sun size={20} />,
  Moon: <Moon size={20} />,
  Calendar: <Calendar size={14} />,
  Pin: <Pin size={16} />,
  Unpin: <PinOff size={16} />,
  Filter: <Filter size={16} />,
  Check: <CheckSquare size={16} />,
  Undo: <Undo2 size={16} />,
  Refresh: <RefreshCw size={18} />,
} as const;

export const APP_CONFIG = {
  name: 'Project Horizon PRM',
  version: '1.0.0',
  defaultTimeout: 8000,
  maxRetries: 3,
  localStorage: {
    themeKey: 'horizon_theme',
    callsKey: 'horizon_prm_calls',
  },
} as const;

export const GEMINI_CONFIG = {
  model: 'gemini-2.0-flash-exp',
  defaultSystemPrompt: `You are a Strategic Consultant for a Personal Relationship Management system. 
Your goal is to analyze raw call transcripts and generate a professional, structured executive brief. 
Focus on identifying actionable items and strategic implications.`,
} as const;

export const BRAIN_PERSONAS = [
  {
    id: 'consultant' as const,
    label: 'Strategic Consultant',
    description: 'Standard executive briefing',
  },
  {
    id: 'mobilemech' as const,
    label: 'MobileMech AI',
    description: 'Technical quoting & diagnostics',
  },
  {
    id: 'finance' as const,
    label: 'Financial Analyst',
    description: 'P&L and variance tables',
  },
  {
    id: 'straight' as const,
    label: 'Straight Answer AI',
    description: 'Bullet-point facts only',
  },
  {
    id: 'system' as const,
    label: 'System Change',
    description: 'Custom context injection',
  },
] as const;
