// =======================================
// Vacatory
// firms-directory.js
// Full UK law firms directory
// =======================================

const firmsDirectoryState = {
  firms: [],
  filteredFirms: [],
  firmsById: new Map(),
  firmsByOrganisationId: new Map(),
  firmsByName: new Map()
};

const directoryElements = {};

document.addEventListener("DOMContentLoaded", initialiseFirmsDirectory);

async function initialiseFirmsDirectory() {
  cacheDirectoryElements();
  connectDirectoryFilters();

  if (typeof client === "undefined") {
    console.error("The Supabase client is unavailable.");
    showDirectoryError();
    return;
  }

  try {
    const { data, error } = await client
      .from("firms")
      .select("*");

    if (error) {
      throw error;
    }

    firmsDirectoryState.firms = (data || [])
      .filter(firm => firm?.id && firm?.name)
      .map(normaliseFirm);

    buildFirmMaps();

    await loadSupportingFirmData();

    populateFilterOptions();
    applyDirectoryFilters();

    directoryElements.loading?.classList.add("hidden");
  } catch (error) {
    console.error("Unable to load firms:", error);
    showDirectoryError();
  }
}

function cacheDirectoryElements() {
  directoryElements.search =
    document.getElementById("directorySearch");

  directoryElements.sort =
    document.getElementById("sortFilter");

  directoryElements.location =
    document.getElementById("locationFilter");

  directoryElements.practice =
    document.getElementById("practiceFilter");

  directoryElements.role =
    document.getElementById("roleFilter");

  directoryElements.status =
    document.getElementById("statusFilter");

  directoryElements.clear =
    document.getElementById("clearFilters");

  directoryElements.count =
    document.getElementById("directoryCount");

  directoryElements.loading =
    document.getElementById("directoryLoading");

  directoryElements.error =
    document.getElementById("directoryError");

  directoryElements.empty =
    document.getElementById("directoryEmpty");

  directoryElements.list =
    document.getElementById("firmsDirectory");
}

function connectDirectoryFilters() {
  directoryElements.search?.addEventListener(
    "input",
    applyDirectoryFilters
  );

  directoryElements.sort?.addEventListener(
    "change",
    applyDirectoryFilters
  );

  directoryElements.location?.addEventListener(
    "change",
    applyDirectoryFilters
  );

  directoryElements.practice?.addEventListener(
    "change",
    applyDirectoryFilters
  );

  directoryElements.role?.addEventListener(
    "change",
    applyDirectoryFilters
  );

  directoryElements.status?.addEventListener(
    "change",
    applyDirectoryFilters
  );

  directoryElements.clear?.addEventListener(
    "click",
    clearDirectoryFilters
  );
}

function normaliseFirm(firm) {
  return {
    ...firm,
    locations: [],
    practiceAreas: [],
    opportunities: [],
    statuses: []
  };
}

function buildFirmMaps() {
  firmsDirectoryState.firmsById.clear();
  firmsDirectoryState.firmsByOrganisationId.clear();
  firmsDirectoryState.firmsByName.clear();

  firmsDirectoryState.firms.forEach(firm => {
    firmsDirectoryState.firmsById.set(
      String(firm.id),
      firm
    );

    if (firm.organisation_id) {
      firmsDirectoryState.firmsByOrganisationId.set(
        String(firm.organisation_id),
        firm
      );
    }

    firmsDirectoryState.firmsByName.set(
      normaliseText(firm.name),
      firm
    );

    if (firm.short_name) {
      firmsDirectoryState.firmsByName.set(
        normaliseText(firm.short_name),
        firm
      );
    }
  });
}

async function loadSupportingFirmData() {
  const [
    organisationLocations,
    legacyLocations,
    practiceAreas,
    firmRoles,
    opportunities,
    trainingContracts,
    deadlines
  ] = await Promise.all([
    readOptionalTable("organisation_locations"),
    readOptionalTable("locations"),
    readOptionalTable("practice_areas"),
    readOptionalTable("firm_roles"),
    readOptionalTable("vacation_schemes"),
    readOptionalTable("training_contracts"),
    readOptionalTable("deadlines_public_view")
  ]);

  addLocationRows([
    ...organisationLocations,
    ...legacyLocations
  ]);

  addPracticeAreaRows(practiceAreas);
  addRoleRows(firmRoles);
  addOpportunityRows(opportunities);
  addTrainingContractRows(trainingContracts);
  addDeadlineRows(deadlines);

  firmsDirectoryState.firms.forEach(firm => {
    firm.locations = uniqueSorted(firm.locations);
    firm.practiceAreas = uniqueSorted(firm.practiceAreas);
    firm.opportunities = uniqueSorted(firm.opportunities);
    firm.statuses = [...new Set(firm.statuses)];
  });
}

