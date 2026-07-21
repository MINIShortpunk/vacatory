// =======================================
// Vacatory
// app.js — homepage
// =======================================

let firms = [];
let practiceAreasByFirm = new Map();
let rolesByFirm = new Map();

const favouritesKey = "vacatory-favourites";

document.addEventListener("DOMContentLoaded", () => {
  loadFirms();

  const searchInput = document.getElementById("searchInput");
  const filterPracticeArea = document.getElementById("filterPracticeArea");
  const filterRole = document.getElementById("filterRole");
  const filterFirmType = document.getElementById("filterFirmType");
  const filterReset = document.getElementById("filterReset");

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (filterPracticeArea) filterPracticeArea.addEventListener("change", applyFilters);
  if (filterRole) filterRole.addEventListener("change", applyFilters);
  if (filterFirmType) filterFirmType.addEventListener("change", applyFilters);

  if (filterReset) {
    filterReset.addEventListener("click", () => {
      searchInput.value = "";
      filterPracticeArea.value = "";
      filterRole.value = "";
      filterFirmType.value = "";
      applyFilters();
    });
  }
});

async function loadFirms() {
  const container = document.getElementById("firms");
  const count = document.getElementById("firmCount");

  if (!container) return;

  container.innerHTML = "<p class='loading'>Loading firms...</p>";
  if (count) count.textContent = "Loading firms...";

  const { data, error } = await client
    .from("firms")
    .select("*")
    .eq("active", true)
    .order("uk_rank", { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML = "<p class='loading'>Unable to load firms.</p>";
    if (count) count.textContent = "Something went wrong loading firms.";
    return;
  }

  firms = data || [];

  await loadFilterData();
  populateFilterOptions();
  displayFirms(firms);
  loadUpcomingDeadlines();
}

async function loadFilterData() {
  const firmIds = firms.map(firm => firm.id);
  if (!firmIds.length) return;

  const [practiceResult, roleResult] = await Promise.all([
    client
      .from("practice_areas")
      .select("firm_id, practice_area")
      .in("firm_id", firmIds),

    client
      .from("firm_roles")
      .select("firm_id, role_name")
      .in("firm_id", firmIds)
  ]);

  practiceAreasByFirm = new Map();
  rolesByFirm = new Map();

  if (!practiceResult.error && practiceResult.data) {
    practiceResult.data.forEach(row => {
      if (!practiceAreasByFirm.has(row.firm_id)) {
        practiceAreasByFirm.set(row.firm_id, new Set());
      }
      if (row.practice_area) {
        practiceAreasByFirm.get(row.firm_id).add(row.practice_area);
      }
    });
  }

  if (!roleResult.error && roleResult.data) {
    roleResult.data.forEach(row => {
      if (!rolesByFirm.has(row.firm_id)) {
        rolesByFirm.set(row.firm_id, new Set());
      }
      if (row.role_name) {
        rolesByFirm.get(row.firm_id).add(row.role_name);
      }
    });
  }
}

function populateFilterOptions() {
  const allPracticeAreas = new Set();
  const allRoles = new Set();
  const allFirmTypes = new Set();

  practiceAreasByFirm.forEach(set => {
    set.forEach(value => allPracticeAreas.add(value));
  });

  rolesByFirm.forEach(set => {
    set.forEach(value => allRoles.add(value));
  });

  firms.forEach(firm => {
    if (firm.firm_type) allFirmTypes.add(firm.firm_type);
  });

  fillSelect("filterPracticeArea", allPracticeAreas, "All practice areas");
  fillSelect("filterRole", allRoles, "All roles");
  fillSelect("filterFirmType", allFirmTypes, "All firm types");
}

function fillSelect(id, valuesSet, placeholderText) {
  const select = document.getElementById(id);
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = `<option value="">${placeholderText}</option>`;

  Array.from(valuesSet)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

  select.value = currentValue;
}

function displayFirms(list) {
  const container = document.getElementById("firms");
  const count = document.getElementById("firmCount");

  if (!container) return;

  if (count) {
    count.textContent = list.length === 1
      ? "Showing 1 firm"
      : `Showing ${list.length} firms`;
  }

  if (!list.length) {
    container.innerHTML = "<p class='loading'>No firms found. Try clearing the filters.</p>";
    return;
  }

  const favourites = getFavourites();

  container.innerHTML = "";

  list.forEach(firm => {
    const card = document.createElement("article");
    card.className = "firm-card";

    const isFavourite = favourites.includes(String(firm.id));
    const initial = (firm.short_name || firm.name || "V").charAt(0).toUpperCase();

    const logo = firm.logo_url
      ? `<img src="${escapeHtml(firm.logo_url)}" alt="${escapeHtml(firm.name)} logo">`
      : escapeHtml(initial);

    const firmType = firm.firm_type || "Commercial law";
    const location = firm.head_office || "United Kingdom";
    const rankText = firm.uk_rank ? `Rank #${firm.uk_rank}` : "Firm profile";

    card.innerHTML = `
      <div class="firm-card-header">
        <div class="firm-logo">
          ${logo}
        </div>

        <button class="star ${isFavourite ? "active" : ""}" type="button" aria-label="Favourite ${escapeHtml(firm.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2 4.5 5.6 4c2-.3 3.9.7 5 2.3C11.7 4.7 13.6 3.7 15.6 4c3.6.5 5.1 4.2 3.6 7.7C16.7 16.4 12 21 12 21z"></path>
          </svg>
        </button>
      </div>

      <h3>${escapeHtml(firm.name)}</h3>

      <p class="firm-type">${escapeHtml(firmType)} · ${escapeHtml(rankText)}</p>

      <div class="firm-details">
        <p class="firm-location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path>
            <circle cx="12" cy="10" r="2.4"></circle>
          </svg>
          ${escapeHtml(location)}
        </p>
      </div>

      <a href="firm.html?id=${encodeURIComponent(firm.id)}" class="firm-link">
        View firm
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6"></path>
        </svg>
      </a>
    `;

    const star = card.querySelector(".star");

    star.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      toggleFavourite(firm.id);
      star.classList.toggle("active");
    });

    card.addEventListener("click", event => {
      if (event.target.closest("a") || event.target.closest("button")) return;
      window.location.href = `firm.html?id=${encodeURIComponent(firm.id)}`;
    });

    container.appendChild(card);
  });
}

