# Notion Integration Setup (Pagine Normali)

## 1. Create Notion Integration
1. Go to https://www.notion.so/profile/integrations/internal
2. Click "+ New integration"
3. Name: "CloudHelper"
4. Select workspace
5. Click "Submit"
6. Copy "Internal Integration Secret"

## 2. Share Pages with Integration
1. Apri ogni pagina Notion che vuoi usare
2. Click "..." (top right) → "Add connections"
3. Cerca "CloudHelper" e seleziona
4. Ripeti per ogni pagina

## 3. Add to .env.local
```
NOTION_API_KEY=your_integration_token_here
```

## 4. Restart Server
```bash
npm run dev
```

Ora "Load Notion" troverà automaticamente tutte le pagine condivise!