async function readOptionalTable(tableName) {
  const { data, error } = await client
    .from(tableName)
    .select("*");

  if (error) {
    console.warn(
      `Optional source unavailable: ${tableName}`,
      error.message
    );

    return [];
  }

  return data || [];
}

function findFirmForRow(row) {
  const directFirmIds = [
    row.firm_id,
    row.provider_firm_id
  ].filter(Boolean);

  for (const id of directFirmIds) {
    const firm = firmsDirectoryState.firmsById.get(
      String(id)
    );

    if (firm) {
      return firm;
    }
  }

  const organisationIds = [
    row.organisation_id,
    row.legal_organisation_id,
    row.provider_id
  ].filter(Boolean);

  for (const id of organisationIds) {
    const firm =
      firmsDirectoryState.firmsByOrganisationId.get(
        String(id)
      );

    if (firm) {
      return firm;
    }
  }

  const possibleNames = [
    row.firm_name,
    row.provider_name,
    row.organisation_name,
    row.legal_organisation_name
  ].filter(Boolean);

  for (const name of possibleNames) {
    const firm = firmsDirectoryState.firmsByName.get(
      normaliseText(name)
    );

    if (firm) {
      return firm;
    }
  }

  return null;
}

function addLocationRows(rows) {
  rows.forEach(row => {
    const firm = findFirmForRow(row);

    if (!firm) {
      return;
    }

    const city =
      row.city ||
      row.location_name ||
      row.office_name ||
      row.name;

    const country = row.country;

    if (!city) {
      return;
    }

    const locationLabel = country
      ? `${city}, ${country}`
      : city;

    firm.locations.push(locationLabel);
  });
}

function addPracticeAreaRows(rows) {
  rows.forEach(row => {
    const firm = findFirmForRow(row);

    if (!firm) {
      return;
    }

    const practiceArea =
      row.practice_area ||
      row.practice_name ||
      row.service_name ||
      row.name;

    if (practiceArea) {
      firm.practiceAreas.push(practiceArea);
    }
  });
}

function addRoleRows(rows) {
  rows.forEach(row => {
    const firm = findFirmForRow(row);

    if (!firm) {
      return;
    }

    const role =
      row.role_name ||
      row.official_role_title ||
      row.role_title ||
      row.name;

    if (role) {
      firm.opportunities.push(role);
    }
  });
}

function addOpportunityRows(rows) {
  rows.forEach(row => {
    const firm = findFirmForRow(row);

    if (!firm) {
      return;
    }

    const opportunityName =
      row.scheme_name ||
      row.opportunity_name ||
      row.programme_name ||
      row.name ||
      "Vacation scheme";

    firm.opportunities.push(opportunityName);

    addStatusToFirm(
      firm,
      row.application_status ||
      row.status ||
      row.cycle_status
    );
  });
}

function addTrainingContractRows(rows) {
  rows.forEach(row => {
    const firm = findFirmForRow(row);

    if (!firm) {
      return;
    }

    const programmeName =
      row.programme_name ||
      row.training_contract_name ||
      "Training contract";

    firm.opportunities.push(programmeName);

    addStatusToFirm(
      firm,
      row.application_status ||
      row.status ||
      row.cycle_status
    );
  });
}

function addDeadlineRows(rows) {
  rows.forEach(row => {
    const pathway = normaliseText(
      row.career_pathway || ""
    );

    if (pathway && pathway !== "solicitor") {
      return;
    }

    const firm = findFirmForRow(row);

    if (!firm) {
      return;
    }

    const opportunity =
      row.opportunity_type_name ||
      row.opportunity_type ||
      row.opportunity_name ||
      row.programme_name;

    if (opportunity) {
      firm.opportunities.push(opportunity);
    }

    addStatusToFirm(
      firm,
      row.application_status ||
      row.status ||
      row.cycle_status
    );
  });
}