function applyFilters() {
  const search = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
  const practiceArea = document.getElementById("filterPracticeArea")?.value || "";
  const role = document.getElementById("filterRole")?.value || "";
  const firmType = document.getElementById("filterFirmType")?.value || "";
  const filterReset = document.getElementById("filterReset");

  const filtered = firms.filter(firm => {
    const firmPracticeAreas = practiceAreasByFirm.get(firm.id) || new Set();
    const firmRoles = rolesByFirm.get(firm.id) || new Set();

    const matchesSearch = !search ||
      (firm.name || "").toLowerCase().includes(search) ||
      (firm.short_name || "").toLowerCase().includes(search) ||
      (firm.firm_type || "").toLowerCase().includes(search) ||
      (firm.head_office || "").toLowerCase().includes(search) ||
      String(firm.uk_rank || "").includes(search);

    const matchesPracticeArea = !practiceArea || firmPracticeAreas.has(practiceArea);
    const matchesRole = !role || firmRoles.has(role);
    const matchesFirmType = !firmType || firm.firm_type === firmType;

    return matchesSearch && matchesPracticeArea && matchesRole && matchesFirmType;
  });

  const anyFilterActive = Boolean(search || practiceArea || role || firmType);
  if (filterReset) filterReset.classList.toggle("hidden", !anyFilterActive);

  displayFirms(filtered);
}

async function loadUpcomingDeadlines() {
  const deadlineList = document.querySelector(".deadline-list");
  if (!deadlineList || !firms.length) return;

  const firmNames = new Map();
  firms.forEach(firm => firmNames.set(firm.id, firm.name));

  const [vacationResult, trainingResult] = await Promise.all([
    client
      .from("vacation_schemes")
      .select("firm_id, scheme_name, deadline, status"),

    client
      .from("training_contracts")
      .select("firm_id, application_deadline, intake_year, status")
  ]);

  const deadlines = [];

  if (!vacationResult.error && vacationResult.data) {
    vacationResult.data.forEach(item => {
      if (!item.deadline) return;

      deadlines.push({
        firmName: firmNames.get(item.firm_id) || "Firm",
        type: item.scheme_name || "Vacation scheme",
        date: item.deadline
      });
    });
  }

  if (!trainingResult.error && trainingResult.data) {
    trainingResult.data.forEach(item => {
      if (!item.application_deadline) return;

      deadlines.push({
        firmName: firmNames.get(item.firm_id) || "Firm",
        type: item.intake_year ? `Training contract · ${item.intake_year}` : "Training contract",
        date: item.application_deadline
      });
    });
  }

  const upcoming = deadlines
    .filter(item => Boolean(item.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);

  if (!upcoming.length) {
    deadlineList.innerHTML = `
      <article class="deadline-row">
        <div>
          <strong>Deadlines coming soon</strong>
          <span>Add vacation scheme and training contract dates to show them here.</span>
        </div>
      </article>
    `;
    return;
  }

  deadlineList.innerHTML = upcoming.map(item => `
    <article class="deadline-row">
      <div>
        <strong>${escapeHtml(item.firmName)}</strong>
        <span>${escapeHtml(item.type)}</span>
      </div>
      <p>${formatDate(item.date)}</p>
    </article>
  `).join("");
}

function getFavourites() {
  try {
    return JSON.parse(localStorage.getItem(favouritesKey)) || [];
  } catch {
    return [];
  }
}

function toggleFavourite(firmId) {
  const id = String(firmId);
  const favourites = getFavourites();

  const updated = favourites.includes(id)
    ? favourites.filter(item => item !== id)
    : [...favourites, id];

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
