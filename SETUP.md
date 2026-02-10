# 🚀 Project Horizon PRM - Complete Setup Guide

## 📑 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Frontend Setup](#frontend-setup)
3. [Backend Setup (Google Apps Script)](#backend-setup)
4. [API Configuration](#api-configuration)
5. [Deployment](#deployment)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Services
- ✅ Node.js 18+ installed
- ✅ Google Account with Google Cloud access
- ✅ Google Cloud Project created
- ✅ Gemini API key (from Google AI Studio)

### Google Cloud APIs to Enable
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these APIs:
   - ✅ Google Sheets API
   - ✅ People API (Google Contacts)
   - ✅ Secret Manager API
   - ✅ Cloud Logging API

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd horizon-prm-fixed
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Get this from Google AI Studio (https://aistudio.google.com/apikey)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Get this after deploying Google Apps Script (see Backend Setup)
VITE_BACKEND_URL=

# Optional: Enable mock data if backend isn't ready
VITE_ENABLE_MOCK_DATA=true
```

### 3. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

---

## Backend Setup (Google Apps Script)

### Step 1: Create Google Spreadsheet

1. Create a new Google Spreadsheet
2. Name it: "Project Horizon PRM - Master"
3. Note the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

### Step 2: Open Apps Script Editor

1. In your spreadsheet: **Extensions** → **Apps Script**
2. Delete the default `Code.gs` content

### Step 3: Copy Backend Files

Create these files in Apps Script editor:

**File 1: Code.gs**
- Copy contents from `backend/Code.gs`

**File 2: Config.gs**
- Copy contents from `backend/Config.gs`
- **IMPORTANT**: Update `PROJECT_NUMBER` with your GCP project number

**File 3: appsscript.json**
- Click gear icon (⚙️) → **Show "appsscript.json" manifest file**
- Copy contents from `backend/appsscript.json`

### Step 4: Run Initial Setup

1. In Apps Script editor, select `oneTimeSetup` function from dropdown
2. Click **Run** (▶️)
3. **Authorize** when prompted:
   - Review permissions
   - Click **Advanced** → **Go to Project (unsafe)**
   - Click **Allow**

This creates the "Logs" sheet with proper headers.

### Step 5: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click gear icon (⚙️) → **Web app**
3. Configuration:
   - **Description**: "Horizon PRM Backend v1"
   - **Execute as**: Me (your email)
   - **Who has access**: **Anyone** (CRITICAL for webhooks!)
4. Click **Deploy**
5. **Copy the Web App URL** - you'll need this!

Example URL:
```
https://script.google.com/macros/s/AKfycby.../exec
```

### Step 6: Update Frontend Environment

Add the deployment URL to `.env.local`:
```env
VITE_BACKEND_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

---

## API Configuration

### Gemini API Setup

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Select your Google Cloud project
4. Copy the API key
5. **For Frontend**: Add to `.env.local` as `VITE_GEMINI_API_KEY`
6. **For Backend**: Store in Google Secret Manager (see below)

### Google Secret Manager Setup (Backend)

1. Go to [Secret Manager](https://console.cloud.google.com/security/secret-manager)
2. Click **Create Secret**
3. Configuration:
   - **Name**: `GEMINI_API_KEY`
   - **Secret value**: Paste your Gemini API key
4. Click **Create**
5. Note the **Project Number** from your GCP dashboard
6. Update `PROJECT_NUMBER` in `backend/Config.gs`

---

## Deployment

### Frontend Deployment (Vercel/Netlify)

#### Option 1: Vercel

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard:
- `VITE_GEMINI_API_KEY`
- `VITE_BACKEND_URL`

#### Option 2: Netlify

```bash
npm run build
```

Deploy the `dist` folder to Netlify.

Add environment variables in Netlify dashboard.

### Backend Deployment

Already done in "Backend Setup"! Just make sure:
- ✅ Web app is deployed
- ✅ Access is set to "Anyone"
- ✅ URL is added to frontend `.env.local`

---

## Troubleshooting

### Common Issues

#### 1. "Access Denied" / 403 Error

**Problem**: Google Apps Script deployment permissions are wrong.

**Solution**:
1. Apps Script Editor → **Deploy** → **Manage deployments**
2. Click Edit (✏️) icon
3. Set "Who has access" to **"Anyone"**
4. Click **Deploy**

#### 2. Mock Data Showing Instead of Live Data

**Checklist**:
- [ ] `VITE_BACKEND_URL` is set in `.env.local`
- [ ] Apps Script is deployed correctly
- [ ] Deployment permission is "Anyone"
- [ ] No CORS errors in browser console

#### 3. Gemini API Errors

**Error**: "API key not valid"
- Verify key is correct in both frontend and Secret Manager
- Ensure Gemini API is enabled in Google Cloud

**Error**: "Quota exceeded"
- Check [API quotas](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
- Consider upgrading to paid tier

#### 4. Webhook Not Working (ACR Phone)

**Checklist**:
- [ ] Google Apps Script URL is correct
- [ ] ACR Phone has internet permission
- [ ] Field mappings are correct:
  - `contact_name` → Contact Name
  - `phone_number` → Phone
  - `note` → Transcript

### Testing Backend

Run this in browser to test your backend:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

Should return:
```json
{
  "status": "success",
  "logs": [],
  "contacts": []
}
```

---

## Support & Resources

- **Documentation**: See main README.md
- **Google Apps Script Docs**: https://developers.google.com/apps-script
- **Gemini API Docs**: https://ai.google.dev/docs
- **React + Vite**: https://vitejs.dev/guide/

---

## Next Steps

1. ✅ Complete setup above
2. 🧪 Test with Processing Lab
3. 📱 Configure ACR Phone webhook
4. 🎨 Customize theme and branding
5. 📊 Monitor Cloud Logging for issues
6. 🚀 Deploy to production!

---

**Need Help?** Check the troubleshooting section or file an issue on GitHub.
