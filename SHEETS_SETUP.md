# Google Sheets API Setup

## Quick Setup (5 minutes)

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new project (or select existing)
3. Click "Create Credentials" → "API Key"
4. Copy the API key
5. Click "Edit API key" → Under "API restrictions" → Select "Restrict key"
6. Check "Google Sheets API" → Save
7. Go to https://console.cloud.google.com/apis/library/sheets.googleapis.com
8. Click "Enable"

## Make Your Sheet Public

1. Open your sheet: https://docs.google.com/spreadsheets/d/1FvjfZ5a-OMM2ScO2lJewBFIrbnWvgQKJug_Ve32gAQA/edit
2. Click "Share" (top right)
3. Change to "Anyone with the link" → "Viewer"
4. Done!

## Add API Key

Open `.env.local` and add your API key:
```
GOOGLE_SHEETS_API_KEY=your_actual_api_key_here
```

Restart server: `npm run dev`
