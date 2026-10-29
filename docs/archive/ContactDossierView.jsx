import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Phone, Mail, Clock, Filter, UserPlus, Star, ImagePlus,
  Building, MapPin, Globe, Linkedin, Twitter, ExternalLink, ShieldCheck,
  Activity, Sparkles, ChevronRight, X, Calendar, FileText, CheckCircle2,
  RefreshCw, Award, AlertCircle, ArrowUpRight, MessageSquare, Database
} from 'lucide-react';

// ── MOCK DATA ────────────────────────────────────────────────────────────────
const INITIAL_CONTACTS = [
  {
    id: 'cnt-1',
    first_name: 'Elena',
    last_name: 'Rostova',
    title: 'Chief Strategy Officer',
    company: 'Vanguard Aerospace Dynamics',
    email: 'e.rostova@vanguard-aero.com',
    phone: '+1 (415) 892-4410',
    location: 'San Francisco, CA',
    avatar: null,
    is_favorite: true,
    warmth_score: 94,
    last_contact_at: '2026-10-28T14:32:00Z',
    touchpoint_count: 18,
    tags: ['Executive', 'Tier 1 Partner', 'Aerospace'],
    osint_status: 'verified',
    osint_sources: ['Google People API', 'LinkedIn Enterprise', 'US SEC EDGAR'],
    socials: {
      linkedin: 'https://linkedin.com/in/elena-rostova',
      twitter: 'https://x.com/erostova_strategy',
      website: 'https://vanguard-aero.com'
    },
    bio: 'Leads global mergers, avionics procurement, and satellite payload joint ventures across North America & EMEA.',
    recent_calls: [
      {
        id: 'call-101',
        date: '2026-10-28',
        duration: '18m 42s',
        brief: 'Finalized preliminary pricing for the dual-band telemetry expansion. Horizon PRM integration slated for Q1.',
        sentiment: 'Strongly Positive'
      },
      {
        id: 'call-098',
        date: '2026-10-21',
        duration: '34m 10s',
        brief: 'Strategic sync regarding Department of Defense compliance boundaries and local node failover.',
        sentiment: 'Neutral / Focused'
      }
    ],
    tasks: [
      { id: 't-1', title: 'Transmit signed encryption NDA to Vanguard Legal', status: 'pending', priority: 'urgent' },
      { id: 't-2', title: 'Schedule dual-channel ACR audio telemetry test', status: 'completed', priority: 'high' }
    ]
  },
  {
    id: 'cnt-2',
    first_name: 'Marcus',
    last_name: 'Vance',
    title: 'VP Infrastructure & Networks',
    company: 'Apex Core Logistics',
    email: 'm.vance@apexcore.io',
    phone: '+1 (312) 554-9102',
    location: 'Chicago, IL',
    avatar: null,
    is_favorite: false,
    warmth_score: 68,
    last_contact_at: '2026-10-26T09:15:00Z',
    touchpoint_count: 9,
    tags: ['Mesh Networks', 'Client', 'Midwest'],
    osint_status: 'verified',
    osint_sources: ['Google People API', 'GitHub', 'Tailscale Community'],
    socials: {
      linkedin: 'https://linkedin.com/in/marcus-vance-net',
      twitter: null,
      website: 'https://apexcore.io'
    },
    bio: 'Oversees 40+ node multi-region Tailnet deployments and Edge compute orchestration for supply-chain sensors.',
    recent_calls: [
      {
        id: 'call-100',
        date: '2026-10-26',
        duration: '14m 19s',
        brief: 'Reviewed Tailscale Funnel ingress latency for ACR webhook packets. Packet drops reduced to 0.02%.',
        sentiment: 'Positive'
      }
    ],
    tasks: [
      { id: 't-3', title: 'Validate HP-Z2G3 gateway ping across tailnet', status: 'completed', priority: 'medium' }
    ]
  },
  {
    id: 'cnt-3',
    first_name: 'Dr. Aris',
    last_name: 'Thorne',
    title: 'Principal Research Scientist',
    company: 'Hyperion Deep Technologies',
    email: 'athorne@hyperion-research.ai',
    phone: '+1 (617) 402-9981',
    location: 'Cambridge, MA',
    avatar: null,
    is_favorite: true,
    warmth_score: 88,
    last_contact_at: '2026-10-27T17:45:00Z',
    touchpoint_count: 24,
    tags: ['AI Labs', 'Gemini Architect', 'Advisor'],
    osint_status: 'verified',
    osint_sources: ['Google People API', 'Google Scholar', 'ArXiv'],
    socials: {
      linkedin: 'https://linkedin.com/in/aristhorne-ai',
      twitter: 'https://x.com/aris_thorne',
      website: 'https://hyperion-research.ai'
    },
    bio: 'Specialist in multi-modal LLM reasoning pipelines, autonomous audio diarization, and edge voice transcription.',
    recent_calls: [
      {
        id: 'call-099',
        date: '2026-10-27',
        duration: '22m 05s',
        brief: 'Deep dive into asynchronous run_in_executor loop delegation for Gemini API embeddings.',
        sentiment: 'Enthusiastic'
      }
    ],
    tasks: [
      { id: 't-4', title: 'Benchmark Gemini 2.5 Flash token speed against Whisper local', status: 'pending', priority: 'high' }
    ]
  },
  {
    id: 'cnt-4',
    first_name: 'Sophia',
    last_name: 'Sterling',
    title: 'Managing Director',
    company: 'Sterling & Croft Capital',
    email: 's.sterling@sterlingcroft.com',
    phone: '+1 (212) 808-3390',
    location: 'New York, NY',
    avatar: null,
    is_favorite: false,
    warmth_score: 41,
    last_contact_at: '2026-10-12T11:00:00Z',
    touchpoint_count: 5,
    tags: ['Financing', 'Investor', 'Stale'],
    osint_status: 'partial',
    osint_sources: ['Google People API', 'Bloomberg Terminal'],
    socials: {
      linkedin: 'https://linkedin.com/in/sophia-sterling-nyc',
      twitter: null,
      website: 'https://sterlingcroft.com'
    },
    bio: 'Fintech and deep-tech seed-to-growth investor. Focused on autonomous systems and private data custody.',
    recent_calls: [
      {
        id: 'call-082',
        date: '2026-10-12',
        duration: '09m 11s',
        brief: 'Introductory overview of Project Horizon PRM telemetry and offline-first edge architecture.',
        sentiment: 'Cautious / Interested'
      }
    ],
    tasks: [
      { id: 't-5', title: 'Send updated executive deck before November review', status: 'pending', priority: 'medium' }
    ]
  },
  {
    id: 'cnt-5',
    first_name: 'Darius',
    last_name: 'Chen',
    title: 'Lead Mobile Architect',
    company: 'Cascade Mobile Systems',
    email: 'darius@cascademobile.dev',
    phone: '+1 (206) 919-4820',
    location: 'Seattle, WA',
    avatar: null,
    is_favorite: false,
    warmth_score: 79,
    last_contact_at: '2026-10-25T16:20:00Z',
    touchpoint_count: 12,
    tags: ['Capacitor', 'Android Native', 'Hardware Bridge'],
    osint_status: 'verified',
    osint_sources: ['Google People API', 'GitHub', 'StackOverflow'],
    socials: {
      linkedin: 'https://linkedin.com/in/darius-chen-mobile',
      twitter: 'https://x.com/darius_chen',
      website: 'https://cascademobile.dev'
    },
    bio: 'Author of custom Capacitor audio capture bridge plugins. Works extensively on Android background services.',
    recent_calls: [
      {
        id: 'call-094',
        date: '2026-10-25',
        duration: '15m 30s',
        brief: 'Consulted on capacitor-horizon build lifecycle and Android foreground service lifecycle.',
        sentiment: 'Positive'
      }
    ],
    tasks: []
  }
];

