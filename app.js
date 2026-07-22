// =======================================
// Vacatory
// app.js — homepage
// =======================================

let firms = [];
let practiceAreasByFirm = new Map();
let rolesByFirm = new Map();
let searchTermsByFirm = new Map();

const favouritesKey = "vacatory-favourites";

document.addEventListener("DOMContentLoaded", () => {
  bindHomepageControls();
  loadFirms();
});

function bindHomepageControls() {
  const searchInput = document.getElementById("searchInput");
  const filterPracticeArea = document.getElementById("filterPracticeArea");
  const filterRole = document.getElementById("filterRole");
  const filterFirmType = document.getElementById("filterFirmType");
  const filterReset = document.getElementById("filterReset");
  const searchSubmit = document.querySelector(".search-submit");

  searchInput?.addEventListener("input", applyFilters);
  filterPracticeArea?.addEventListener("change", applyFilters);
  filterRole?.addEventListener("change", applyFilters);
  filterFirmType?.addEventListener("change", applyFilters);
  filterReset?.addEventListener("click", resetFilters);

  searchInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    applyFilters();

    document.getElementById("firms-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  searchSubmit?.addEventListener("click", applyFilters);
}

async function loadFirms() {
  const container = document.getElementById("firms");
  const count = document.getElementById("firmCount");

  if (!container) return;

  setLoadingState(container, count);

  if (typeof client === "undefined") {
    showFirmLoadError(
      container,
      count,
      "The database connection is not available."
    );
    return;
  }

  const { data, error } = await client
    .from("firms")
    .select(`
      id,
      name,
      short_name,
      slug,
      uk_rank,
      firm_type,
      circle_classification,
      head_office,
      head_office_city,
      head_office_country,
      logo_url,
      active
    `)
    .eq("active", true)
    .order("uk_rank", {
      ascending: true,
      nullsFirst: false
    })
    .order("name", {
      ascending: true
    });

  if (error) {
    console.error("Unable to load firms:", error);

    showFirmLoadError(
      container,
      count,
      "Unable to load firms at the moment."
    );

    return;
  }

  firms = data || [];

  displayFirms(firms);

  void loadUpcomingDeadlines();

  await loadDirectoryData();

  populateFilterOptions();
  applyFilters();
}

async function loadDirectoryData() {
  const firmIds = firms.map(firm => firm.id);

  practiceAreasByFirm = new Map();
  rolesByFirm = new Map();
  searchTermsByFirm = new Map();

  if (!firmIds.length) return;

  firmIds.forEach(firmId => {
    searchTermsByFirm.set(firmId, new Set());
  });

  const results = await Promise.allSettled([
    client
      .from("practice_areas")
      .select("firm_id, practice_area")
      .in("firm_id", firmIds),

    client
      .from("firm_roles_public_view")
      .select(`
        firm_id,
        role_name,
        role_group,
        student_relevance,
        confirmed,
        active
      `)
      .in("firm_id", firmIds)
      .eq("active", true)
      .eq("confirmed", true),

    client
      .from("locations")
      .select("firm_id, city, country")
      .in("firm_id", firmIds)
      .eq("active", true),

    client
      .from("opportunity_cards_view")
      .select(`
        firm_id,
        opportunity_name,
        opportunity_type_label,
        location_summary
      `)
      .in("firm_id", firmIds),

    client
      .from("training_contract_cards_view")
      .select(`
        firm_id,
        programme_name,
        programme_type_label,
        location_summary
      `)
      .in("firm_id", firmIds)
      .eq("active", true)
  ]);

  const [
    practiceResult,
    roleResult,
    locationResult,
    opportunityResult,
    trainingResult
  ] = results.map(getSettledQueryResult);

  addPracticeAreaData(practiceResult);
  addRoleData(roleResult);
  addLocationSearchData(locationResult);
  addOpportunitySearchData(opportunityResult);
  addTrainingContractSearchData(trainingResult);
}

function getSettledQueryResult(result) {
  if (result.status === "rejected") {
    console.warn(
      "Homepage supporting query failed:",
      result.reason
    );

    return [];
  }

  if (result.value?.error) {
    console.warn(
      "Homepage supporting query failed:",
      result.value.error
    );

    return [];
  }

  return result.value?.data || [];
}

function addPracticeAreaData(rows) {
  rows.forEach(row => {
    if (!row.firm_id || !row.practice_area) return;

    addToMapSet(
      practiceAreasByFirm,
      row.firm_id,
      row.practice_area
    );

    addSearchTerm(
      row.firm_id,
      row.practice_area
    );
  });
}

function addRoleData(rows) {
  const usefulRoleGroups = new Set([
    "entry_route",
    "legal_role",
    "knowledge_innovation",
    "business_services",
    "qualification_status",
    "programme"
  ]);

  rows.forEach(row => {
    if (!row.firm_id || !row.role_name) return;

    const usefulForStudents =
      usefulRoleGroups.has(row.role_group) ||
      ["primary", "strong", "context"].includes(
        row.student_relevance
      );

    if (usefulForStudents) {
      addToMapSet(
        rolesByFirm,
        row.firm_id,
        row.role_name
      );
    }

    addSearchTerm(
      row.firm_id,
      row.role_name
    );
  });
}

function addLocationSearchData(rows) {
  rows.forEach(row => {
    if (!row.firm_id) return;

    addSearchTerm(row.firm_id, row.city);
    addSearchTerm(row.firm_id, row.country);
  });
}

function addOpportunitySearchData(rows) {
  rows.forEach(row => {
    if (!row.firm_id) return;

    addSearchTerm(
      row.firm_id,
      row.opportunity_name
    );

    addSearchTerm(
      row.firm_id,
      row.opportunity_type_label
    );

    addSearchTerm(
      row.firm_id,
      row.location_summary
    );
  });
}

function addTrainingContractSearchData(rows) {
  rows.forEach(row => {
    if (!row.firm_id) return;

    addSearchTerm(
      row.firm_id,
      row.programme_name
    );

    addSearchTerm(
      row.firm_id,
      row.programme_type_label
    );

    addSearchTerm(
      row.firm_id,
      row.location_summary
    );
  });
}

function addToMapSet(map, key, value) {
  if (!value) return;

  if (!map.has(key)) {
    map.set(key, new Set());
  }

  map.get(key).add(value);
}

function addSearchTerm(firmId, value) {
  if (!firmId || !value) return;

  if (!searchTermsByFirm.has(firmId)) {
    searchTermsByFirm.set(
      firmId,
      new Set()
    );
  }

  searchTermsByFirm
    .get(firmId)
    .add(String(value));
}

function populateFilterOptions() {
  const allPracticeAreas = new Set();
  const allRoles = new Set();
  const allFirmTypes = new Set();

  practiceAreasByFirm.forEach(values => {
    values.forEach(value => {
      allPracticeAreas.add(value);
    });
  });

  rolesByFirm.forEach(values => {
    values.forEach(value => {
      allRoles.add(value);
    });
  });

  firms.forEach(firm => {
    if (firm.firm_type) {
      allFirmTypes.add(firm.firm_type);
    }
  });

  fillSelect(
    "filterPracticeArea",
    allPracticeAreas,
    "All practice areas"
  );

  fillSelect(
    "filterRole",
    allRoles,
    "All roles"
  );

  fillSelect(
    "filterFirmType",
    allFirmTypes,
    "All firm types"
  );
}

function fillSelect(
  id,
  valuesSet,
  placeholderText
) {
  const select = document.getElementById(id);

  if (!select) return;

  const currentValue = select.value;
  const fragment = document.createDocumentFragment();

  const placeholder = document.createElement("option");

  placeholder.value = "";
  placeholder.textContent = placeholderText;

  fragment.appendChild(placeholder);

  Array.from(valuesSet)
    .filter(Boolean)
    .sort((a, b) => {
      return a.localeCompare(
        b,
        "en-GB"
      );
    })
    .forEach(value => {
      const option = document.createElement("option");

      option.value = value;
      option.textContent = value;

      fragment.appendChild(option);
    });

  select.replaceChildren(fragment);

  const currentValueStillExists =
    Array.from(select.options).some(option => {
      return option.value === currentValue;
    });

  if (currentValueStillExists) {
    select.value = currentValue;
  }
}

function displayFirms(list) {
  const container = document.getElementById("firms");
  const count = document.getElementById("firmCount");

  if (!container) return;

  updateFirmCount(
    count,
    list.length
  );

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="eyebrow">No matches</p>

        <h3>No firms found</h3>

        <p>
          Try a broader search or clear the filters.
        </p>

        <button
          id="emptyStateReset"
          class="secondary-btn"
          type="button"
        >
          Clear filters
        </button>
      </div>
    `;

    document
      .getElementById("emptyStateReset")
      ?.addEventListener(
        "click",
        resetFilters
      );

    return;
  }

  const favourites = new Set(
    getFavourites()
  );

  const fragment =
    document.createDocumentFragment();

  list.forEach(firm => {
    const card = createFirmCard(
      firm,
      favourites
    );

    fragment.appendChild(card);
  });

  container.replaceChildren(fragment);
}

function createFirmCard(
  firm,
  favourites
) {
  const card = document.createElement("article");

  card.className = "firm-card";
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute(
    "aria-label",
    `Open ${firm.name}`
  );

  const firmId = String(firm.id);
  const isFavourite =
    favourites.has(firmId);

  const initial =
    (firm.short_name || firm.name || "V")
      .charAt(0)
      .toUpperCase();

  const logoMarkup = firm.logo_url
    ? `
      <img
        src="${escapeHtml(firm.logo_url)}"
        alt=""
      >
    `
    : `
      <span
        class="firm-logo-fallback"
        aria-hidden="true"
      >
        ${escapeHtml(initial)}
      </span>
    `;

  const firmType =
    firm.circle_classification ||
    firm.firm_type ||
    "Law firm";

  const rankMarkup = firm.uk_rank
    ? `
      <span class="firm-rank">
        UK #${escapeHtml(firm.uk_rank)}
      </span>
    `
    : `
      <span class="firm-rank">
        Firm profile
      </span>
    `;

  const location =
    formatFirmLocation(firm);

  const firmUrl =
    `firm.html?id=${encodeURIComponent(firm.id)}`;

  card.innerHTML = `
    <div class="firm-card-header">

      <div
        class="firm-logo"
        aria-label="${escapeHtml(firm.name)}"
      >
        ${logoMarkup}
      </div>

      <button
        class="star ${isFavourite ? "active" : ""}"
        type="button"
        aria-label="${
          isFavourite ? "Remove" : "Add"
        } ${escapeHtml(firm.name)} ${
          isFavourite ? "from" : "to"
        } favourites"
        aria-pressed="${isFavourite}"
        title="${
          isFavourite
            ? "Remove from favourites"
            : "Add to favourites"
        }"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2 4.5 5.6 4c2-.3 3.9.7 5 2.3C11.7 4.7 13.6 3.7 15.6 4c3.6.5 5.1 4.2 3.6 7.7C16.7 16.4 12 21 12 21z"></path>
        </svg>
      </button>

    </div>

    <div class="firm-card-copy">

      <div class="firm-card-kicker">
        ${rankMarkup}

        <span aria-hidden="true">·</span>

        <span>
          ${escapeHtml(firmType)}
        </span>
      </div>

      <h3>
        ${escapeHtml(firm.name)}
      </h3>

      <p class="firm-location">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path>
          <circle cx="12" cy="10" r="2.4"></circle>
        </svg>

        ${escapeHtml(location)}
      </p>

    </div>

    <a
      href="${firmUrl}"
      class="firm-link"
    >
      View firm

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 6l6 6-6 6"></path>
      </svg>
    </a>
  `;

  const star =
    card.querySelector(".star");

  star?.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      const nowFavourite =
        toggleFavourite(firm.id);

      star.classList.toggle(
        "active",
        nowFavourite
      );

      star.setAttribute(
        "aria-pressed",
        String(nowFavourite)
      );

      star.setAttribute(
        "aria-label",
        `${
          nowFavourite
            ? "Remove"
            : "Add"
        } ${firm.name} ${
          nowFavourite
            ? "from"
            : "to"
        } favourites`
      );

      star.title = nowFavourite
        ? "Remove from favourites"
        : "Add to favourites";
    }
  );

  const logoImage =
    card.querySelector(".firm-logo img");

  logoImage?.addEventListener(
    "error",
    () => {
      const logoContainer =
        card.querySelector(".firm-logo");

      if (!logoContainer) return;

      logoContainer.innerHTML = `
        <span
          class="firm-logo-fallback"
          aria-hidden="true"
        >
          ${escapeHtml(initial)}
        </span>
      `;
    }
  );

  card.addEventListener(
    "click",
    event => {
      if (
        event.target.closest("a") ||
        event.target.closest("button")
      ) {
        return;
      }

      window.location.href = firmUrl;
    }
  );

  card.addEventListener(
    "keydown",
    event => {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      if (
        event.target.closest("a") ||
        event.target.closest("button")
      ) {
        return;
      }

      event.preventDefault();

      window.location.href = firmUrl;
    }
  );

  return card;
}

function formatFirmLocation(firm) {
  const city =
    firm.head_office_city?.trim();

  const country =
    firm.head_office_country?.trim();

  if (city && country) {
    return `${city}, ${country}`;
  }

  if (city) return city;
  if (country) return country;

  return firm.head_office ||
    "United Kingdom";
}

function updateFirmCount(
  element,
  total
) {
  if (!element) return;

  element.textContent =
    total === 1
      ? "1 firm"
      : `${total} firms`;
}

function applyFilters() {
  const search = normalizeText(
    document
      .getElementById("searchInput")
      ?.value || ""
  );

  const practiceArea =
    document
      .getElementById("filterPracticeArea")
      ?.value || "";

  const role =
    document
      .getElementById("filterRole")
      ?.value || "";

  const firmType =
    document
      .getElementById("filterFirmType")
      ?.value || "";

  const filterReset =
    document.getElementById("filterReset");

  const filtered = firms.filter(firm => {
    const firmPracticeAreas =
      practiceAreasByFirm.get(firm.id) ||
      new Set();

    const firmRoles =
      rolesByFirm.get(firm.id) ||
      new Set();

    const extraTerms =
      searchTermsByFirm.get(firm.id) ||
      new Set();

    const searchableText =
      normalizeText(
        [
          firm.name,
          firm.short_name,
          firm.firm_type,
          firm.circle_classification,
          firm.head_office,
          firm.head_office_city,
          firm.head_office_country,
          firm.uk_rank,
          ...extraTerms
        ]
          .filter(Boolean)
          .join(" ")
      );

    const matchesSearch =
      !search ||
      searchableText.includes(search);

    const matchesPracticeArea =
      !practiceArea ||
      firmPracticeAreas.has(
        practiceArea
      );

    const matchesRole =
      !role ||
      firmRoles.has(role);

    const matchesFirmType =
      !firmType ||
      firm.firm_type === firmType;

    return (
      matchesSearch &&
      matchesPracticeArea &&
      matchesRole &&
      matchesFirmType
    );
  });

  const anyFilterActive = Boolean(
    search ||
    practiceArea ||
    role ||
    firmType
  );

  filterReset?.classList.toggle(
    "hidden",
    !anyFilterActive
  );

  displayFirms(filtered);
}

function resetFilters() {
  const searchInput =
    document.getElementById("searchInput");

  const filterPracticeArea =
    document.getElementById(
      "filterPracticeArea"
    );

  const filterRole =
    document.getElementById("filterRole");

  const filterFirmType =
    document.getElementById(
      "filterFirmType"
    );

  if (searchInput) {
    searchInput.value = "";
  }

  if (filterPracticeArea) {
    filterPracticeArea.value = "";
  }

  if (filterRole) {
    filterRole.value = "";
  }

  if (filterFirmType) {
    filterFirmType.value = "";
  }

  applyFilters();
  searchInput?.focus();
}

async function loadUpcomingDeadlines() {
  const deadlineList =
    document.getElementById(
      "deadlinePreviewList"
    ) ||
    document.querySelector(
      ".deadline-list"
    );

  if (
    !deadlineList ||
    typeof client === "undefined"
  ) {
    return;
  }

  deadlineList.innerHTML = `
    <article class="deadline-row deadline-row-loading">
      <div>
        <strong>
          Loading deadlines…
        </strong>

        <span>
          Checking the latest published dates
        </span>
      </div>
    </article>
  `;

  const today =
    getTodayIsoDate();

  const results =
    await Promise.allSettled([
      client
        .from(
          "opportunity_deadlines_view"
        )
        .select(`
          firm_id,
          firm_name,
          opportunity_name,
          opportunity_type_label,
          deadline,
          application_status,
          application_url
        `)
        .gte("deadline", today)
        .order(
          "deadline",
          { ascending: true }
        )
        .limit(12),

      client
        .from(
          "training_contract_deadlines_view"
        )
        .select(`
          firm_id,
          firm_name,
          programme_name,
          programme_type,
          application_deadline,
          application_status,
          application_link
        `)
        .gte(
          "application_deadline",
          today
        )
        .order(
          "application_deadline",
          { ascending: true }
        )
        .limit(12)
    ]);

  const opportunityRows =
    getSettledQueryResult(results[0]);

  const trainingRows =
    getSettledQueryResult(results[1]);

  const activeFirmIds = new Set(
    firms.map(firm => {
      return String(firm.id);
    })
  );

  const deadlines = [
    ...opportunityRows.map(item => ({
      firmId: String(
        item.firm_id || ""
      ),

      firmName:
        item.firm_name ||
        "Law firm",

      type:
        item.opportunity_name ||
        item.opportunity_type_label ||
        "Opportunity",

      date: item.deadline,

      status:
        item.application_status,

      url:
        item.application_url
    })),

    ...trainingRows.map(item => ({
      firmId: String(
        item.firm_id || ""
      ),

      firmName:
        item.firm_name ||
        "Law firm",

      type:
        item.programme_name ||
        "Training contract",

      date:
        item.application_deadline,

      status:
        item.application_status,

      url:
        item.application_link
    }))
  ].filter(item => {
    return (
      item.date &&
      activeFirmIds.has(item.firmId) &&
      item.status !== "closed" &&
      item.status !== "passed"
    );
  });

  const uniqueDeadlines =
    Array.from(
      new Map(
        deadlines.map(item => [
          [
            item.firmId,
            normalizeText(item.type),
            item.date
          ].join("|"),

          item
        ])
      ).values()
    )
      .sort((a, b) => {
        return a.date.localeCompare(
          b.date
        );
      })
      .slice(0, 4);

  if (!uniqueDeadlines.length) {
    deadlineList.innerHTML = `
      <article class="deadline-row">
        <div>
          <strong>
            Dates being refreshed
          </strong>

          <span>
            New application deadlines will appear here.
          </span>
        </div>
      </article>
    `;

    return;
  }

  deadlineList.innerHTML =
    uniqueDeadlines
      .map(item => {
        const daysRemaining =
          daysUntil(item.date);

        const urgencyClass =
          daysRemaining !== null &&
          daysRemaining <= 7
            ? " deadline-row-urgent"
            : "";

        return `
          <article class="deadline-row${urgencyClass}">

            <div>
              <strong>
                ${escapeHtml(item.firmName)}
              </strong>

              <span>
                ${escapeHtml(item.type)}
              </span>
            </div>

            <time datetime="${escapeHtml(item.date)}">
              ${escapeHtml(
                formatDate(
                  item.date,
                  false
                )
              )}
            </time>

          </article>
        `;
      })
      .join("");
}

function getFavourites() {
  try {
    const value = JSON.parse(
      localStorage.getItem(
        favouritesKey
      ) || "[]"
    );

    return Array.isArray(value)
      ? value.map(String)
      : [];
  } catch {
    return [];
  }
}

function toggleFavourite(firmId) {
  const id = String(firmId);

  const favourites = new Set(
    getFavourites()
  );

  if (favourites.has(id)) {
    favourites.delete(id);
  } else {
    favourites.add(id);
  }

  localStorage.setItem(
    favouritesKey,
    JSON.stringify(
      Array.from(favourites)
    )
  );

  return favourites.has(id);
}

function setLoadingState(
  container,
  count
) {
  container.innerHTML = `
    <div
      class="loading-state"
      role="status"
    >
      <span
        class="loading-dot"
        aria-hidden="true"
      ></span>

      <span
        class="loading-dot"
        aria-hidden="true"
      ></span>

      <span
        class="loading-dot"
        aria-hidden="true"
      ></span>

      <span class="sr-only">
        Loading firms
      </span>
    </div>
  `;

  if (count) {
    count.textContent =
      "Loading firms…";
  }
}

function showFirmLoadError(
  container,
  count,
  message
) {
  container.innerHTML = `
    <div class="empty-state">

      <p class="eyebrow">
        Connection problem
      </p>

      <h3>
        Firms could not be loaded
      </h3>

      <p>
        ${escapeHtml(message)}
      </p>

      <button
        id="retryFirmLoad"
        class="secondary-btn"
        type="button"
      >
        Try again
      </button>

    </div>
  `;

  if (count) {
    count.textContent =
      "Unable to load firms";
  }

  document
    .getElementById("retryFirmLoad")
    ?.addEventListener(
      "click",
      loadFirms
    );
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function getTodayIsoDate() {
  const now = new Date();

  const offset =
    now.getTimezoneOffset();

  const localDate = new Date(
    now.getTime() -
    offset * 60_000
  );

  return localDate
    .toISOString()
    .slice(0, 10);
}

function parseDateOnly(value) {
  if (!value) return null;

  const date = new Date(
    `${value}T00:00:00`
  );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function daysUntil(value) {
  const date =
    parseDateOnly(value);

  const today =
    parseDateOnly(
      getTodayIsoDate()
    );

  if (!date || !today) {
    return null;
  }

  return Math.ceil(
    (
      date.getTime() -
      today.getTime()
    ) / 86_400_000
  );
}

function formatDate(
  value,
  includeYear = true
) {
  const date =
    parseDateOnly(value);

  if (!date) {
    return value || "";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      ...(includeYear
        ? { year: "numeric" }
        : {})
    }
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
