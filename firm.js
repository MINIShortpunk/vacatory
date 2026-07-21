// =======================================
// Vacatory
// firm.js — firm profile page
// =======================================

const params = new URLSearchParams(window.location.search);
const firmId = params.get("id");
const favouritesKey = "vacatory-favourites";

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();

  if (!firmId) {
    showError();
    return;
  }

  loadFirm();
});

function showError() {
  document.getElementById("loadingState")?.classList.add("hidden");
  document.getElementById("errorState")?.classList.remove("hidden");
}

async function loadFirm() {
  const { data: firm, error } = await client
    .from("firms")
    .select("*")
    .eq("id", firmId)
    .single();

  if (error || !firm) {
    console.error(error);
    showError();
    return;
  }

  document.title = `${firm.name} — Vacatory`;

  const firmLogo = document.getElementById("firmLogo");
  const firmName = document.getElementById("firmName");
  const firmType = document.getElementById("firmType");
  const firmOverview = document.getElementById("firmOverview");
  const firmMeta = document.getElementById("firmMeta");

  if (firmLogo) {
    firmLogo.innerHTML = firm.logo_url
      ? `<img src="${escapeHtml(firm.logo_url)}" alt="${escapeHtml(firm.name)} logo">`
      : escapeHtml((firm.short_name || firm.name || "V").charAt(0).toUpperCase());
  }

  if (firmName) firmName.textContent = firm.name || "Firm";
  if (firmType) firmType.textContent = firm.firm_type || "";
  if (firmOverview) {
    firmOverview.textContent = firm.overview || "Overview not yet available.";
  }

  if (firmMeta) {
    firmMeta.innerHTML = "";

    if (firm.head_office) {
      firmMeta.innerHTML += metaPill(locationIcon(), firm.head_office);
    }

    if (firm.uk_rank) {
      firmMeta.innerHTML += metaPill(rankIcon(), `UK Rank #${firm.uk_rank}`);
    }

    if (firm.website) {
      firmMeta.innerHTML += metaPill(linkIcon(), "Website listed");
    }
  }

  setText("ov-size", firm.firm_size || "Not yet available");
  setText("ov-secondments", firm.secondments || "Not yet available");
  setText("ov-scholarships", firm.scholarships || "Not yet available");

  const links = document.getElementById("ov-links");
  if (links) {
    links.innerHTML = "";

    if (firm.website) links.innerHTML += profileLink(firm.website, "Firm website");
    if (firm.careers_url) links.innerHTML += profileLink(firm.careers_url, "Careers page");
    if (firm.linkedin) links.innerHTML += profileLink(firm.linkedin, "LinkedIn");
  }

  setupFavouriteButton();

  document.getElementById("loadingState")?.classList.add("hidden");
  document.getElementById("profileContent")?.classList.remove("hidden");

  loadPracticeAreas();
  loadRoles();
  loadLocations();
  loadVacationSchemes(firm.careers_url);
  loadTrainingContracts(firm.careers_url);
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach(item => item.classList.remove("active"));
      panels.forEach(panel => panel.classList.remove("active"));

      tab.classList.add("active");

      const panel = document.getElementById(`tab-${target}`);
      if (panel) panel.classList.add("active");
    });
  });
}

function setupFavouriteButton() {
  const favBtn = document.getElementById("favouriteBtn");
  if (!favBtn) return;

  const favourites = getFavourites();

  if (favourites.includes(String(firmId))) {
    favBtn.classList.add("active");
  }

  favBtn.addEventListener("click", () => {
    toggleFavourite(firmId);
    favBtn.classList.toggle("active");
  });
}

async function loadPracticeAreas() {
  const container = document.getElementById("practiceAreasList");
  if (!container) return;

  const { data, error } = await client
    .from("practice_areas")
    .select("practice_area, description, featured")
    .eq("firm_id", firmId)
    .order("featured", { ascending: false })
    .order("practice_area", { ascending: true });

  if (error || !data || !data.length) {
    container.innerHTML = "<p class='loading'>No practice areas listed yet.</p>";
    return;
  }

  container.innerHTML = data.map(area => `
    <article class="profile-card">
      <h3>
        ${escapeHtml(area.practice_area)}
        ${area.featured ? '<span class="featured-tag">Featured</span>' : ""}
      </h3>
      ${area.description ? `<p>${escapeHtml(area.description)}</p>` : ""}
    </article>
  `).join("");
}

