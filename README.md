# SST Real Estate Dashboard

Vercel serverless function that reads the Notion **🏘️ Property Considerations** database and renders a password-gated, sortable HTML table with interactive scenario modeling.

**Live:** https://web-tony-six-sigmas-projects.vercel.app (password: `sixsigma`)

## What it shows

- All active properties from the Notion database
- Summary stats at top: count, aggregate asking value, avg gross yield
- **18 columns:** Name (→ linked to Notion page), Gross %, Rating (No Loan), Profit, Rating (w/ Loan), Asking, Income, NCF, Location, Structure, Year/Age, Status, Mortgage, Expense %, Occ %, Loan ¥, Rate %, Years, plus a **Stress Test** button
- Client-side sort (click any header) and filter (search + status dropdown)
- Auto-sorted on load: Strong Buy 🟢 first, then by gross yield descending

## Interactive features

### Per-row scenario inputs

Five editable cells on the right of each row let you model deal scenarios without touching Notion:

| Input | Type | Default |
|---|---|---|
| Expense % | Dropdown, 10–35% (1% steps) | Notion value, else 20% |
| Occ % | Dropdown, 70/75/80/85/90/95/100 | 100% |
| Loan ¥ | Number input | Notion value if set |
| Rate % | Number input | Notion value if set |
| Years | Number input | Notion value if set |

Changes cascade through the math instantly:
```
Effective Income = Income × Occ %
NCF              = Effective Income × (1 − Expense %)
Mortgage         = amortization(Loan ¥, Rate %, Years)
Profit           = NCF − Mortgage
Debt Yield       = NCF / Loan ¥
Rating (w/ Loan) = derived from Profit + Debt Yield
```

Overrides persist in `localStorage` per property. Yellow highlight indicates a user-modified value.

### Stress Test modal

Click the **Stress Test** button on any row to open a sliders-driven what-if calculator for that property. Sliders cover Loan Value, Interest Rate, Loan Years, Occupancy %, Expense Ratio %, and Misc Annual Expenses. Shows a real-time cash-flow breakdown plus a profit/loss verdict banner and w/Loan rating.

Modal is a scratchpad — it prefills from the current row state but does not write back.

## Rating logic

- **Rating (No Loan)** — pure yield screen: 🟢 Strong Buy ≥10% gross · 🟡 Consider 7–9.9% · 🔴 Pass <7%
- **Rating (w/ Loan)** — combines cash flow and debt coverage:
  - 🟢 Strong Buy: Profit > 0 AND Debt Yield ≥ 8%
  - 🟡 Consider: Profit > 0 AND Debt Yield 5–7.9%
  - 🔴 Pass: Profit ≤ 0 (mortgage eats all cash flow)

## Architecture

- **Data source of truth:** the Notion database at `061f334426374a4f9105fb2d6b104d38`. Edit a property there → dashboard reflects it within ~60 seconds.
- **Runtime:** single Vercel serverless function (`api/index.js`) that fetches all pages from Notion on each request and renders complete HTML server-side.
- **No separate database** — nothing persisted outside of Notion and browser localStorage.
- **Deploy:** push to `main` on GitHub → Vercel auto-deploys. Manual: `npx vercel --prod --yes`.

## Environment variables (set in Vercel production)

| Variable | Purpose |
|---|---|
| `NOTION_TOKEN` | Notion integration secret (Read-only scope). Integration must be connected to the Property Considerations database. |
| `NOTION_DATABASE_ID` | `061f334426374a4f9105fb2d6b104d38` |
| `DASHBOARD_PASSWORD` | HTTP Basic Auth password. Any username works on the browser prompt. |

To manage: `npx vercel env ls`, `npx vercel env add <NAME> production`, `npx vercel env rm <NAME> production`.

## Local development

```bash
cd "/Users/tony/Desktop/Real Estate Investments/web"
cp .env.example .env.local
# edit .env.local with real values
npx vercel dev
```

Opens at http://localhost:3000.

## Files

- `api/index.js` — the serverless function. Contains the Notion fetch logic, HTML rendering, CSS, client-side JS (sort/filter/recompute/modal), and the stress test modal.
- `vercel.json` — routes `/` to `/api/index`
- `package.json` — one dependency: `@notionhq/client`

## Customizing

- **Columns** — edit the `<thead>` in `renderPage()` and the cells in `renderRow()`. Keep column indices in sync (the `STATUS_COL` constant in `CLIENT_JS` is used by the status filter).
- **Rating thresholds** — edit `recomputeRow()` in `CLIENT_JS` (and/or `ratingClass()` if you add new emoji-prefix conventions).
- **Slider ranges** — edit the `<input type="range">` `min`/`max`/`step` attributes in the stress modal HTML, plus the `sLv.max` override in `openStress()`.
- **Sort order** — edit the `rows.sort()` block in `handler()`.
- **Caching** — `Cache-Control: s-maxage=60, stale-while-revalidate` on the response. Increase for fewer Notion API hits, decrease for fresher data.
- **Styling** — all CSS is in the `CSS` constant.

## Known gotchas

- **Formula columns in Notion can't have their number format set via API.** That's the original reason this dashboard exists — the main table does its own yen/comma formatting client-side.
- **Column reordering requires updating `STATUS_COL` index** in `CLIENT_JS` so the status filter reads the right cell.
- **localStorage keys** are `loan_<pageId>` — scoped per property, per browser. Not shared across team members.
- **The modal is a singleton** — only one stress test is open at a time. Opening a second row's stress test replaces the first.

## Deploy flow

```bash
# Make changes to api/index.js (or other files)
git add -A
git commit -m "..."
git push

# Vercel auto-deploys from main branch (~15s)
```

For manual deploys without GitHub: `npx vercel --prod --yes` (uploads local folder directly).
