import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const yen = (n) =>
  n == null || Number.isNaN(n)
    ? "—"
    : "¥" + Math.round(n).toLocaleString("en-US");

const pct = (n) =>
  n == null || Number.isNaN(n) ? "—" : n.toFixed(1) + "%";

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Pull the readable value out of any Notion property type.
function readProp(page, name) {
  const p = page.properties[name];
  if (!p) return null;
  switch (p.type) {
    case "title":
      return p.title.map((t) => t.plain_text).join("");
    case "rich_text":
      return p.rich_text.map((t) => t.plain_text).join("");
    case "number":
      return p.number;
    case "select":
      return p.select?.name ?? null;
    case "multi_select":
      return p.multi_select.map((o) => o.name);
    case "formula":
      if (p.formula.type === "number") return p.formula.number;
      if (p.formula.type === "string") return p.formula.string;
      if (p.formula.type === "boolean") return p.formula.boolean;
      return null;
    case "date":
      return p.date?.start ?? null;
    case "url":
      return p.url;
    default:
      return null;
  }
}

function ratingClass(rating) {
  if (!rating) return "";
  if (rating.startsWith("🟢")) return "rating-green";
  if (rating.startsWith("🟡")) return "rating-yellow";
  if (rating.startsWith("🔴")) return "rating-red";
  return "";
}

function statusClass(status) {
  const map = {
    "Considering 検討中": "status-blue",
    "Watchlist 経過観察": "status-purple",
    "Under Offer オファー中": "status-yellow",
    "Acquired 取得": "status-green",
    "Passed パス": "status-gray",
  };
  return map[status] || "";
}

