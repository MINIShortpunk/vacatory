// =======================================
// Vacatory
// app.js — public homepage
// =======================================

let firms = [];

let practiceAreasByFirm = new Map();
let rolesByFirm = new Map();
let searchTermsByFirm = new Map();

document.addEventListener("DOMContentLoaded", () => {
  bindHomepageControls();
  void initialiseHomepage();
});

async function initialiseHomepage() {
  await Promise.all([
    loadFirms(),
    loadUpcomingDeadlines()
  ]);
}

/* =======================================
   Homepage controls
======================================= */

function bindHomepageControls() {
  const searchInput =
    document.getElementById("searchInput");

  const filterPracticeArea =
    document.getElementById("filterPracticeArea");

  const filterRole =
    document.getElementById("filterRole");

  const filterFirmType =
    document.getElementById("filterFirmType");

  const filterReset =
    document.getElementById("filterReset");

  searchInput?.addEventListener(
    "input",
    debounce(applyFilters, 180)
  );

  filterPracticeArea?.addEventListener(
    "change",
    applyFilters
  );

  filterRole?.addEventListener(
    "change",
    applyFilters
  );

  filterFirmType?.addEventListener(
    "change",
    applyFilters
  );

  filterReset?.addEventListener(
    "click",
    resetFilters
  );

  searchInput?.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      applyFilters();

      document
        .getElementById("firms-section")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  );
}

/* =======================================
   Firms
======================================= */

async function loadFirms() {
  const container =
    document.getElementById("firms");

  const count =
    document.getElementById("firmCount");

  if (!container) {
    return;
  }

  setFirmLoadingState(container, count);

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
    console.error(
      "Unable to load firms:",
      error
    );

    showFirmLoadError(
      container,
      count,
      "Unable to load firms at the moment."
    );

    return;
  }

  firms = data || [];

  displayFirms(firms);

  await loadDirectoryData();

  populateFilterOptions();
  applyFilters();
}

async function loadDirectoryData() {
  const firmIds =
    firms.map(firm => firm.id);

  practiceAreasByFirm = new Map();
  rolesByFirm = new Map();
  searchTermsByFirm = new Map();

  if (!firmIds.length) {
    return;
  }

  firmIds.forEach(firmId => {
    searchTermsByFirm.set(
      firmId,
      new Set()
    );
  });

  const results =
    await Promise.allSettled([
      client
        .from("practice_areas")
        .select(`
          firm_id,
          practice_area
        `)
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
        .select(`
          firm_id,
          city,
          country
        `)
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
    practiceRows,
    roleRows,
    locationRows,
    opportunityRows,
    trainingRows
  ] = results.map(getSettledQueryRows);

  addPracticeAreaData(practiceRows);
  addRoleData(roleRows);
  addLocationSearchData(locationRows);
  addOpportunitySearchData(opportunityRows);
  addTrainingContractSearchData(trainingRows);
}

function getSettledQueryRows(result) {
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
    if (
      !row.firm_id ||
      !row.practice_area
    ) {
      return;
    }

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
    if (
      !row.firm_id ||
      !row.role_name
    ) {
      return;
    }

    const usefulForStudents =
      usefulRoleGroups.has(row.role_group) ||
      [
        "primary",
        "strong",
        "context"
      ].includes(row.student_relevance);

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
    if (!row.firm_id) {
      return;
    }

    addSearchTerm(
      row.firm_id,
      row.city
    );

    addSearchTerm(
      row.firm_id,
      row.country
    );
  });
}

