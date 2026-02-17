# 🚀 Project Horizon PRM v2.0

**Intelligent Personal Relationship Management System**

Transform raw call transcripts into strategic executive briefs using AI-powered analysis.

## 📋 Features

- 📞 **Call Intelligence** - Automated transcript analysis with AI
- 📋 **Executive Briefs** - Strategic summaries, action items, and sentiment analysis for every call
- 👥 **Contact Management** - Synced with Google Contacts API
- 🏷️ **Smart Tagging** - Organize calls with dynamic, editable tags
- 🔍 **Advanced Filtering** - Filter by Date Range, Tags, or Contact
- 📊 **Analytics Dashboard** - Visual insights into communication patterns
- 🧪 **AI Processing Lab** - Multiple analysis personas (Consultant, Finance, Technical, etc.)
- 📝 **Action Tracking** - Audit log with reversible operations
- 🌙 **Dark Mode** - Full theme support with persistence
- 📱 **Responsive Design** - Mobile-first interface

## 🏗️ Architecture

```
horizon-prm-fixed/
├── src/
│   ├── components/          # React UI components
│   ├── services/            # API & business logic
│   ├── contexts/            # React Context providers
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript type definitions
│   ├── constants/           # App-wide constants
│   ├── utils/               # Helper functions
│   └── assets/              # Static assets
├── backend/                 # Google Apps Script files
├── public/                  # Public static files
└── docs/                    # Additional documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Project (for Gemini API)
- Google Apps Script deployment (for backend)

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

1. **Configure environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and add:

- `VITE_GEMINI_API_KEY` - Your Gemini API key
- `VITE_BACKEND_URL` - Your deployed Google Apps Script URL

1. **Run development server:**

```bash
npm run dev
```

Visit `http://localhost:3000`

## 🔧 Backend Setup (Google Apps Script)

1. Create a new Google Apps Script project
2. Copy files from `backend/` folder:
    - `Code.gs`
    - `Config.gs`
3. Deploy as Web App:
    - Execute as: **User deploying**
    - Who has access: **Anyone** (for webhook support)
4. Copy the deployment URL to your `.env.local`

### Required Google APIs

Enable these in Google Cloud Console:

- Google Sheets API
- People API (Google Contacts)
- Secret Manager API (for API keys)
- Cloud Logging API

## 📱 Mobile App Integration

This system integrates with **ACR Phone** call recording app:

1. Configure webhook in ACR Phone settings
2. Point to your Google Apps Script URL
3. Map fields:
    - `contact_name` → Contact Name
    - `phone_number` → Phone
    - `note` → Transcript
    - `duration` → Call Duration

## 🎨 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
npx playwright test  # Run E2E tests
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GEMINI_API_KEY` | Gemini API key | Yes |
| `VITE_BACKEND_URL` | Google Apps Script URL | Yes |
| `VITE_ENABLE_MOCK_DATA` | Use mock data fallback | No |

## 🧪 AI Analysis Modes

The Processing Lab supports multiple AI personas:

- **Strategic Consultant** - Executive briefings with action items
- **MobileMech AI** - Technical quotes and repair estimates (simulated)
- **Financial Analyst** - P&L tables and variance analysis (simulated)
- **Straight Answer AI** - Bullet-point fact extraction
- **System Change** - Custom prompt injection for testing

## 🌐 API Integration

### Google Apps Script Endpoint

**GET** `/exec` - Fetch all logs and contacts
**GET** `/exec?action=list_models` - Fetch available Gemini models
**GET** `/exec?action=run_tests` - Run backend integrity tests
**GET** `/exec?action=test_gemini` - Verify Gemini API connectivity
**GET** `/exec?action=trigger_processing` - Force trigger background processing

**POST** `/exec` - Webhook for call ingestion payload

```json
{
  "status": "success",
  "logs": [...],
  "contacts": [...]
}
```

**POST** `/exec` - Webhook for call ingestion

```json
{
  "contact_name": "John Doe",
  "phone_number": "+1234567890",
  "note": "Transcript text...",
  "duration": 125
}
```

## 🐛 Troubleshooting

### "Access Denied" / 403 Error

The Google Apps Script deployment permissions are incorrect.

**Fix:**

1. Go to Apps Script Editor → Deploy → Manage Deployments
2. Click Edit (pencil icon) on current deployment
3. Set "Who has access" to **Anyone**
4. Click Deploy

### Mock Data Showing Instead of Live Data

Check:

1. `VITE_BACKEND_URL` is set correctly in `.env.local`
2. Apps Script is deployed with correct permissions
3. CORS is enabled (automatic with Apps Script)

### Gemini API Errors

Verify:

1. API key is valid and has Gemini API enabled
2. Billing is enabled on Google Cloud project
3. Rate limits haven't been exceeded

## 📊 Data Schema

### Call Log Structure

```typescript
{
  id: string;
  timestamp: string;        // ISO 8601
  contactName: string;
  phoneNumber: string;
  duration: string;         // "14m 22s" format
  rawTranscript: string;
  executiveBrief?: {
    title: string;
    summary: string;
    actionItems: string[];
    tags: string[];
    sentiment: 'Positive' | 'Neutral' | 'Negative';
  };
  status: 'pending' | 'processing' | 'completed' | 'error';
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 💡 Roadmap

- [ ] Real-time WebSocket updates
- [ ] Voice recording in Processing Lab
- [ ] Multi-language transcript support
- [ ] Calendar event creation from action items
- [ ] Email integration
- [ ] CRM exports (Salesforce, HubSpot)
- [ ] Mobile App (Expo/React Native)

## 📞 Support

For issues or questions:

- Create an issue on GitHub
- Email: <support@horizonprm.example.com>

---

Built with ❤️ using React, TypeScript, Tailwind CSS, and Google Gemini AI
