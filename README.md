# Contractor Profile Scraper

A Next.js web scraper that uses Claude AI to extract structured data from contractor websites.

## What It Does

1. Takes a website URL
2. Fetches the website content
3. Uses Claude AI to extract:
   - Company name, headline, about
   - Contact info (phone, email, address)
   - Company size
   - Operating locations
   - Projects and photos

## Prerequisites

- Node.js 16+ installed
- An Anthropic API key (from https://console.anthropic.com)
- Git

## Local Setup (5 minutes)

### 1. Clone or Download This Repo
```bash
cd your-workspace
git clone <your-repo-url>
cd scraper-app-clean
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Add Your API Key
Create `.env.local` file in the root:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
```

### 4. Run Locally
```bash
npm run dev
```

Visit: http://localhost:3000

### 5. Test It
- Paste a URL like: `https://verobeachengineer.com/`
- Click "Scrape"
- Wait 3-5 seconds for results

## Deploy to Vercel (2 minutes)

### 1. Push to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Go to Vercel
1. Visit https://vercel.com
2. Click "New Project"
3. Connect your GitHub repo
4. Click "Deploy"

### 3. Add Environment Variable
1. In Vercel dashboard → Settings → Environment Variables
2. Add: `ANTHROPIC_API_KEY` = `sk-ant-...`
3. Redeploy

### 4. Live!
Your app will be at: `https://your-project.vercel.app`

## File Structure

```
scraper-app-clean/
├── pages/
│   ├── api/
│   │   └── scrape.js          ← API endpoint (does the scraping)
│   ├── _app.js                 ← Next.js wrapper
│   └── index.js                ← Frontend UI
├── styles/
│   └── globals.css             ← Tailwind styles
├── package.json                ← Dependencies
├── next.config.js              ← Next.js config
├── tailwind.config.js          ← Tailwind config
├── postcss.config.js           ← PostCSS config
└── .env.local                  ← Your API key (don't commit!)
```

## How It Works

1. **Frontend** (pages/index.js)
   - User enters a URL
   - Sends POST request to `/api/scrape`
   - Displays results

2. **API** (pages/api/scrape.js)
   - Fetches website HTML
   - Cleans HTML (removes scripts/styles)
   - Sends to Claude AI with extraction prompt
   - Parses JSON response
   - Returns structured data

3. **Claude AI**
   - Analyzes the website content
   - Extracts specific fields
   - Returns as valid JSON

## Troubleshooting

### "API key not found"
- Check `.env.local` exists
- Make sure `ANTHROPIC_API_KEY=sk-ant-...` is set
- Restart dev server after adding it

### "Failed to fetch website"
- URL might be blocked or unavailable
- Try a different URL
- Check if website uses JavaScript to load content

### "Failed to parse JSON"
- Claude might have added markdown formatting
- Check the console for the raw response
- Try a simpler website first

### "403 Forbidden on Vercel"
- Environment variable not set in Vercel dashboard
- Add `ANTHROPIC_API_KEY` in Settings → Environment Variables

## What's Next?

After scraping, the JSON data can be used to:
- Auto-fill Northspyre vendor profiles (with Chrome extension)
- Export to CRM systems
- Build contractor database
- Generate reports

## Questions?

Check the console logs for detailed debugging info.
