import { CallRecord, Contact } from '@/types';

export const MOCK_CONTACTS: Contact[] = [
  {
    id: 'contact-1',
    name: 'Brandon Gilles',
    phone: '+15550102030',
    organization: 'Luxe Real Estate',
    totalCalls: 12,
    lastContacted: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: 'contact-2',
    name: 'Sarah Miller',
    phone: '+15550203040',
    organization: 'Quantum Tech',
    totalCalls: 8,
    lastContacted: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
  },
  {
    id: 'contact-3',
    name: 'David Chen',
    phone: '+15550304050',
    organization: 'Chen & Partners',
    totalCalls: 4,
    lastContacted: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
  },
  {
    id: 'contact-4',
    name: 'Elena Rodriguez',
    phone: '+15550405060',
    organization: 'Global Logistics',
    totalCalls: 22,
    lastContacted: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
  },
];

export const MOCK_CALLS: CallRecord[] = [
  {
    id: 'call-1',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    contactName: 'Brandon Gilles',
    phoneNumber: '+15550102030',
    duration: 862, // 14m 22s
    status: 'COMPLETED',
    transcript:
      "Hey, it's Brandon. I wanted to follow up on the Horizon project. We need to finalize the API documentation by next Tuesday if we want to hit the Q3 launch date. Also, Elena mentioned the budget for the server migration might need an extra 15% padding. Let's talk about that on Monday morning.",
    executiveBrief: {
      title: 'Actionable Input: Horizon Project Timeline & Budget',
      summary:
        'Brandon requested final API documentation for the Horizon project by next Tuesday to maintain the Q3 schedule. A potential 15% budget increase for server migration was also flagged.',
      actionItems: [
        'Finalize API documentation by end of day Tuesday',
        'Review server migration budget with Elena',
        'Schedule Monday morning sync with Brandon',
      ],
      tags: ['#horizon', '#deadline', '#budget', '#urgent'],
      sentiment: 'Neutral',
    },
  },
  {
    id: 'call-2',
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    contactName: 'Elena Rodriguez',
    phoneNumber: '+15550405060',
    duration: 495, // 8m 15s
    status: 'COMPLETED',
    transcript:
      "Good morning. Regarding the logistics contract, we are seeing some delays at the port. I'll need you to review the force majeure clause in the new agreement. We're looking at a 3-day buffer for current shipments. Send me a quick confirmation once you've looked it over.",
    executiveBrief: {
      title: 'Actionable Input: Logistics Contract Review',
      summary:
        'Elena reported port delays and requested a legal review of the force majeure clause in the new logistics contract. A 3-day buffer is currently being implemented.',
      actionItems: [
        'Review force majeure clause in Logistics Contract',
        'Confirm contract adjustment with Elena',
        'Update shipment tracking dashboard with 3-day buffer',
      ],
      tags: ['#logistics', '#legal', '#urgent'],
      sentiment: 'Negative',
    },
  },
  {
    id: 'call-3',
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    contactName: 'Sarah Miller',
    phoneNumber: '+15550203040',
    duration: 342, // 5m 42s
    status: 'COMPLETED',
    transcript:
      "Hi there, quick question about the Quantum integration. The dev team is blocked on the OAuth implementation. Can we schedule a 30-minute call this week to walk through the configuration?",
    executiveBrief: {
      title: 'Actionable Input: Quantum OAuth Support Request',
      summary:
        'Sarah requested technical support for OAuth implementation that is currently blocking the development team. A 30-minute consultation call is needed this week.',
      actionItems: [
        'Schedule 30-minute OAuth configuration call with Sarah',
        'Prepare OAuth documentation and examples',
        'Review Quantum integration requirements',
      ],
      tags: ['#technical', '#quantum', '#oauth', '#support'],
      sentiment: 'Neutral',
    },
  },
  {
    id: 'call-4',
    timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    contactName: 'Unknown Caller',
    phoneNumber: '+15559876543',
    duration: 138, // 2m 18s
    status: 'QUEUED',
    transcript:
      'Hello, this is a message regarding your vehicle warranty...',
  },
];