async function loadRoles() {
  const container = document.getElementById("rolesList");
  if (!container) return;

  const { data, error } = await client
    .from("firm_roles")
    .select("role_name, confirmed")
    .eq("firm_id", firmId)
    .order("role_name", { ascending: true });

  if (error || !data || !data.length) {
    container.innerHTML = "<p class='loading'>No role data listed yet.</p>";
    return;
  }

  const uniqueRoles = [...new Set(
    data
      .map(role => role.role_name)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  container.innerHTML = `
    <ul class="simple-role-list">
      ${uniqueRoles.map(role => `
        <li>${escapeHtml(role)}</li>
      `).join("")}
    </ul>
  `;
}

async function loadLocations() {
  const container = document.getElementById("locationsList");
  if (!container) return;

  const { data, error } = await client
    .from("locations")
    .select("city, country, office_type, region, offers_vacation_scheme, offers_training_contract")
    .eq("firm_id", firmId)
    .order("city", { ascending: true });

  if (error || !data || !data.length) {
    container.innerHTML = "<p class='loading'>No locations listed yet.</p>";
    return;
  }

  container.innerHTML = data.map(location => `
    <article class="profile-card">
      <h3>${escapeHtml(location.city)}${location.country ? `, ${escapeHtml(location.country)}` : ""}</h3>

      ${location.office_type || location.region ? `
        <p>
          ${escapeHtml(location.office_type || "Office")}
          ${location.region ? ` — ${escapeHtml(location.region)}` : ""}
        </p>
      ` : ""}

      <div class="location-tags">
        ${location.offers_vacation_scheme ? '<span class="status-pill">Vacation scheme</span>' : ""}
        ${location.offers_training_contract ? '<span class="status-pill">Training contract</span>' : ""}
      </div>
    </article>
  `).join("");
}

async function loadVacationSchemes(careersUrl) {
  const container = document.getElementById("vacationSchemesList");
  if (!container) return;

  const { data, error } = await client
    .from("vacation_schemes")
    .select("*")
    .eq("firm_id", firmId)
    .order("deadline", { ascending: true });

  if (error || !data || !data.length) {
    container.innerHTML = careersUrl
      ? `<p class='loading'>No vacation scheme data listed yet. ${profileLink(careersUrl, "Visit careers page")}</p>`
      : "<p class='loading'>No vacation scheme data listed yet.</p>";
    return;
  }

  container.innerHTML = data.map(scheme => `
    <article class="profile-card application-card">
      <h3>${escapeHtml(scheme.scheme_name || "Vacation scheme")}</h3>

      ${scheme.scheme_type || scheme.location ? `
        <p>${escapeHtml(scheme.scheme_type || "")}${scheme.location ? ` — ${escapeHtml(scheme.location)}` : ""}</p>
      ` : ""}

      <div class="profile-fact-grid">
        ${fact("Opens", formatDate(scheme.opens_on))}
        ${fact("Deadline", formatDate(scheme.deadline))}
        ${fact("Duration", scheme.duration)}
        ${fact("Salary", scheme.salary)}
        ${fact("Status", scheme.status)}
      </div>

      ${scheme.eligibility ? `
        <p class="profile-eligibility">
          <strong>Eligibility:</strong> ${escapeHtml(scheme.eligibility)}
        </p>
      ` : ""}

      ${(scheme.application_link || careersUrl) ? profileLink(scheme.application_link || careersUrl, "Apply / more info") : ""}
    </article>
  `).join("");
}

async function loadTrainingContracts(careersUrl) {
  const container = document.getElementById("trainingContractList");
  if (!container) return;

  const { data, error } = await client
    .from("training_contracts")
    .select("*")
    .eq("firm_id", firmId)
    .order("application_deadline", { ascending: true });

  if (error || !data || !data.length) {
    container.innerHTML = careersUrl
      ? `<p class='loading'>No training contract data listed yet. ${profileLink(careersUrl, "Visit careers page")}</p>`
      : "<p class='loading'>No training contract data listed yet.</p>";
    return;
  }

  container.innerHTML = data.map(contract => `
    <article class="profile-card application-card">
      <h3>Training contract${contract.intake_year ? ` — ${escapeHtml(contract.intake_year)} intake` : ""}</h3>

      ${contract.location ? `<p>${escapeHtml(contract.location)}</p>` : ""}

      <div class="profile-fact-grid">
        ${fact("Applications open", formatDate(contract.application_open))}
        ${fact("Deadline", formatDate(contract.application_deadline))}
        ${fact("Start date", formatDate(contract.start_date))}
        ${fact("Year 1 salary", formatMoney(contract.salary_first_year))}
        ${fact("Year 2 salary", formatMoney(contract.salary_second_year))}
        ${fact("NQ salary", formatMoney(contract.salary_qualification))}
        ${fact("Seats", contract.seats)}
        ${fact("Status", contract.status)}
      </div>

      ${contract.eligibility ? `
        <p class="profile-eligibility">
          <strong>Eligibility:</strong> ${escapeHtml(contract.eligibility)}
        </p>
      ` : ""}

      ${(contract.application_link || careersUrl) ? profileLink(contract.application_link || careersUrl, "Apply / more info") : ""}
    </article>
  `).join("");
}

function fact(label, value) {
  if (!value) return "";

  return `
    <div class="fact">
      <span class="fact-label">${escapeHtml(label)}</span>
      <span class="fact-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function profileLink(url, label) {
  if (!url) return "";

  return `
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="firm-link profile-external-link">
      ${escapeHtml(label)}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M7 17L17 7M7 7h10v10"></path>
      </svg>
    </a>
  `;
}

function metaPill(icon, text) {
  return `<span class="profile-meta-pill">${icon}${escapeHtml(text)}</span>`;
}

function locationIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path>
      <circle cx="12" cy="10" r="2.4"></circle>
    </svg>
  `;
}

function rankIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7-5.4-4.7 7.1-.6z"></path>
    </svg>
  `;
}

function linkIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L11 4.9"></path>
      <path d="M14 11a5 5 0 0 0-7.1 0L4.8 13.1a5 5 0 0 0 7.1 7.1L13 19.1"></path>
    </svg>
  `;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function getFavourites() {
  try {
    return JSON.parse(localStorage.getItem(favouritesKey)) || [];
  } catch {
    return [];
  }
}

function toggleFavourite(id) {
  const firmIdString = String(id);
  const favourites = getFavourites();

  const updated = favourites.includes(firmIdString)
    ? favourites.filter(item => item !== firmIdString)
    : [...favourites, firmIdString];

  localStorage.setItem(favouritesKey, JSON.stringify(updated));
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (isNaN(date)) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "";

  const number = Number(value);
  if (isNaN(number)) return value;

  return `£${number.toLocaleString("en-GB")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
