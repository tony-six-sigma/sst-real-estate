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
    loanValue: readProp(page, "Loan Value"),
    loanRate: readProp(page, "Loan Interest Rate"),
    loanYears: readProp(page, "Loan Years"),
    expenseRatio: readProp(page, "Expense Ratio %"),
  };
}

function renderRow(r) {
  const location = [r.prefecture, r.city].filter(Boolean).join(" / ");
  const rNoLoan = r.ratingNoLoan || "—";
  const attr = (v) => (v == null || v === "" ? "" : String(v));
  const expenseDefault = r.expenseRatio != null && r.expenseRatio > 0 ? r.expenseRatio : 20;
  const expenseOptions = [];
  for (let i = 10; i <= 35; i++) {
    expenseOptions.push(`<option value="${i}"${i === expenseDefault ? " selected" : ""}>${i}%</option>`);
  }
  const occupancyOptions = [70, 75, 80, 85, 90, 95, 100]
    .map((v) => `<option value="${v}"${v === 100 ? " selected" : ""}>${v}%</option>`)
    .join("");
  return `
    <tr data-page-id="${r.id}" data-income="${r.income ?? 0}" data-asking="${r.asking ?? 0}" data-name="${escapeHtml(r.name)}">
      <td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a></td>
      <td class="num">${pct(r.grossYield)}</td>
      <td><span class="${ratingClass(rNoLoan)}">${escapeHtml(rNoLoan)}</span></td>
      <td class="num cell-profit"></td>
      <td class="cell-rating-loan"></td>
      <td class="num">${yen(r.asking)}</td>
      <td class="num">${yen(r.income)}</td>
      <td class="num cell-ncf"></td>
      <td>${escapeHtml(location || "—")}</td>
      <td>${escapeHtml(r.structure || "—")}</td>
      <td>${r.yearBuilt ? escapeHtml(String(r.yearBuilt)) : "—"}${r.age ? ` <span class="muted">(${r.age}y)</span>` : ""}</td>
      <td><span class="pill ${statusClass(r.status)}">${escapeHtml(r.status || "—")}</span></td>
      <td class="num cell-mortgage"></td>
      <td><select class="loan-select" data-field="expense_ratio" data-default="${expenseDefault}">${expenseOptions.join("")}</select></td>
      <td><select class="loan-select" data-field="occupancy" data-default="100">${occupancyOptions}</select></td>
      <td><input type="number" class="loan-input" data-field="loan_value" data-default="${attr(r.loanValue)}" value="${attr(r.loanValue)}" placeholder="—" step="100000" /></td>
      <td><input type="number" class="loan-input" data-field="loan_rate" data-default="${attr(r.loanRate)}" value="${attr(r.loanRate)}" placeholder="—" step="0.01" /></td>
      <td><input type="number" class="loan-input" data-field="loan_years" data-default="${attr(r.loanYears)}" value="${attr(r.loanYears)}" placeholder="—" step="1" /></td>
      <td><button class="stress-btn" type="button">Stress Test</button></td>
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
  .loan-input {
    width: 90px;
    padding: 3px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    background: white;
    font-family: inherit;
  }
  .loan-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .loan-input.override, .loan-select.override { background: #fef9c3; border-color: #facc15; }
  .loan-input::-webkit-outer-spin-button,
  .loan-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .loan-select {
    padding: 3px 4px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 13px;
    background: white;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .loan-select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  footer { margin-top: 24px; color: var(--muted); font-size: 12px; }

  .stress-btn {
    background: var(--accent);
    color: white;
    border: none;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }
  .stress-btn:hover { background: #1d4ed8; }

  .modal { position: fixed; inset: 0; z-index: 1000; }
  .modal.hidden { display: none; }
  .modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
  .modal-content {
    position: relative;
    max-width: 560px;
    margin: 40px auto;
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    overflow: hidden;
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .modal-header h2 { margin: 0; font-size: 16px; }
  .modal-close {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: var(--muted);
    padding: 0 8px;
    line-height: 1;
  }
  .modal-close:hover { color: var(--fg); }
  .modal-body {
    padding: 20px;
    overflow-y: auto;
  }
  .stress-fixed {
    display: flex;
    gap: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
    font-size: 13px;
  }
  .slider-row {
    display: grid;
    grid-template-columns: 140px 1fr 110px;
    gap: 12px;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
  }
  .slider-row label { color: #555; }
  .slider-row input[type="range"] {
    width: 100%;
    accent-color: var(--accent);
  }
  .slider-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    font-size: 13px;
  }
  .stress-breakdown {
    margin-top: 16px;
    padding: 12px 14px;
    background: #f7f7f4;
    border-radius: 6px;
    font-size: 13px;
  }
  .bd-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    font-variant-numeric: tabular-nums;
  }
  .bd-row.bd-subtotal { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 6px; font-weight: 600; }
  .bd-row.bd-total { border-top: 2px solid #333; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 14px; }
  .bd-row.muted-row { color: var(--muted); margin-top: 6px; font-size: 12px; }
  .verdict {
    margin-top: 16px;
    padding: 14px;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    border-radius: 6px;
  }
  .verdict.profit { background: #d1fae5; color: #065f46; }
  .verdict.loss { background: #fee2e2; color: #991b1b; }
  .verdict.neutral { background: #e5e7eb; color: #4b5563; }
  .stress-note { margin-top: 12px; font-size: 11px; color: var(--muted); line-height: 1.4; }
`;

const CLIENT_JS = `
  const STATUS_COL = 11;

  function yen(n) {
    return n == null || isNaN(n) ? "—" : "¥" + Math.round(n).toLocaleString("en-US");
  }

  function ratingClass(r) {
    if (!r) return "";
    if (r.indexOf("🟢") === 0) return "rating-green";
    if (r.indexOf("🟡") === 0) return "rating-yellow";
    if (r.indexOf("🔴") === 0) return "rating-red";
    return "";
  }

  function calcMortgage(principal, ratePercent, years) {
    if (!principal || !years) return 0;
    if (!ratePercent) return principal / years;
    const r = ratePercent / 100 / 12;
    const n = years * 12;
    const monthly = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    return monthly * 12;
  }

  function recomputeRow(row) {
    const income = parseFloat(row.dataset.income) || 0;
    const expenseSel = row.querySelector('[data-field="expense_ratio"]');
    const occSel = row.querySelector('[data-field="occupancy"]');
    const expensePct = parseFloat(expenseSel.value) || 20;
    const occupancyPct = parseFloat(occSel.value) || 100;
    const ncf = income * (occupancyPct / 100) * (1 - expensePct / 100);

    const inputs = row.querySelectorAll('.loan-input');
    const lv = parseFloat(inputs[0].value) || 0;
    const lr = parseFloat(inputs[1].value) || 0;
    const ly = parseFloat(inputs[2].value) || 0;

    let mortgage = 0, profit = ncf, rating = "";
    const hasLoan = lv > 0 && ly > 0;
    if (hasLoan) {
      mortgage = calcMortgage(lv, lr, ly);
      profit = ncf - mortgage;
      const debtYield = (ncf / lv) * 100;
      if (profit <= 0) rating = "Pass 🔴";
      else if (debtYield >= 8) rating = "Strong Buy 🟢";
      else if (debtYield >= 5) rating = "Consider 🟡";
    }

    row.querySelector('.cell-ncf').textContent = yen(ncf);
    row.querySelector('.cell-mortgage').textContent = hasLoan ? yen(mortgage) : yen(0);
    const profitCell = row.querySelector('.cell-profit');
    profitCell.textContent = yen(profit);
    profitCell.className = 'num cell-profit' + (profit < 0 ? ' neg' : '');
    const ratingCell = row.querySelector('.cell-rating-loan');
    if (rating) {
      ratingCell.innerHTML = '<span class="' + ratingClass(rating) + '">' + rating + '</span>';
    } else {
      ratingCell.innerHTML = '<span>—</span>';
    }
  }

  function updateInputStyle(input) {
    const dflt = input.dataset.default || '';
    const cur = input.value;
    input.classList.toggle('override', cur !== dflt && cur !== '');
  }

  function loadLocalOverrides() {
    document.querySelectorAll('tr[data-page-id]').forEach(row => {
      const pageId = row.dataset.pageId;
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem('loan_' + pageId) || '{}'); } catch (e) {}
      row.querySelectorAll('.loan-input, .loan-select').forEach(el => {
        const f = el.dataset.field;
        if (stored[f] !== undefined && stored[f] !== '') {
          el.value = stored[f];
        }
        updateInputStyle(el);
      });
    });
  }

  function saveOverride(pageId, field, value) {
    const key = 'loan_' + pageId;
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
    if (value === '' || value == null) delete stored[field];
    else stored[field] = value;
    if (Object.keys(stored).length) localStorage.setItem(key, JSON.stringify(stored));
    else localStorage.removeItem(key);
  }

  document.querySelectorAll('.loan-input').forEach(input => {
    input.addEventListener('input', () => {
      const row = input.closest('tr');
      saveOverride(row.dataset.pageId, input.dataset.field, input.value);
      updateInputStyle(input);
      recomputeRow(row);
    });
  });

  document.querySelectorAll('.loan-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const row = sel.closest('tr');
      saveOverride(row.dataset.pageId, sel.dataset.field, sel.value);
      updateInputStyle(sel);
      recomputeRow(row);
    });
  });

  loadLocalOverrides();
  document.querySelectorAll('tr[data-page-id]').forEach(recomputeRow);

  // Sort and filter
  const table = document.querySelector('table');
  const tbody = table.querySelector('tbody');
  const headers = [...table.querySelectorAll('th')];
  const search = document.getElementById('search');
  const statusFilter = document.getElementById('status-filter');

  let sortIdx = null;
  let sortAsc = true;

  function cellValue(row, idx) {
    const cell = row.children[idx];
    const input = cell.querySelector('input');
    const text = input ? input.value : cell.textContent.trim();
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
      const rowStatus = row.children[STATUS_COL].textContent.trim();
      const matchQ = !q || text.includes(q);
      const matchS = !st || rowStatus === st;
      row.style.display = matchQ && matchS ? '' : 'none';
    });
  }
  search.addEventListener('input', applyFilters);
  statusFilter.addEventListener('change', applyFilters);

  // Stress test modal
  const modal = document.getElementById('stress-modal');
  const mTitle = document.getElementById('stress-title');
  const mIncome = document.getElementById('stress-income');
  const mAsking = document.getElementById('stress-asking');
  const sLv = document.getElementById('stress-lv');
  const sLr = document.getElementById('stress-lr');
  const sLy = document.getElementById('stress-ly');
  const sOcc = document.getElementById('stress-occ');
  const sExp = document.getElementById('stress-exp');
  const sMisc = document.getElementById('stress-misc');
  const vLv = document.getElementById('stress-lv-v');
  const vLr = document.getElementById('stress-lr-v');
  const vLy = document.getElementById('stress-ly-v');
  const vOcc = document.getElementById('stress-occ-v');
  const vExp = document.getElementById('stress-exp-v');
  const vMisc = document.getElementById('stress-misc-v');
  const bdEff = document.getElementById('bd-eff');
  const bdOp = document.getElementById('bd-op');
  const bdNcf = document.getElementById('bd-ncf');
  const bdMortgage = document.getElementById('bd-mortgage');
  const bdMisc = document.getElementById('bd-misc');
  const bdProfit = document.getElementById('bd-profit');
  const bdDy = document.getElementById('bd-dy');
  const verdict = document.getElementById('stress-verdict');

  let stressIncome = 0;
  let stressRow = null;

  function recomputeStress() {
    const lv = parseFloat(sLv.value) || 0;
    const lr = parseFloat(sLr.value) || 0;
    const ly = parseFloat(sLy.value) || 0;
    const occ = parseFloat(sOcc.value) || 0;
    const exp = parseFloat(sExp.value) || 0;
    const misc = parseFloat(sMisc.value) || 0;

    vLv.textContent = yen(lv);
    vLr.textContent = lr.toFixed(2) + '%';
    vLy.textContent = ly + ' yrs';
    vOcc.textContent = occ + '%';
    vExp.textContent = exp + '%';
    vMisc.textContent = yen(misc);

    const effInc = stressIncome * (occ / 100);
    const opEx = effInc * (exp / 100);
    const ncf = effInc - opEx;
    const mortgage = lv > 0 && ly > 0 ? calcMortgage(lv, lr, ly) : 0;
    const profit = ncf - mortgage - misc;
    const dy = lv > 0 ? (ncf / lv) * 100 : null;

    bdEff.textContent = yen(effInc);
    bdOp.textContent = '− ' + yen(opEx);
    bdNcf.textContent = yen(ncf);
    bdMortgage.textContent = '− ' + yen(mortgage);
    bdMisc.textContent = '− ' + yen(misc);
    bdProfit.textContent = yen(profit);
    bdDy.textContent = dy == null ? '—' : dy.toFixed(1) + '%';

    let rating = '';
    if (lv > 0 && ly > 0) {
      if (profit <= 0) rating = 'Pass 🔴';
      else if (dy >= 8) rating = 'Strong Buy 🟢';
      else if (dy >= 5) rating = 'Consider 🟡';
      else rating = 'Weak debt yield';
    }

    verdict.className = 'verdict';
    if (profit > 0) {
      verdict.classList.add('profit');
      verdict.textContent = '✅ Profitable: ' + yen(profit) + ' / year' + (rating ? ' · ' + rating : '');
    } else if (profit < 0) {
      verdict.classList.add('loss');
      verdict.textContent = '❌ Losing money: ' + yen(profit) + ' / year' + (rating ? ' · ' + rating : '');
    } else {
      verdict.classList.add('neutral');
      verdict.textContent = 'Break-even';
    }
  }

  function openStress(row) {
    const name = row.dataset.name || 'Property';
    const income = parseFloat(row.dataset.income) || 0;
    const asking = parseFloat(row.dataset.asking) || 0;
    const inputs = row.querySelectorAll('.loan-input');
    const selects = row.querySelectorAll('.loan-select');
    const lv = parseFloat(inputs[0].value) || Math.round(asking * 0.8);
    const lr = parseFloat(inputs[1].value) || 2.5;
    const ly = parseFloat(inputs[2].value) || 25;
    const exp = parseFloat(selects[0].value) || 20;
    const occ = parseFloat(selects[1].value) || 100;

    stressIncome = income;
    stressRow = row;
    mTitle.textContent = 'Stress Test: ' + name;
    mIncome.textContent = yen(income);
    mAsking.textContent = yen(asking);

    // Set slider max for loan value based on asking (at least 200M floor)
    sLv.max = Math.max(asking * 1.5, 200000000);
    sLv.value = lv;
    sLr.value = lr;
    sLy.value = ly;
    sOcc.value = occ;
    sExp.value = exp;
    sMisc.value = 0;

    recomputeStress();
    modal.classList.remove('hidden');
  }

  function writeBackToRow(row) {
    if (!row) return;
    const lv = Math.round(parseFloat(sLv.value) || 0);
    const lr = parseFloat(sLr.value) || 0;
    const ly = Math.round(parseFloat(sLy.value) || 0);
    // Snap occupancy to nearest allowed dropdown value [70, 75, ..., 100]
    const rawOcc = parseFloat(sOcc.value) || 100;
    const occ = Math.max(70, Math.min(100, Math.round(rawOcc / 5) * 5));
    // Snap expense to nearest allowed dropdown value [10..35]
    const rawExp = parseFloat(sExp.value) || 20;
    const exp = Math.max(10, Math.min(35, Math.round(rawExp)));

    const fields = [
      { selector: '[data-field="loan_value"]', value: lv > 0 ? String(lv) : '' },
      { selector: '[data-field="loan_rate"]', value: lr > 0 ? String(lr) : '' },
      { selector: '[data-field="loan_years"]', value: ly > 0 ? String(ly) : '' },
      { selector: '[data-field="occupancy"]', value: String(occ) },
      { selector: '[data-field="expense_ratio"]', value: String(exp) },
    ];
    fields.forEach(f => {
      const el = row.querySelector(f.selector);
      if (!el) return;
      el.value = f.value;
      saveOverride(row.dataset.pageId, el.dataset.field, f.value);
      updateInputStyle(el);
    });
    recomputeRow(row);
  }

  function closeStress() {
    writeBackToRow(stressRow);
    stressRow = null;
    modal.classList.add('hidden');
  }

  document.querySelectorAll('.stress-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      openStress(row);
    });
  });

  [sLv, sLr, sLy, sOcc, sExp, sMisc].forEach(s => s.addEventListener('input', recomputeStress));
  document.querySelector('.modal-close').addEventListener('click', closeStress);
  document.querySelector('.modal-backdrop').addEventListener('click', closeStress);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeStress(); });
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
          <th>Location</th>
          <th>Structure</th>
          <th>Year</th>
          <th>Status</th>
          <th>Mortgage</th>
          <th>Expense %</th>
          <th>Occ %</th>
          <th>Loan ¥</th>
          <th>Rate %</th>
          <th>Years</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <footer>Last updated ${escapeHtml(now)} JST · <a href="https://www.notion.so/${DATABASE_ID.replace(/-/g, "")}" target="_blank">Edit in Notion →</a></footer>

  <div id="stress-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="stress-title">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="stress-title">Stress Test</h2>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <div class="stress-fixed">
          <div><span class="muted">Annual Income</span><br/><strong id="stress-income">—</strong></div>
          <div><span class="muted">Asking Price</span><br/><strong id="stress-asking">—</strong></div>
        </div>

        <div class="slider-row">
          <label>Loan Value</label>
          <input type="range" id="stress-lv" min="0" max="500000000" step="500000" />
          <span class="slider-value" id="stress-lv-v">—</span>
        </div>
        <div class="slider-row">
          <label>Interest Rate</label>
          <input type="range" id="stress-lr" min="0" max="8" step="0.05" />
          <span class="slider-value" id="stress-lr-v">—</span>
        </div>
        <div class="slider-row">
          <label>Loan Years</label>
          <input type="range" id="stress-ly" min="5" max="40" step="1" />
          <span class="slider-value" id="stress-ly-v">—</span>
        </div>
        <div class="slider-row">
          <label>Occupancy %</label>
          <input type="range" id="stress-occ" min="0" max="100" step="5" />
          <span class="slider-value" id="stress-occ-v">—</span>
        </div>
        <div class="slider-row">
          <label>Expense Ratio %</label>
          <input type="range" id="stress-exp" min="0" max="50" step="1" />
          <span class="slider-value" id="stress-exp-v">—</span>
        </div>
        <div class="slider-row">
          <label>Misc Annual Expenses</label>
          <input type="range" id="stress-misc" min="0" max="10000000" step="10000" value="0" />
          <span class="slider-value" id="stress-misc-v">¥0</span>
        </div>

        <div class="stress-breakdown">
          <div class="bd-row"><span>Effective Income</span><span id="bd-eff">—</span></div>
          <div class="bd-row"><span>− Operating Expenses</span><span id="bd-op">—</span></div>
          <div class="bd-row bd-subtotal"><span>= NCF</span><span id="bd-ncf">—</span></div>
          <div class="bd-row"><span>− Mortgage</span><span id="bd-mortgage">—</span></div>
          <div class="bd-row"><span>− Misc Expenses</span><span id="bd-misc">—</span></div>
          <div class="bd-row bd-total"><span>= Annual Profit</span><span id="bd-profit">—</span></div>
          <div class="bd-row muted-row"><span>Debt Yield</span><span id="bd-dy">—</span></div>
        </div>

        <div id="stress-verdict" class="verdict">—</div>
        <div class="stress-note">Closing the modal applies these values to the row (except Misc Expenses, which has no row column). Expense & Occupancy snap to the nearest dropdown option.</div>
      </div>
    </div>
  </div>

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
