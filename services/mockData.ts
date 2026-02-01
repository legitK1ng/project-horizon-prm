
import { CallRecord, Contact } from '../types';

export const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'Brandon Gilles', phone: '+1555010203', organization: 'Luxe Real Estate', totalCalls: 12, lastContacted: '2024-05-20T14:30:00Z' },
  { id: '2', name: 'Sarah Miller', phone: '+1555020304', organization: 'Quantum Tech', totalCalls: 8, lastContacted: '2024-05-19T10:15:00Z' },
  { id: '3', name: 'David Chen', phone: '+1555030405', organization: 'Chen & Partners', totalCalls: 4, lastContacted: '2024-05-18T16:45:00Z' },
  { id: '4', name: 'Elena Rodriguez', phone: '+1555040506', organization: 'Global Logistics', totalCalls: 22, lastContacted: '2024-05-20T09:00:00Z' },
];

export const MOCK_CALLS: CallRecord[] = [
  {
    id: 'rec1',
    timestamp: '2024-05-20T14:30:00Z',
    contactName: 'Brandon Gilles',
    phoneNumber: '+1555010203',
    duration: '14m 22s',
    status: 'completed',
    rawTranscript: "Hey, it's Brandon. I wanted to follow up on the Horizon project. We need to finalize the API documentation by next Tuesday if we want to hit the Q3 launch date. Also, Elena mentioned the budget for the server migration might need an extra 15% padding. Let's talk about that on Monday morning.",
    executiveBrief: {
      title: 'Actionable Input: Horizon Project Timeline & Budget',
      summary: 'Brandon requested final API documentation for the Horizon project by next Tuesday to maintain the Q3 schedule. A potential 15% budget increase for server migration was also flagged.',
      actionItems: [
        'Finalize API documentation by end of day Tuesday.',
        'Review server migration budget with Elena.',
        'Schedule Monday morning sync with Brandon.'
      ],
      tags: ['#horizon', '#deadline', '#budget']
    }
  },
  {
    id: 'rec2',
    timestamp: '2024-05-20T09:00:00Z',
    contactName: 'Elena Rodriguez',
    phoneNumber: '+1555040506',
    duration: '08m 15s',
    status: 'completed',
    rawTranscript: "Good morning. Regarding the logistics contract, we are seeing some delays at the port. I'll need you to review the force majeure clause in the new agreement. We're looking at a 3-day buffer for current shipments. Send me a quick confirmation once you've looked it over.",
    executiveBrief: {
      title: 'Actionable Input: Logistics Contract Review',
      summary: 'Elena reported port delays and requested a legal review of the force majeure clause in the new logistics contract. A 3-day buffer is currently being implemented.',
      actionItems: [
        'Review force majeure clause in Logistics Contract.',
        'Confirm contract adjustment with Elena.',
        'Update shipment tracking dashboard with 3-day buffer.'
      ],
      tags: ['#logistics', '#legal', '#urgent']
    }
  }
];