function addStatusToFirm(firm, value) {
  const status = normaliseApplicationStatus(value);

  if (status) {
    firm.statuses.push(status);
  }
}

function normaliseApplicationStatus(value) {
  if (!value) {
    return "unknown";
  }

  const status = normaliseText(value);

  if (status.includes("rolling")) {
    return "rolling";
  }

  if (
    status.includes("upcoming") ||
    status.includes("not yet open") ||
    status.includes("opens soon") ||
    status.includes("announced")
  ) {
    return "upcoming";
  }

  if (
    status.includes("closed") ||
    status.includes("expired") ||
    status.includes("passed")
  ) {
    return "closed";
  }

  if (status.includes("open")) {
    return "open";
  }

  return "unknown";
}

function populateFilterOptions() {
  const locations = uniqueSorted(
    firmsDirectoryState.firms.flatMap(
      firm => firm.locations
    )
  );

  const practiceAreas = uniqueSorted(
    firmsDirectoryState.firms.flatMap(
      firm => firm.practiceAreas
    )
  );

  const opportunities = uniqueSorted(
    firmsDirectoryState.firms.flatMap(
      firm => firm.opportunities
    )
  );

  addSelectOptions(
    directoryElements.location,
    locations
  );

  addSelectOptions(
    directoryElements.practice,
    practiceAreas
  );

  addSelectOptions(
    directoryElements.role,
    opportunities
  );
}

function addSelectOptions(selectElement, values) {
  if (!selectElement) {
    return;
  }

  values.forEach(value => {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = value;

    selectElement.appendChild(option);
  });
}

function applyDirectoryFilters() {
  const searchTerm = normaliseText(
    directoryElements.search?.value || ""
  );

  const selectedLocation =
    directoryElements.location?.value || "";

  const selectedPractice =
    directoryElements.practice?.value || "";

  const selectedOpportunity =
    directoryElements.role?.value || "";

  const selectedStatus =
    directoryElements.status?.value || "";

  const selectedSort =
    directoryElements.sort?.value || "rank";

  firmsDirectoryState.filteredFirms =
    firmsDirectoryState.firms.filter(firm => {
      const searchableText = normaliseText(
        [
          firm.name,
          firm.short_name,
          firm.firm_type,
          firm.head_office,
          ...firm.locations,
          ...firm.practiceAreas,
          ...firm.opportunities
        ]
          .filter(Boolean)
          .join(" ")
      );

      const matchesSearch =
        !searchTerm ||
        searchableText.includes(searchTerm);

      const matchesLocation =
        !selectedLocation ||
        firm.locations.includes(selectedLocation);

      const matchesPractice =
        !selectedPractice ||
        firm.practiceAreas.includes(selectedPractice);

      const matchesOpportunity =
        !selectedOpportunity ||
        firm.opportunities.includes(selectedOpportunity);

      const firmStatuses = firm.statuses.length
        ? firm.statuses
        : ["unknown"];

      const matchesStatus =
        !selectedStatus ||
        firmStatuses.includes(selectedStatus);

      return (
        matchesSearch &&
        matchesLocation &&
        matchesPractice &&
        matchesOpportunity &&
        matchesStatus
      );
    });

  sortFirms(
    firmsDirectoryState.filteredFirms,
    selectedSort
  );

  renderFirmDirectory();
}

function sortFirms(firms, sortValue) {
  firms.sort((firstFirm, secondFirm) => {
    const firstName = firstFirm.name || "";
    const secondName = secondFirm.name || "";

    if (sortValue === "az") {
      return firstName.localeCompare(secondName);
    }

    if (sortValue === "za") {
      return secondName.localeCompare(firstName);
    }

    const firstRank = numericRank(firstFirm.uk_rank);
    const secondRank = numericRank(secondFirm.uk_rank);

    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    return firstName.localeCompare(secondName);
  });
}