async function fetchAllPages() {
  const pages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function rowFromPage(page) {
  const struct = readProp(page, "Structure");
  return {
    id: page.id,
    url: page.url,
    name: readProp(page, "Property Name") || "(untitled)",
    status: readProp(page, "Current Status"),
    prefecture: readProp(page, "Prefecture"),
    city: readProp(page, "City"),
    access: readProp(page, "Access"),
    asking: readProp(page, "Asking Price"),
    income: readProp(page, "Projected Annual Income"),
    grossYield: readProp(page, "Gross Yield %"),
    ncf: readProp(page, "Annual Net Cash Flow"),
    mortgage: readProp(page, "Annual Mortgage"),
    profit: readProp(page, "Total Annual Profit"),
    yearBuilt: readProp(page, "Year Built"),
    age: readProp(page, "Building Age"),
    structure: Array.isArray(struct) ? struct.join(", ") : struct,
    ratingNoLoan: readProp(page, "Rating (No Loan)"),
    ratingWithLoan: readProp(page, "Rating (w/ Loan)"),
  };
}

function renderRow(r) {
  const profitClass =
    r.profit != null && r.profit < 0 ? "num neg" : "num";
  const location = [r.prefecture, r.city].filter(Boolean).join(" / ");
  const rNoLoan = r.ratingNoLoan || "—";
  const rWithLoan = r.ratingWithLoan || "—";
  return `
    <tr>
      <td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></td>
      <td class="num">${pct(r.grossYield)}</td>
      <td><span class="${ratingClass(rNoLoan)}">${escapeHtml(rNoLoan)}</span></td>
      <td class="${profitClass}">${yen(r.profit)}</td>
      <td><span class="${ratingClass(rWithLoan)}">${escapeHtml(rWithLoan)}</span></td>
      <td class="num">${yen(r.asking)}</td>
      <td class="num">${yen(r.income)}</td>
      <td class="num">${yen(r.ncf)}</td>
      <td class="num">${yen(r.mortgage)}</td>
      <td>${escapeHtml(location || "—")}</td>
      <td>${escapeHtml(r.structure || "—")}</td>
      <td>${r.yearBuilt ? escapeHtml(String(r.yearBuilt)) : "—"}${r.age ? ` <span class="muted">(${r.age}y)</span>` : ""}</td>
      <td><span class="pill ${statusClass(r.status)}">${escapeHtml(r.status || "—")}</span></td>
    </tr>
  `;
}

const CSS = `
  :root {
    --bg: #fafaf7;
    --fg: #1a1a1a;
    --muted: #888;
    --border: #e5e5e2;
    --row-hover: #f3f3ef;
    --accent: #2563eb;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic", sans-serif;
    margin: 0;
    padding: 24px;
    background: var(--bg);
    color: var(--fg);
    font-size: 14px;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: var(--muted); margin-bottom: 20px; font-size: 13px; }
  .stats { display: flex; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
  .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 20px; font-weight: 600; margin-top: 2px; }
  .controls { margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .controls input, .controls select {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    background: white;
  }
  .table-wrap { background: white; border: 1px solid var(--border); border-radius: 8px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; min-width: 1200px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
  th {
    background: #f7f7f4;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #555;
    cursor: pointer;
    user-select: none;
    position: sticky;
    top: 0;
  }
  th:hover { background: #efefeb; }
  th.sorted::after { content: " ↓"; color: var(--accent); }
  th.sorted.asc::after { content: " ↑"; }
  tr:hover td { background: var(--row-hover); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num.neg { color: #dc2626; }
  td a { color: var(--accent); text-decoration: none; }
  td a:hover { text-decoration: underline; }
  .muted { color: var(--muted); font-size: 12px; }
  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
  }
  .status-blue { background: #dbeafe; color: #1e40af; }
  .status-purple { background: #ede9fe; color: #6d28d9; }
  .status-yellow { background: #fef3c7; color: #92400e; }
  .status-green { background: #d1fae5; color: #065f46; }
  .status-gray { background: #e5e7eb; color: #4b5563; }
  .rating-green { color: #059669; font-weight: 600; }
  .rating-yellow { color: #b45309; font-weight: 600; }
  .rating-red { color: #dc2626; font-weight: 600; }
  footer { margin-top: 24px; color: var(--muted); font-size: 12px; }
`;

const CLIENT_JS = `
  // Client-side sort and filter
  const table = document.querySelector('table');
  const tbody = table.querySelector('tbody');
  const headers = [...table.querySelectorAll('th')];
  const search = document.getElementById('search');
  const statusFilter = document.getElementById('status-filter');

  let sortIdx = null;
  let sortAsc = true;

  function cellValue(row, idx) {
    const cell = row.children[idx];
    const text = cell.textContent.trim();
    // Try numeric parse for sortability
    const num = parseFloat(text.replace(/[¥,%\\s]/g, ''));
    return Number.isNaN(num) ? text.toLowerCase() : num;
  }

  function sortBy(idx) {
    if (sortIdx === idx) sortAsc = !sortAsc;
    else { sortIdx = idx; sortAsc = false; }
    const rows = [...tbody.querySelectorAll('tr')];
    rows.sort((a, b) => {
      const av = cellValue(a, idx);
      const bv = cellValue(b, idx);
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    rows.forEach(r => tbody.appendChild(r));
    headers.forEach((h, i) => {
      h.classList.toggle('sorted', i === idx);
      h.classList.toggle('asc', i === idx && sortAsc);
    });
  }

  headers.forEach((h, i) => h.addEventListener('click', () => sortBy(i)));

  function applyFilters() {
    const q = search.value.toLowerCase();
    const st = statusFilter.value;
    [...tbody.querySelectorAll('tr')].forEach(row => {
      const text = row.textContent.toLowerCase();
      const rowStatus = row.children[1].textContent.trim();
      const matchQ = !q || text.includes(q);
      const matchS = !st || rowStatus === st;
      row.style.display = matchQ && matchS ? '' : 'none';
    });
  }
  search.addEventListener('input', applyFilters);
  statusFilter.addEventListener('change', applyFilters);
`;

function renderPage(rows) {
  // Exclude Passed properties from default view stats
  const active = rows.filter((r) => r.status !== "Passed パス");
  const totalAsk = active.reduce((s, r) => s + (r.asking || 0), 0);
  const yields = active.map((r) => r.grossYield).filter((y) => y != null);
  const avgYield =
    yields.length > 0 ? yields.reduce((a, b) => a + b, 0) / yields.length : null;

  const statuses = [...new Set(rows.map((r) => r.status).filter(Boolean))];
  const statusOptions = statuses
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join("");

  const rowsHtml = rows.map(renderRow).join("");
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🏘️ Property Considerations</title>
  <style>${CSS}</style>
</head>
<body>
  <h1>🏘️ Property Considerations</h1>
  <div class="subtitle">Japan real estate investment portfolio</div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Total Properties</div><div class="stat-value">${rows.length}</div></div>
    <div class="stat"><div class="stat-label">Active (excl. Passed)</div><div class="stat-value">${active.length}</div></div>
    <div class="stat"><div class="stat-label">Total Asking (Active)</div><div class="stat-value">${yen(totalAsk)}</div></div>
    <div class="stat"><div class="stat-label">Avg Gross Yield</div><div class="stat-value">${pct(avgYield)}</div></div>
  </div>

  <div class="controls">
    <input id="search" placeholder="Search name, city, structure..." />
    <select id="status-filter">
      <option value="">All statuses</option>
      ${statusOptions}
    </select>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Gross %</th>
          <th>Rating (No Loan)</th>
          <th>Profit</th>
          <th>Rating (w/ Loan)</th>
          <th>Asking</th>
          <th>Income</th>
          <th>NCF</th>
          <th>Mortgage</th>
          <th>Location</th>
          <th>Structure</th>
          <th>Year</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <footer>Last updated ${escapeHtml(now)} JST · <a href="https://www.notion.so/${DATABASE_ID.replace(/-/g, "")}" target="_blank">Edit in Notion →</a></footer>
  <script>${CLIENT_JS}</script>
</body>
</html>`;
}

function checkAuth(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return true; // no password set → allow
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  // Accept any username, check password only
  const pass = decoded.includes(":") ? decoded.slice(decoded.indexOf(":") + 1) : decoded;
  return pass === expected;
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Property Dashboard"');
    res.status(401).send("Authentication required");
    return;
  }
  try {
    const pages = await fetchAllPages();
    const rows = pages.map(rowFromPage);
    // Sort: strong buys first, then by gross yield
    rows.sort((a, b) => {
      const rank = (r) => {
        const s = r.ratingNoLoan || "";
        if (s.startsWith("🟢")) return 0;
        if (s.startsWith("🟡")) return 1;
        if (s.startsWith("🔴")) return 2;
        return 3;
      };
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return (b.grossYield || 0) - (a.grossYield || 0);
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
    res.status(200).send(renderPage(rows));
  } catch (err) {
    console.error(err);
    res.status(500).send(
      `<pre>Error: ${escapeHtml(err.message)}</pre>`
    );
  }
}
