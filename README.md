# Property Considerations Dashboard

Vercel serverless function that reads the Notion **Property Considerations** database and renders a clean, sortable HTML table with proper yen formatting, commas, color-coded ratings, and filter controls.

## What it shows

- All properties from the Notion database
- 12 curated columns: Name (linked to Notion), Status, Location, Asking, Income, Gross %, NCF, Mortgage, Profit, Year/Age, Structure, Rating
- Summary stats (count, total asking value, avg yield)
- Client-side sort (click any column) and filter (search + status dropdown)
- Auto-sorted by rating (Strong Buy first) then gross yield descending

## Deploy

### 1. Prep the Notion integration token

If you already have a Notion integration (same one used for SST):

- Go to your integration at https://www.notion.so/my-integrations
- Copy the **Internal Integration Token** (starts with `secret_` or `ntn_`)
- Open the **🏘️ Property Considerations** database in Notion → `⋯` menu → **Connections** → add the integration

If you need to create a new one:

- https://www.notion.so/my-integrations → **New integration**
- Name: `Real Estate Dashboard`, workspace: Six Sigma Talent
- Capabilities: only **Read content** is needed
- Copy the token, then connect it to the database as above

### 2. Deploy to Vercel

```bash
cd "/Users/tony/Desktop/Real Estate Investments/web"
npm install
npx vercel
```

First run will ask:
- Link to existing project? **N** (new project)
- Project name: `sst-real-estate` (or whatever)
- Deploy: **Y**

Then set the env vars:

```bash
npx vercel env add NOTION_TOKEN production
# paste the integration token

npx vercel env add NOTION_DATABASE_ID production
# paste: 061f334426374a4f9105fb2d6b104d38
```

Redeploy so env vars are picked up:

```bash
npx vercel --prod
```

You'll get a URL like `https://sst-real-estate.vercel.app`.

### 3. Local development (optional)

```bash
cp .env.example .env.local
# edit .env.local with your actual token
npx vercel dev
```

Opens at http://localhost:3000.

## Files

- `api/index.js` — the serverless function (handler renders the HTML)
- `vercel.json` — routes `/` to `/api/index`
- `package.json` — just depends on `@notionhq/client`

## Customizing

- **Columns** — edit the `<thead>` HTML and the `renderRow()` function in `api/index.js`
- **Sort order** — edit the `rows.sort()` block in the `handler` function
- **Styling** — all CSS is in the `CSS` constant at the top of `api/index.js`
- **Caching** — `Cache-Control` header is set to `s-maxage=60` (60-second CDN cache). Increase for fewer Notion API hits, decrease for fresher data.

## Notes on formula columns

The Notion database has formula columns (`Annual Net Cash Flow`, `Annual Mortgage`, `Total Annual Profit`, ratings, etc.). The Notion API reads their *computed* values — no extra work needed here. This dashboard exists specifically to work around Notion's UI limitations on formatting formula-column numbers.
