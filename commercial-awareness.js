// ======================================
// Vacatory: Commercial Awareness page
// ======================================

let allNews = [];
let allFirms = [];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function loadCommercialNews() {
  const loadingEl = document.getElementById("newsLoading");
  const emptyEl = document.getElementById("newsEmpty");
  const feedEl = document.getElementById("newsFeed");

  try {
    const [newsResult, firmsResult] = await Promise.all([
      client
        .from("commercial_news")
        .select("id, firm_id, headline, summary, url, published_date, firms(name, logo_url)")
        .order("published_date", { ascending: false }),
      client.from("firms").select("id, name").order("name", { ascending: true }),
    ]);

    if (newsResult.error) throw newsResult.error;

    allNews = newsResult.data || [];
    allFirms = firmsResult.data || [];

    populateFirmFilter();
    renderNews();
  } catch (err) {
    console.error("Failed to load commercial news:", err);
    loadingEl.textContent = "Something went wrong loading the news. Try refreshing the page.";
  }
}

function populateFirmFilter() {
  const select = document.getElementById("firmFilter");
  const firmsWithNews = new Set(allNews.map((n) => n.firm_id));
  const relevantFirms = allFirms.filter((f) => firmsWithNews.has(f.id));

  relevantFirms.forEach((firm) => {
    const opt = document.createElement("option");
    opt.value = firm.id;
    opt.textContent = firm.name;
    select.appendChild(opt);
  });
}

function renderNews() {
  const loadingEl = document.getElementById("newsLoading");
  const emptyEl = document.getElementById("newsEmpty");
  const feedEl = document.getElementById("newsFeed");

  const searchTerm = document.getElementById("newsSearch").value.trim().toLowerCase();
  const firmId = document.getElementById("firmFilter").value;
  const dateRange = document.getElementById("dateFilter").value;

  let filtered = allNews;

  if (firmId) {
    filtered = filtered.filter((n) => n.firm_id === firmId);
  }

  if (searchTerm) {
    filtered = filtered.filter((n) =>
      (n.headline || "").toLowerCase().includes(searchTerm) ||
      (n.summary || "").toLowerCase().includes(searchTerm) ||
      (n.firms && n.firms.name || "").toLowerCase().includes(searchTerm)
    );
  }

  if (dateRange) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(dateRange, 10));
    filtered = filtered.filter((n) => n.published_date && new Date(n.published_date) >= cutoff);
  }

  loadingEl.hidden = true;

  if (filtered.length === 0) {
    emptyEl.hidden = false;
    feedEl.innerHTML = "";
    return;
  }

  emptyEl.hidden = true;
  feedEl.innerHTML = filtered.map(renderCard).join("");
}

function renderCard(item) {
  const firmName = item.firms ? item.firms.name : "Unknown firm";
  const logoUrl = item.firms && item.firms.logo_url;
  const date = item.published_date ? new Date(item.published_date) : null;
  const day = date ? date.getDate() : "";
  const month = date ? MONTHS[date.getMonth()] : "";

  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="">`
    : "";

  return `
<article class="ca-card">
<div class="ca-card-date">
<span class="day">${day}</span>
<span class="month">${month}</span>
</div>
<div class="ca-card-body">
<div class="ca-card-firm">
${logoHtml}
<span>${escapeHtml(firmName)}</span>
</div>
<h3><a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noopener">${escapeHtml(item.headline || "Untitled")}</a></h3>
${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
${item.url ? `<a class="ca-card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Read on ${escapeHtml(firmName)}'s site →</a>` : ""}
</div>
</article>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
  loadCommercialNews();

  document.getElementById("newsSearch").addEventListener("input", renderNews);
  document.getElementById("firmFilter").addEventListener("change", renderNews);
  document.getElementById("dateFilter").addEventListener("change", renderNews);
});