function addOpportunitySearchData(rows) {
  rows.forEach(row => {
    if (!row.firm_id) {
      return;
    }

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
    if (!row.firm_id) {
      return;
    }

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
  if (!value) {
    return;
  }

  if (!map.has(key)) {
    map.set(
      key,
      new Set()
    );
  }

  map.get(key).add(value);
}

function addSearchTerm(firmId, value) {
  if (
    !firmId ||
    !value
  ) {
    return;
  }

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

/* =======================================
   Firm filters
======================================= */

function populateFilterOptions() {
  const allPracticeAreas =
    new Set();

  const allRoles =
    new Set();

  const allFirmTypes =
    new Set();

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
      allFirmTypes.add(
        firm.firm_type
      );
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
  const select =
    document.getElementById(id);

  if (!select) {
    return;
  }

  const currentValue =
    select.value;

  const fragment =
    document.createDocumentFragment();

  const placeholder =
    document.createElement("option");

  placeholder.value = "";
  placeholder.textContent =
    placeholderText;

  fragment.appendChild(
    placeholder
  );

  Array.from(valuesSet)
    .filter(Boolean)
    .sort((a, b) => {
      return a.localeCompare(
        b,
        "en-GB"
      );
    })
    .forEach(value => {
      const option =
        document.createElement("option");

      option.value = value;
      option.textContent = value;

      fragment.appendChild(
        option
      );
    });

  select.replaceChildren(
    fragment
  );

  const valueStillExists =
    Array.from(select.options)
      .some(option => {
        return option.value ===
          currentValue;
      });

  if (valueStillExists) {
    select.value =
      currentValue;
  }
}

function applyFilters() {
  const search =
    normalizeText(
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
    document.getElementById(
      "filterReset"
    );

  const filtered =
    firms.filter(firm => {
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

  const anyFilterActive =
    Boolean(
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
    document.getElementById(
      "searchInput"
    );

  const filterPracticeArea =
    document.getElementById(
      "filterPracticeArea"
    );

  const filterRole =
    document.getElementById(
      "filterRole"
    );

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

/* =======================================
   Firm preview rendering
======================================= */

function displayFirms(list) {
  const container =
    document.getElementById("firms");

  const count =
    document.getElementById("firmCount");

  if (!container) {
    return;
  }

  updateFirmCount(
    count,
    list.length
  );

  if (!list.length) {
    container.innerHTML = `
      <div class="directory-empty">
        <p>No matching firms found.</p>

        <span>
          Try a broader search or reset the filters.
        </span>
      </div>
    `;

    return;
  }

  const fragment =
    document.createDocumentFragment();

  list.forEach(firm => {
    fragment.appendChild(
      createFirmListItem(firm)
    );
  });

  container.replaceChildren(
    fragment
  );
}

function createFirmListItem(firm) {
  const card =
    document.createElement("article");

  card.className = "firm-card";
  card.tabIndex = 0;
  card.setAttribute(
    "role",
    "link"
  );

  card.setAttribute(
    "aria-label",
    `Open ${firm.name}`
  );

  const firmUrl =
    `firm.html?id=${
      encodeURIComponent(firm.id)
    }`;

  const firmType =
    firm.circle_classification ||
    firm.firm_type ||
    "Law firm";

  const location =
    formatFirmLocation(firm);

  card.innerHTML = `
    <div class="firm-card-header">
      <div class="firm-card-copy">
        <h3>
          ${escapeHtml(firm.name)}
        </h3>

        <p class="firm-type">
          ${escapeHtml(firmType)}
          ·
          ${escapeHtml(location)}
        </p>
      </div>
    </div>

    <a
      class="firm-link"
      href="${firmUrl}"
      aria-label="View ${escapeHtml(firm.name)}"
    >
      View firm
    </a>
  `;

  card.addEventListener(
    "click",
    event => {
      if (event.target.closest("a")) {
        return;
      }

      window.location.href =
        firmUrl;
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

      if (event.target.closest("a")) {
        return;
      }

      event.preventDefault();

      window.location.href =
        firmUrl;
    }
  );

  return card;
}

function formatFirmLocation(firm) {
  const city =
    firm.head_office_city?.trim();

  const country =
    firm.head_office_country?.trim();

  if (
    city &&
    country
  ) {
    return `${city}, ${country}`;
  }

  if (city) {
    return city;
  }

  if (country) {
    return country;
  }

  return (
    firm.head_office ||
    "United Kingdom"
  );
}

function updateFirmCount(
  element,
  total
) {
  if (!element) {
    return;
  }

  element.textContent =
    total === 1
      ? "1 firm"
      : `${total} firms`;
}

/* =======================================
   Unified deadline preview
======================================= */

async function loadUpcomingDeadlines() {
  const deadlineList =
    document.getElementById(
      "deadlinePreviewList"
    );

  if (!deadlineList) {
    return;
  }

  if (typeof client === "undefined") {
    showDeadlineMessage(
      deadlineList,
      "Deadlines are temporarily unavailable."
    );

    return;
  }

  deadlineList.innerHTML = `
    <div class="deadline-loading">
      Loading upcoming deadlines…
    </div>
  `;

  const today =
    getTodayIsoDate();

  const { data, error } = await client
    .from("deadlines_public_view")
    .select(`
      deadline_key,
      provider_name,
      provider_type,
      career_pathway,
      opportunity_name,
      opportunity_type_label,
      application_deadline,
      application_status,
      deadline_group,
      application_url,
      last_checked_on
    `)
    .gte(
      "application_deadline",
      today
    )
    .not(
      "application_deadline",
      "is",
      null
    )
    .in(
      "application_status",
      [
        "open",
        "upcoming",
        "rolling",
        "available",
        "unknown"
      ]
    )
    .order(
      "application_deadline",
      {
        ascending: true,
        nullsFirst: false
      }
    )
    .limit(12);

  if (error) {
    console.error(
      "Unable to load deadlines:",
      error
    );

    showDeadlineMessage(
      deadlineList,
      "Upcoming dates are being refreshed."
    );

    return;
  }

  const rows =
    deduplicateDeadlines(data || [])
      .slice(0, 4);

  if (!rows.length) {
    showDeadlineMessage(
      deadlineList,
      "New application deadlines will appear here as they are verified."
    );

    return;
  }

  const fragment =
    document.createDocumentFragment();

  rows.forEach(row => {
    fragment.appendChild(
      createDeadlinePreviewRow(row)
    );
  });

  deadlineList.replaceChildren(
    fragment
  );
}

function deduplicateDeadlines(rows) {
  const unique =
    new Map();

  rows.forEach(row => {
    const key =
      row.deadline_key ||
      [
        row.provider_name,
        row.opportunity_name,
        row.application_deadline
      ].join("|");

    if (!unique.has(key)) {
      unique.set(key, row);
    }
  });

  return Array.from(
    unique.values()
  );
}

function createDeadlinePreviewRow(row) {
  const article =
    document.createElement("article");

  article.className =
    "deadline-row";

  const providerName =
    row.provider_name ||
    "Legal employer";

  const opportunityName =
    row.opportunity_name ||
    row.opportunity_type_label ||
    "Opportunity";

  const dateLabel =
    formatDate(
      row.application_deadline,
      false
    );

  const applicationUrl =
    safeHttpUrl(
      row.application_url
    );

  article.innerHTML = `
    <div>
      <strong>
        ${escapeHtml(providerName)}
      </strong>

      <span>
        ${escapeHtml(opportunityName)}
      </span>
    </div>

    ${
      applicationUrl
        ? `
          <a
            class="small-link"
            href="${escapeHtml(applicationUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="${
              escapeHtml(
                `${providerName}: ${opportunityName}, deadline ${dateLabel}`
              )
            }"
          >
            <time
              datetime="${
                escapeHtml(
                  row.application_deadline
                )
              }"
            >
              ${escapeHtml(dateLabel)}
            </time>
          </a>
        `
        : `
          <time
            datetime="${
              escapeHtml(
                row.application_deadline
              )
            }"
          >
            ${escapeHtml(dateLabel)}
          </time>
        `
    }
  `;

  return article;
}

function showDeadlineMessage(
  container,
  message
) {
  container.innerHTML = `
    <article class="deadline-row">
      <div>
        <strong>
          Dates being refreshed
        </strong>

        <span>
          ${escapeHtml(message)}
        </span>
      </div>
    </article>
  `;
}

/* =======================================
   Loading and error states
======================================= */

function setFirmLoadingState(
  container,
  count
) {
  container.innerHTML = `
    <div
      class="directory-empty"
      role="status"
    >
      <p>Loading firms…</p>

      <span>
        Preparing the firm directory.
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
    <div class="directory-empty">
      <p>Firms could not be loaded.</p>

      <span>
        ${escapeHtml(message)}
      </span>
    </div>
  `;

  if (count) {
    count.textContent =
      "Unable to load firms";
  }
}

/* =======================================
   Utilities
======================================= */

function debounce(
  callback,
  delay = 180
) {
  let timer;

  return (...args) => {
    window.clearTimeout(timer);

    timer = window.setTimeout(
      () => callback(...args),
      delay
    );
  };
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
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset();

  const localDate =
    new Date(
      now.getTime() -
      offset * 60_000
    );

  return localDate
    .toISOString()
    .slice(0, 10);
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
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

function safeHttpUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url =
      new URL(value);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