function renderFirmDirectory() {
  if (!directoryElements.list) {
    return;
  }

  directoryElements.loading?.classList.add("hidden");
  directoryElements.error?.classList.add("hidden");

  const totalFirms = firmsDirectoryState.firms.length;
  const visibleFirms =
    firmsDirectoryState.filteredFirms.length;

  if (directoryElements.count) {
    directoryElements.count.textContent =
      visibleFirms === totalFirms
        ? `${totalFirms} law firms`
        : `${visibleFirms} of ${totalFirms} law firms`;
  }

  if (!visibleFirms) {
    directoryElements.list.innerHTML = "";
    directoryElements.empty?.classList.remove("hidden");
    return;
  }

  directoryElements.empty?.classList.add("hidden");

  directoryElements.list.innerHTML =
    firmsDirectoryState.filteredFirms
      .map(createFirmCard)
      .join("");
}

function createFirmCard(firm) {
  const firmName = firm.name || "Law firm";

  const initials = (
    firm.short_name ||
    firmName
  )
    .trim()
    .charAt(0)
    .toUpperCase();

  const logo = firm.logo_url
    ? `
      <img
        src="${escapeHtml(firm.logo_url)}"
        alt=""
        loading="lazy"
      >
    `
    : escapeHtml(initials);

  const firmType =
    firm.firm_type ||
    "Law firm";

  const location =
    firm.head_office ||
    firm.locations[0] ||
    "Locations being researched";

  const rank = numericRank(firm.uk_rank);

  const rankText = Number.isFinite(rank)
    ? `UK rank #${rank}`
    : "Ranking not listed";

  const applicationStatus =
    getPrimaryFirmStatus(firm.statuses);

  return `
    <a
      class="firm-card"
      href="firm-profile.html?id=${encodeURIComponent(firm.id)}"
      aria-label="View ${escapeHtml(firmName)} profile"
    >
      <div class="firm-card-header">
        <div class="firm-logo" aria-hidden="true">
          ${logo}
        </div>
      </div>

      <h3>
        ${escapeHtml(firmName)}
      </h3>

      <p class="firm-type">
        ${escapeHtml(firmType)}
      </p>

      <div class="firm-details">
        <p class="firm-location">
          ${escapeHtml(location)}
        </p>

        <p class="firm-location">
          ${escapeHtml(rankText)}
        </p>

        <span class="status-pill">
          ${escapeHtml(statusLabel(applicationStatus))}
        </span>
      </div>

      <span class="firm-link">
        View firm profile
        <span aria-hidden="true">→</span>
      </span>
    </a>
  `;
}

function getPrimaryFirmStatus(statuses) {
  const availableStatuses = statuses?.length
    ? statuses
    : ["unknown"];

  const priority = [
    "open",
    "rolling",
    "upcoming",
    "closed",
    "unknown"
  ];

  return priority.find(
    status => availableStatuses.includes(status)
  ) || "unknown";
}

function statusLabel(status) {
  const labels = {
    open: "Applications open",
    rolling: "Rolling applications",
    upcoming: "Opening soon",
    closed: "Applications closed",
    unknown: "Dates not announced"
  };

  return labels[status] || labels.unknown;
}

function clearDirectoryFilters() {
  if (directoryElements.search) {
    directoryElements.search.value = "";
  }

  if (directoryElements.sort) {
    directoryElements.sort.value = "rank";
  }

  if (directoryElements.location) {
    directoryElements.location.value = "";
  }

  if (directoryElements.practice) {
    directoryElements.practice.value = "";
  }

  if (directoryElements.role) {
    directoryElements.role.value = "";
  }

  if (directoryElements.status) {
    directoryElements.status.value = "";
  }

  applyDirectoryFilters();

  directoryElements.search?.focus();
}

function showDirectoryError() {
  directoryElements.loading?.classList.add("hidden");
  directoryElements.empty?.classList.add("hidden");
  directoryElements.error?.classList.remove("hidden");

  if (directoryElements.count) {
    directoryElements.count.textContent =
      "The firms directory could not be loaded.";
  }
}

function uniqueSorted(values) {
  return [
    ...new Set(
      values
        .filter(Boolean)
        .map(value => String(value).trim())
        .filter(Boolean)
    )
  ].sort((firstValue, secondValue) =>
    firstValue.localeCompare(secondValue)
  );
}

function numericRank(value) {
  const rank = Number(value);

  return Number.isFinite(rank)
    ? rank
    : Number.POSITIVE_INFINITY;
}

function normaliseText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