export default function ContactDossierView() {
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [sortBy, setSortBy] = useState('warmth');
  const [selectedContact, setSelectedContact] = useState(INITIAL_CONTACTS[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [enrichingId, setEnrichingId] = useState(null);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [contactNotes, setContactNotes] = useState({
    'cnt-1': ['Prefers encrypted Signal channel for NDA documents.', 'Targeting Q1 prototype deployment.'],
    'cnt-2': ['Configured Tailscale auth key with 90-day expiry.'],
    'cnt-3': ['Shared ArXiv pre-print on low-latency audio quantization.']
  });

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set();
    contacts.forEach(c => c.tags.forEach(t => set.add(t)));
    return ['ALL', ...Array.from(set)];
  }, [contacts]);

  // Filter & sort
  const filteredContacts = useMemo(() => {
    return contacts
      .filter(c => {
        const full = `${c.first_name} ${c.last_name}`.toLowerCase();
        const matchesSearch =
          full.includes(searchTerm.toLowerCase()) ||
          c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone.includes(searchTerm);
        const matchesTag = selectedTag === 'ALL' || c.tags.includes(selectedTag);
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => {
        if (sortBy === 'warmth') return b.warmth_score - a.warmth_score;
        if (sortBy === 'recent') return new Date(b.last_contact_at).getTime() - new Date(a.last_contact_at).getTime();
        if (sortBy === 'alpha') return a.last_name.localeCompare(b.last_name);
        return 0;
      });
  }, [contacts, searchTerm, selectedTag, sortBy]);

  // Toggle favorite
  const handleToggleFavorite = (e, id) => {
    e.stopPropagation();
    setContacts(prev => prev.map(c => c.id === id ? { ...c, is_favorite: !c.is_favorite } : c));
    if (selectedContact?.id === id) {
      setSelectedContact(prev => ({ ...prev, is_favorite: !prev.is_favorite }));
    }
  };

  // Trigger OSINT Enrichment Simulation
  const handleEnrich = (e, contact) => {
    e.stopPropagation();
    if (enrichingId) return;
    setEnrichingId(contact.id);
    setTimeout(() => {
      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          const updatedTags = Array.from(new Set([...c.tags, 'OSINT Enriched']));
          const newSources = Array.from(new Set([...c.osint_sources, 'Google People API OSINT', 'FastAPI Edge Sentinel']));
          return {
            ...c,
            osint_status: 'verified',
            warmth_score: Math.min(100, c.warmth_score + 5),
            tags: updatedTags,
            osint_sources: newSources
          };
        }
        return c;
      }));
      setEnrichingId(null);
      setSyncFeedback(`OSINT Intelligence verified for ${contact.first_name} ${contact.last_name}`);
      setTimeout(() => setSyncFeedback(null), 3500);
    }, 1200);
  };

  // Trigger Google Sync
  const handleGoogleSync = () => {
    setSyncingGoogle(true);
    setTimeout(() => {
      setSyncingGoogle(false);
      setSyncFeedback('Google Contacts two-way synchronizer aligned (5 synced, 0 conflicts)');
      setTimeout(() => setSyncFeedback(null), 3500);
    }, 1500);
  };

  // Toggle task in selected contact
  const handleToggleTask = (taskId) => {
    if (!selectedContact) return;
    const updatedTasks = selectedContact.tasks.map(t =>
      t.id === taskId ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
    );
    setSelectedContact({ ...selectedContact, tasks: updatedTasks });
    setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, tasks: updatedTasks } : c));
  };

  // Add Note
  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedContact) return;
    const id = selectedContact.id;
    setContactNotes(prev => ({
      ...prev,
      [id]: [newNoteText.trim(), ...(prev[id] || [])]
    }));
    setNewNoteText('');
  };

  const getInitials = (fn, ln) => `${fn?.[0] || ''}${ln?.[0] || ''}`.toUpperCase();

  const getWarmthColor = (score) => {
    if (score >= 80) return 'text-[#E8A656] border-[#E8A656]/40 bg-[#E8A656]/10';
    if (score >= 60) return 'text-amber-400 border-amber-400/40 bg-amber-400/10';
    if (score >= 40) return 'text-blue-400 border-blue-400/40 bg-blue-400/10';
    return 'text-rose-400 border-rose-400/40 bg-rose-400/10';
  };

  return (
    <div className="min-h-screen bg-[#0E0D0B] text-stone-200 font-sans p-4 md:p-8 selection:bg-[#E8A656]/30">
      
      {/* Toast Notification */}
      {syncFeedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#161512] border border-[#E8A656]/50 text-white px-5 py-3 rounded-xl shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Sparkles className="w-5 h-5 text-[#E8A656] animate-pulse" />
          <span className="text-sm font-medium">{syncFeedback}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#E8A656] animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-[#E8A656] uppercase">
              PROJECT HORIZON PRM • DIRECTORY
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Intelligence <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8A656] to-amber-200">Dossiers</span>
          </h1>
          <p className="text-xs md:text-sm text-stone-400 mt-1">
            Bi-directional Google People sync, OSINT metadata telemetry, and relationship pulse monitoring.
          </p>
        </div>

        {/* Global Stats & Sync */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#161512] border border-white/5 px-4 py-2 rounded-xl flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase font-mono text-stone-500">Entities</div>
              <div className="text-lg font-bold font-mono text-white">{contacts.length}</div>
            </div>
            <div className="w-[1px] h-7 bg-white/10" />
            <div>
              <div className="text-[10px] uppercase font-mono text-stone-500">Avg Warmth</div>
              <div className="text-lg font-bold font-mono text-[#E8A656]">
                {Math.round(contacts.reduce((acc, c) => acc + c.warmth_score, 0) / contacts.length)}%
              </div>
            </div>
          </div>

          <button
            onClick={handleGoogleSync}
            disabled={syncingGoogle}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E8A656] to-amber-600 text-stone-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition shadow-lg shadow-[#E8A656]/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogle ? 'animate-spin' : ''}`} />
            {syncingGoogle ? 'Syncing...' : 'Google People Sync'}
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH STRIP */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder="Search dossiers by name, company, phone, email, or credentials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#161512] border border-white/10 rounded-xl text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#E8A656]/60 transition"
          />
        </div>

        {/* Sort & Tag Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#161512] border border-white/10 px-3 py-2 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-mono text-stone-300 focus:outline-none cursor-pointer"
            >
              <option value="warmth" className="bg-[#161512]">Sort: Relationship Warmth</option>
              <option value="recent" className="bg-[#161512]">Sort: Last Contacted</option>
              <option value="alpha" className="bg-[#161512]">Sort: Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TAG CHIPS */}
      <div className="max-w-7xl mx-auto mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
              selectedTag === tag
                ? 'bg-[#E8A656]/20 border border-[#E8A656] text-[#E8A656]'
                : 'bg-[#161512] border border-white/5 text-stone-400 hover:text-stone-200 hover:border-white/20'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* CONTACTS GRID */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.map(contact => {
          const initials = getInitials(contact.first_name, contact.last_name);
          const isSelected = selectedContact?.id === contact.id;

          return (
            <div
              key={contact.id}
              onClick={() => {
                setSelectedContact(contact);
                setDrawerOpen(true);
              }}
              className={`group relative bg-[#161512]/90 border rounded-2xl p-5 cursor-pointer transition duration-200 hover:border-[#E8A656]/40 hover:-translate-y-1 shadow-lg ${
                isSelected ? 'border-[#E8A656] shadow-[#E8A656]/10' : 'border-white/5'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-800 to-stone-900 border border-white/10 flex items-center justify-center font-mono font-bold text-sm text-[#E8A656] shadow-inner">
                    {initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white group-hover:text-[#E8A656] transition flex items-center gap-2">
                      {contact.first_name} {contact.last_name}
                      {contact.is_favorite && <Star className="w-3.5 h-3.5 fill-[#E8A656] text-[#E8A656]" />}
                    </h3>
                    <div className="text-xs text-stone-400 line-clamp-1">{contact.title}</div>
                    <div className="text-[11px] font-mono text-stone-500 line-clamp-1">{contact.company}</div>
                  </div>
                </div>

                {/* Warmth Score */}
                <div className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${getWarmthColor(contact.warmth_score)}`}>
                  {contact.warmth_score}%
                </div>
              </div>

              {/* Contact Meta */}
              <div className="space-y-1.5 mb-4 text-xs text-stone-400 font-mono">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-stone-500" />
                  <span className="truncate">{contact.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-stone-500" />
                  <span className="truncate">{contact.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  <span className="truncate">{contact.location}</span>
                </div>
              </div>

              {/* OSINT Badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {contact.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-stone-300">
                    {t}
                  </span>
                ))}
              </div>

              {/* Footer strip */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-stone-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[#E8A656]" />
                  <span>{new Date(contact.last_contact_at).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleEnrich(e, contact)}
                    disabled={enrichingId === contact.id}
                    className="p-1.5 hover:bg-white/10 rounded text-stone-400 hover:text-[#E8A656] transition"
                    title="Run OSINT Enrichment"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${enrichingId === contact.id ? 'animate-spin text-[#E8A656]' : ''}`} />
                  </button>

                  <button
                    onClick={(e) => handleToggleFavorite(e, contact.id)}
                    className="p-1.5 hover:bg-white/10 rounded text-stone-400 hover:text-amber-400 transition"
                    title="Toggle Favorite"
                  >
                    <Star className={`w-3.5 h-3.5 ${contact.is_favorite ? 'fill-[#E8A656] text-[#E8A656]' : ''}`} />
                  </button>

                  <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-[#E8A656] transition" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SLIDE-OVER DOSSIER DRAWER */}
      {drawerOpen && selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl bg-[#12110F] border-l border-white/10 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-white/10 flex items-start justify-between bg-[#161512]/60 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-900 border border-[#E8A656]/40 flex items-center justify-center font-mono font-black text-xl text-[#E8A656] shadow-xl">
                  {getInitials(selectedContact.first_name, selectedContact.last_name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">
                      {selectedContact.first_name} {selectedContact.last_name}
                    </h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getWarmthColor(selectedContact.warmth_score)}`}>
                      {selectedContact.warmth_score}% Warmth
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">{selectedContact.title}</div>
                  <div className="text-xs font-mono text-[#E8A656]">{selectedContact.company}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleEnrich(e, selectedContact)}
                  className="px-3 py-1.5 rounded-lg bg-[#E8A656]/10 border border-[#E8A656]/40 text-[#E8A656] text-xs font-mono flex items-center gap-1.5 hover:bg-[#E8A656]/20 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Enrich
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex items-center border-b border-white/10 bg-[#161512] px-6 text-xs font-mono">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'calls', label: `Calls (${selectedContact.recent_calls.length})` },
                { id: 'tasks', label: `Actions (${selectedContact.tasks.length})` },
                { id: 'osint', label: 'OSINT Intelligence' },
                { id: 'notes', label: 'Field Notes' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDrawerTab(tab.id)}
                  className={`py-3 px-3 border-b-2 font-medium uppercase tracking-wider transition ${
                    drawerTab === tab.id
                      ? 'border-[#E8A656] text-[#E8A656]'
                      : 'border-transparent text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* TAB 1: OVERVIEW */}
              {drawerTab === 'overview' && (
                <div className="space-y-6">
                  {/* Bio block */}
                  <div className="bg-[#161512] border border-white/5 rounded-xl p-4">
                    <div className="text-[11px] font-mono text-stone-500 uppercase mb-2">Executive Summary & Persona</div>
                    <p className="text-sm text-stone-300 leading-relaxed">{selectedContact.bio}</p>
                  </div>

                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-[#161512] border border-white/5 rounded-xl">
                      <div className="text-stone-500 text-[10px] uppercase">Primary Phone</div>
                      <div className="text-white mt-1 font-semibold">{selectedContact.phone}</div>
                    </div>
                    <div className="p-3 bg-[#161512] border border-white/5 rounded-xl">
                      <div className="text-stone-500 text-[10px] uppercase">Official Email</div>
                      <div className="text-white mt-1 font-semibold truncate">{selectedContact.email}</div>
                    </div>
                    <div className="p-3 bg-[#161512] border border-white/5 rounded-xl">
                      <div className="text-stone-500 text-[10px] uppercase">Base Station</div>
                      <div className="text-white mt-1">{selectedContact.location}</div>
                    </div>
                    <div className="p-3 bg-[#161512] border border-white/5 rounded-xl">
                      <div className="text-stone-500 text-[10px] uppercase">Touchpoints Logged</div>
                      <div className="text-[#E8A656] mt-1 font-bold">{selectedContact.touchpoint_count} interactions</div>
                    </div>
                  </div>

                  {/* Verified Links */}
                  <div className="bg-[#161512] border border-white/5 rounded-xl p-4">
                    <div className="text-[11px] font-mono text-stone-500 uppercase mb-3">Associated Network Channels</div>
                    <div className="space-y-2 text-xs">
                      {selectedContact.socials.linkedin && (
                        <a
                          href={selectedContact.socials.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white transition"
                        >
                          <div className="flex items-center gap-2">
                            <Linkedin className="w-4 h-4 text-blue-400" />
                            <span className="font-mono">LinkedIn Profile</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                        </a>
                      )}
                      {selectedContact.socials.twitter && (
                        <a
                          href={selectedContact.socials.twitter}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white transition"
                        >
                          <div className="flex items-center gap-2">
                            <Twitter className="w-4 h-4 text-sky-400" />
                            <span className="font-mono">X / Twitter Handle</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                        </a>
                      )}
                      {selectedContact.socials.website && (
                        <a
                          href={selectedContact.socials.website}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white transition"
                        >
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-emerald-400" />
                            <span className="font-mono">{selectedContact.socials.website}</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CALLS */}
              {drawerTab === 'calls' && (
                <div className="space-y-4">
                  {selectedContact.recent_calls.length === 0 ? (
                    <div className="text-center py-12 text-stone-500 text-sm font-mono">
                      No call records registered for this entity.
                    </div>
                  ) : (
                    selectedContact.recent_calls.map(call => (
                      <div key={call.id} className="bg-[#161512] border border-white/5 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#E8A656] font-bold">{call.id}</span>
                          <span className="text-stone-400">{call.date} • {call.duration}</span>
                        </div>
                        <p className="text-xs text-stone-300 leading-relaxed">{call.brief}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono text-stone-500">
                          <span>Sentiment: <strong className="text-stone-300">{call.sentiment}</strong></span>
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Transcribed
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: TASKS */}
              {drawerTab === 'tasks' && (
                <div className="space-y-3">
                  {selectedContact.tasks.length === 0 ? (
                    <div className="text-center py-12 text-stone-500 text-sm font-mono">
                      All action items resolved for this entity.
                    </div>
                  ) : (
                    selectedContact.tasks.map(task => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTask(task.id)}
                          className="flex items-start gap-3 p-3 bg-[#161512] border border-white/5 rounded-xl cursor-pointer hover:border-white/20 transition"
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition ${
                            isDone ? 'bg-emerald-500 border-emerald-500 text-stone-950' : 'border-stone-500'
                          }`}>
                            {isDone && <CheckCircle2 className="w-3 h-3" />}
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs ${isDone ? 'line-through text-stone-500' : 'text-stone-200'}`}>
                              {task.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-stone-500">
                              <span className="uppercase">{task.priority}</span>
                              <span>•</span>
                              <span className={isDone ? 'text-emerald-400' : 'text-amber-400'}>{task.status}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 4: OSINT */}
              {drawerTab === 'osint' && (
                <div className="space-y-4">
                  <div className="bg-[#161512] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-mono uppercase tracking-wider text-stone-400">Security Clearance & Integrity</div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Level 3 Verified
                      </span>
                    </div>
                    <div className="space-y-2 text-xs font-mono text-stone-300">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-stone-500">Source Attributions</span>
                        <span>{selectedContact.osint_sources.join(', ')}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-stone-500">Google People ID</span>
                        <span className="text-[#E8A656]">people/c{selectedContact.id.replace('cnt-', '892718')}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">Verification Hash</span>
                        <span className="text-stone-400">sha256-4b89f2a...88c</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-[#161512] to-stone-900 border border-[#E8A656]/30 rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-mono text-[#E8A656] mb-1">
                      <Sparkles className="w-4 h-4" /> Autonomous Intelligence Ingestion
                    </div>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      All phone interactions recorded via ACR Phone are cross-referenced with Google People API biographical data and indexed into the Supabase vector store.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 5: NOTES */}
              {drawerTab === 'notes' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Enter tactical field note or relationship intelligence..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="w-full p-3 bg-[#161512] border border-white/10 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#E8A656]/60 transition"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#E8A656] text-stone-950 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition"
                      >
                        Append Note
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {(contactNotes[selectedContact.id] || []).map((note, idx) => (
                      <div key={idx} className="p-3 bg-[#161512] border border-white/5 rounded-xl text-xs text-stone-300">
                        <div className="text-[10px] font-mono text-stone-500 mb-1">Note #{idx + 1}</div>
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
