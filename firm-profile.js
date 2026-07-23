// =======================================
// Vacatory
// firm-profile.js
// Individual law firm profile page
// =======================================

const params = new URLSearchParams(window.location.search);
const firmId = params.get("id");

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();

  if (!firmId) {
    showError();
    return;
  }

  loadFirmProfile();
});

function showError() {
  document
    .getElementById("loadingState")
    ?.classList.add("hidden");

  document
    .getElementById("profileContent")
    ?.classList.add("hidden");

  document
    .getElementById("errorState")
    ?.classList.remove("hidden");
}

async function loadFirmProfile() {
  if (typeof client === "undefined") {
    console.error("The Supabase client is unavailable.");
    showError();
    return;
  }

  try {
    const { data: firm, error } = await client
      .from("firms")
      .select("*")
      .eq("id", firmId)
      .single();

    if (error || !firm) {
      throw error || new Error("Firm not found.");
    }

    renderFirmHeader(firm);

    await Promise.all([
      loadPracticeAreas(),
      loadRoles(),
      loadLocations(firm),
      loadOpportunities(firm)
    ]);

    document
      .getElementById("loadingState")
      ?.classList.add("hidden");

    document
      .getElementById("errorState")
      ?.classList.add("hidden");

    document
      .getElementById("profileContent")
      ?.classList.remove("hidden");
  } catch (error) {
    console.error("Unable to load firm profile:", error);
    showError();
  }
}

/* =======================================
   Header
======================================= */

function renderFirmHeader(firm) {
  document.title = `${firm.name || "Firm"} — Vacatory`;

  const firmLogo =
    document.getElementById("firmLogo");

  const firmName =
    document.getElementById("firmName");

  const firmType =
    document.getElementById("firmType");

  const firmOverview =
    document.getElementById("firmOverview");

  const firmMeta =
    document.getElementById("firmMeta");

  if (firmLogo) {
    const initials = (
      firm.short_name ||
      firm.name ||
      "V"
    )
      .trim()
      .charAt(0)
      .toUpperCase();

    firmLogo.innerHTML = firm.logo_url
      ? `
        <img
          src="${escapeHtml(firm.logo_url)}"
          alt="${escapeHtml(firm.name || "Firm")} logo"
        >
      `
      : escapeHtml(initials);
  }

  if (firmName) {
    firmName.textContent =
      firm.name || "Law firm";
  }

  if (firmType) {
    firmType.textContent =
      firm.firm_type || "Law firm";
  }

  if (firmOverview) {
    firmOverview.textContent =
      firm.overview ||
      "A detailed overview has not yet been added.";
  }

  if (firmMeta) {
    const metaItems = [];

    if (firm.head_office) {
      metaItems.push(
        metaPill(
          locationIcon(),
          firm.head_office
        )
      );
    }

    if (
      firm.uk_rank !== null &&
      firm.uk_rank !== undefined &&
      firm.uk_rank !== ""
    ) {
      metaItems.push(
        metaPill(
          rankIcon(),
          `UK rank #${firm.uk_rank}`
        )
      );
    }

    if (firm.website) {
      metaItems.push(
        metaPill(
          linkIcon(),
          "Official website available"
        )
      );
    }

    firmMeta.innerHTML = metaItems.join("");
  }

  setText(
    "ov-size",
    firm.firm_size ||
    firm.size ||
    "Not yet available"
  );

  setText(
    "ov-secondments",
    firm.secondments ||
    "Not yet available"
  );

  setText(
    "ov-scholarships",
    firm.scholarships ||
    "Not yet available"
  );

  renderOfficialLinks(firm);
}

function renderOfficialLinks(firm) {
  const links =
    document.getElementById("ov-links");

  if (!links) {
    return;
  }

  const linkItems = [];

  if (firm.website) {
    linkItems.push(
      profileLink(
        firm.website,
        "Official firm website"
      )
    );
  }

  if (firm.careers_url) {
    linkItems.push(
      profileLink(
        firm.careers_url,
        "Official careers page"
      )
    );
  }

  if (firm.linkedin) {
    linkItems.push(
      profileLink(
        firm.linkedin,
        "LinkedIn"
      )
    );
  }

  links.innerHTML = linkItems.length
    ? linkItems.join("")
    : emptyMessage(
        "Official links have not yet been added."
      );
}

/* =======================================
   Tabs
======================================= */

function setupTabs() {
  const tabs =
    document.querySelectorAll(".tab-btn");

  const panels =
    document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach(item => {
        item.classList.remove("active");
      });

      panels.forEach(panel => {
        panel.classList.remove("active");
      });

      tab.classList.add("active");

      document
        .getElementById(`tab-${target}`)
        ?.classList.add("active");
    });
  });
}

/* =======================================
   Practice areas
======================================= */

async function loadPracticeAreas() {
  const container =
    document.getElementById("practiceAreasList");

  if (!container) {
    return;
  }

  const rows = await readOptionalRows(
    "practice_areas",
    "firm_id",
    firmId
  );

  const practiceAreas = rows
    .map(row => ({
      name:
        row.practice_area ||
        row.practice_name ||
        row.service_name ||
        row.name,

      description:
        row.description ||
        row.summary ||
        "",

      featured:
        Boolean(row.featured)
    }))
    .filter(area => area.name)
    .sort((first, second) => {
      if (first.featured !== second.featured) {
        return first.featured ? -1 : 1;
      }

      return first.name.localeCompare(second.name);
    });

  if (!practiceAreas.length) {
    container.innerHTML = emptyMessage(
      "No practice areas have been listed yet."
    );

    return;
  }

  container.innerHTML = practiceAreas
    .map(area => `
      <article class="profile-card">
        <h3>
          ${escapeHtml(area.name)}

          ${
            area.featured
              ? '<span class="featured-tag">Featured</span>'
              : ""
          }
        </h3>

        ${
          area.description
            ? `<p>${escapeHtml(area.description)}</p>`
            : ""
        }
      </article>
    `)
    .join("");
}

/* =======================================
   Roles
======================================= */

async function loadRoles() {
  const container =
    document.getElementById("rolesList");

  if (!container) {
    return;
  }

  const rows = await readOptionalRows(
    "firm_roles",
    "firm_id",
    firmId
  );

  const roleNames = uniqueSorted(
    rows.map(row =>
      row.role_name ||
      row.official_role_title ||
      row.role_title ||
      row.name
    )
  );

  if (!roleNames.length) {
    container.innerHTML = emptyMessage(
      "No role information has been listed yet."
    );

    return;
  }

  container.innerHTML = `
    <ul class="simple-role-list">
      ${roleNames
        .map(role => `
          <li>${escapeHtml(role)}</li>
        `)
        .join("")}
    </ul>
  `;
}

/* =======================================
   Locations
======================================= */

async function loadLocations(firm) {
  const container =
    document.getElementById("locationsList");

  if (!container) {
    return;
  }

  const legacyRows = await readOptionalRows(
    "locations",
    "firm_id",
    firmId
  );

  let organisationRows = [];

  if (firm.organisation_id) {
    organisationRows = await readOptionalRows(
      "organisation_locations",
      "organisation_id",
      firm.organisation_id
    );
  }

  const locationRows = deduplicateLocations([
    ...organisationRows,
    ...legacyRows
  ]);

  if (!locationRows.length) {
    container.innerHTML = emptyMessage(
      "No office locations have been listed yet."
    );

    return;
  }

  container.innerHTML = locationRows
    .map(location => {
      const city =
        location.city ||
        location.location_name ||
        location.office_name ||
        location.name ||
        "Office";

      const country =
        location.country || "";

      const region =
        location.region || "";

      const officeType =
        location.office_type || "";

      const offersVacationScheme =
        isTrue(
          location.offers_vacation_scheme
        );

      const offersTrainingContract =
        isTrue(
          location.offers_training_contract
        );

      return `
        <article class="profile-card">
          <h3>
            ${escapeHtml(city)}
            ${
              country
                ? `, ${escapeHtml(country)}`
                : ""
            }
          </h3>

          ${
            officeType || region
              ? `
                <p>
                  ${escapeHtml(officeType || "Office")}
                  ${
                    region
                      ? ` — ${escapeHtml(region)}`
                      : ""
                  }
                </p>
              `
              : ""
          }

          ${
            offersVacationScheme ||
            offersTrainingContract
              ? `
                <div class="location-tags">
                  ${
                    offersVacationScheme
                      ? '<span class="status-pill">Vacation scheme</span>'
                      : ""
                  }

                  ${
                    offersTrainingContract
                      ? '<span class="status-pill">Training contract</span>'
                      : ""
                  }
                </div>
              `
              : ""
          }
        </article>
      `;
    })
    .join("");
}

/* =======================================
   Combined opportunities
======================================= */

async function loadOpportunities(firm) {
  const list =
    document.getElementById("opportunitiesList");

  const loading =
    document.getElementById("opportunitiesLoading");

  const empty =
    document.getElementById("opportunitiesEmpty");

  if (!list) {
    return;
  }

  const [
    vacationSchemes,
    trainingContracts
  ] = await Promise.all([
    readOptionalRows(
      "vacation_schemes",
      "firm_id",
      firmId
    ),

    readOptionalRows(
      "training_contracts",
      "firm_id",
      firmId
    )
  ]);

  const opportunities = [
    ...vacationSchemes.map(row =>
      normaliseVacationScheme(row, firm)
    ),

    ...trainingContracts.map(row =>
      normaliseTrainingContract(row, firm)
    )
  ]
    .filter(Boolean)
    .sort(sortOpportunitiesByClosingDate);

  loading?.classList.add("hidden");

  if (!opportunities.length) {
    empty?.classList.remove("hidden");
    list.innerHTML = "";

    if (firm.careers_url) {
      empty.innerHTML = `
        No opportunities have been added for this firm yet.

        ${profileLink(
          firm.careers_url,
          "Visit the official careers page"
        )}
      `;
    }

    return;
  }

  empty?.classList.add("hidden");

  list.innerHTML = opportunities
    .map((opportunity, index) =>
      renderOpportunity(
        opportunity,
        index
      )
    )
    .join("");
}

function normaliseVacationScheme(row, firm) {
  const name =
    row.scheme_name ||
    row.opportunity_name ||
    row.programme_name ||
    "Vacation scheme";

  const type =
    row.scheme_type ||
    row.opportunity_type ||
    "Vacation scheme";

  const location =
    row.location ||
    row.location_text ||
    row.office ||
    "Location not stated";

  const openingDate =
    row.opens_on ||
    row.application_open ||
    row.application_open_date;

  const closingDate =
    row.deadline ||
    row.application_deadline ||
    row.application_close_date ||
    row.closes_on;

  const startDate =
    row.programme_start_date ||
    row.start_date ||
    row.scheme_start_date;

  const programmeDates =
    row.programme_dates ||
    row.scheme_dates ||
    row.actual_programme_dates;

  return {
    sourceType: "vacation-scheme",
    name,
    type,
    location,
    openingDate,
    closingDate,
    startDate,
    programmeDates,

    status:
      row.application_status ||
      row.status,

    duration:
      row.duration ||
      row.programme_length,

    salary:
      row.salary ||
      row.payment,

    eligibility:
      row.eligibility,

    academicRequirements:
      row.academic_requirements ||
      row.academic_requirement,

    degreeRequirements:
      row.degree_requirements ||
      row.degree_requirement,

    applicationProcess:
      row.application_process ||
      row.selection_process ||
      row.application_stages,

    assessments:
      row.assessments ||
      row.assessment_details ||
      row.online_tests,

    additionalDetails:
      row.additional_details ||
      row.notes ||
      row.description,

    applicationUrl:
      row.application_link ||
      row.application_url ||
      firm.careers_url
  };
}

function normaliseTrainingContract(row, firm) {
  const intake =
    row.intake_year ||
    row.start_year ||
    "";

  const baseName =
    row.programme_name ||
    row.training_contract_name ||
    "Training contract";

  const name = intake
    ? `${baseName} — ${intake} intake`
    : baseName;

  return {
    sourceType: "training-contract",
    name,

    type:
      row.contract_type ||
      row.opportunity_type ||
      "Training contract",

    location:
      row.location ||
      row.location_text ||
      row.office ||
      "Location not stated",

    openingDate:
      row.application_open ||
      row.application_open_date,

    closingDate:
      row.application_deadline ||
      row.application_close_date,

    startDate:
      row.start_date ||
      row.programme_start_date,

    programmeDates:
      row.programme_dates,

    status:
      row.application_status ||
      row.status,

    duration:
      row.duration,

    firstYearSalary:
      row.salary_first_year,

    secondYearSalary:
      row.salary_second_year,

    nqSalary:
      row.salary_qualification ||
      row.nq_salary,

    seats:
      row.seats ||
      row.number_of_seats,

    eligibility:
      row.eligibility,

    academicRequirements:
      row.academic_requirements ||
      row.academic_requirement,

    degreeRequirements:
      row.degree_requirements ||
      row.degree_requirement,

    applicationProcess:
      row.application_process ||
      row.selection_process ||
      row.application_stages,

    assessments:
      row.assessments ||
      row.assessment_details ||
      row.online_tests,

    sponsorship:
      row.sponsorship ||
      row.sqe_support ||
      row.study_support,

    visaInformation:
      row.visa_sponsorship ||
      row.visa_information ||
      row.right_to_work,

    additionalDetails:
      row.additional_details ||
      row.notes ||
      row.description,

    applicationUrl:
      row.application_link ||
      row.application_url ||
      firm.careers_url
  };
}

function sortOpportunitiesByClosingDate(
  first,
  second
) {
  const firstGroup =
    closingDateGroup(first.closingDate);

  const secondGroup =
    closingDateGroup(second.closingDate);

  if (firstGroup !== secondGroup) {
    return firstGroup - secondGroup;
  }

  const firstDate =
    dateValue(first.closingDate);

  const secondDate =
    dateValue(second.closingDate);

  if (firstGroup === 2) {
    return secondDate - firstDate;
  }

  if (firstDate !== secondDate) {
    return firstDate - secondDate;
  }

  return first.name.localeCompare(second.name);
}

function closingDateGroup(value) {
  if (!value || !isValidDate(value)) {
    return 1;
  }

  const today = startOfToday();
  const date = startOfDate(value);

  return date >= today ? 0 : 2;
}

function renderOpportunity(
  opportunity,
  index
) {
  const deadline =
    formatDate(opportunity.closingDate) ||
    "Not announced";

  const startDate =
    formatOpportunityStart(opportunity) ||
    "Not announced";

  const detailSections =
    buildOpportunityDetailSections(
      opportunity
    );

  const facts =
    buildOpportunityFacts(
      opportunity
    );

  return `
    <details class="opportunity-item">
      <summary class="opportunity-summary">

        <div class="opportunity-deadline">
          <span>Closing</span>
          <strong>${escapeHtml(deadline)}</strong>
        </div>

        <div class="opportunity-summary-main">
          <h3>
            ${escapeHtml(opportunity.name)}
          </h3>

          <div class="opportunity-summary-meta">
            <span>
              <strong>Type:</strong>
              ${escapeHtml(opportunity.type)}
            </span>

            <span>
              <strong>Location:</strong>
              ${escapeHtml(opportunity.location)}
            </span>

            <span>
              <strong>Starts:</strong>
              ${escapeHtml(startDate)}
            </span>
          </div>
        </div>

        <span
          class="opportunity-chevron"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 9l6 6 6-6"></path>
          </svg>
        </span>

      </summary>

      <div class="opportunity-expanded">

        ${
          facts
            ? `
              <div class="opportunity-facts">
                ${facts}
              </div>
            `
            : ""
        }

        ${
          detailSections.length
            ? `
              <div class="opportunity-detail-sections">
                ${detailSections.join("")}
              </div>
            `
            : `
              <p class="opportunity-no-details">
                Further details have not yet been added.
              </p>
            `
        }

        ${
          opportunity.applicationUrl
            ? `
              <div class="opportunity-link-panel">
                ${profileLink(
                  opportunity.applicationUrl,
                  "View official opportunity page"
                )}
              </div>
            `
            : ""
        }

      </div>
    </details>
  `;
}

function buildOpportunityFacts(opportunity) {
  const facts = [
    fact(
      "Applications open",
      formatDate(opportunity.openingDate)
    ),

    fact(
      "Closing date",
      formatDate(opportunity.closingDate)
    ),

    fact(
      "Start date",
      formatDate(opportunity.startDate)
    ),

    fact(
      "Programme dates",
      formatDisplayValue(
        opportunity.programmeDates
      )
    ),

    fact(
      "Duration",
      opportunity.duration
    ),

    fact(
      "Status",
      opportunity.status
    ),

    fact(
      "Salary",
      opportunity.salary
    ),

    fact(
      "First-year salary",
      formatMoney(
        opportunity.firstYearSalary
      )
    ),

    fact(
      "Second-year salary",
      formatMoney(
        opportunity.secondYearSalary
      )
    ),

    fact(
      "NQ salary",
      formatMoney(
        opportunity.nqSalary
      )
    ),

    fact(
      "Seats",
      opportunity.seats
    )
  ].filter(Boolean);

  return facts.join("");
}

function buildOpportunityDetailSections(
  opportunity
) {
  const sections = [];

  addBulletSection(
    sections,
    "Eligibility",
    opportunity.eligibility
  );

  addBulletSection(
    sections,
    "Academic requirements",
    opportunity.academicRequirements
  );

  addBulletSection(
    sections,
    "Degree requirements",
    opportunity.degreeRequirements
  );

  addBulletSection(
    sections,
    "Application process",
    opportunity.applicationProcess
  );

  addBulletSection(
    sections,
    "Assessments",
    opportunity.assessments
  );

  addBulletSection(
    sections,
    "Study support and sponsorship",
    opportunity.sponsorship
  );

  addBulletSection(
    sections,
    "Visa and right-to-work information",
    opportunity.visaInformation
  );

  addBulletSection(
    sections,
    "Further information",
    opportunity.additionalDetails
  );

  return sections;
}

function addBulletSection(
  sections,
  heading,
  value
) {
  const points = splitIntoBulletPoints(value);

  if (!points.length) {
    return;
  }

  sections.push(`
    <section class="opportunity-detail-section">
      <h4>${escapeHtml(heading)}</h4>

      <ul class="opportunity-bullets">
        ${points
          .map(point => `
            <li>${escapeHtml(point)}</li>
          `)
          .join("")}
      </ul>
    </section>
  `);
}

function splitIntoBulletPoints(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return [];
  }

  if (Array.isArray(value)) {
    return uniqueCleanPoints(
      value.flatMap(splitIntoBulletPoints)
    );
  }

  if (typeof value === "object") {
    return uniqueCleanPoints(
      Object.values(value)
        .flatMap(splitIntoBulletPoints)
    );
  }

  const text = String(value)
    .replace(/\r/g, "\n")
    .replace(/[•●▪◦]/g, "\n")
    .replace(/\s+-\s+/g, "\n")
    .replace(/;\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  let points = text
    .split("\n")
    .map(cleanBulletPoint)
    .filter(Boolean);

  if (points.length === 1) {
    points = points[0]
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(cleanBulletPoint)
      .filter(Boolean);
  }

  return uniqueCleanPoints(points);
}

function cleanBulletPoint(value) {
  return String(value || "")
    .replace(/^[\s\-–—:;,.]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueCleanPoints(points) {
  return [
    ...new Set(
      points
        .map(cleanBulletPoint)
        .filter(Boolean)
    )
  ];
}

function formatOpportunityStart(opportunity) {
  if (opportunity.startDate) {
    return formatDate(
      opportunity.startDate
    );
  }

  if (opportunity.programmeDates) {
    return formatDisplayValue(
      opportunity.programmeDates
    );
  }

  return "";
}

/* =======================================
   Data helpers
======================================= */

async function readOptionalRows(
  tableName,
  columnName,
  value
) {
  try {
    const { data, error } = await client
      .from(tableName)
      .select("*")
      .eq(columnName, value);

    if (error) {
      console.warn(
        `Unable to read ${tableName}:`,
        error.message
      );

      return [];
    }

    return data || [];
  } catch (error) {
    console.warn(
      `Unable to read ${tableName}:`,
      error
    );

    return [];
  }
}

function deduplicateLocations(rows) {
  const locationMap = new Map();

  rows.forEach(row => {
    const city =
      row.city ||
      row.location_name ||
      row.office_name ||
      row.name ||
      "";

    const country =
      row.country || "";

    const key = normaliseText(
      `${city}|${country}`
    );

    if (!key || key === "|") {
      return;
    }

    if (!locationMap.has(key)) {
      locationMap.set(key, row);
    }
  });

  return [...locationMap.values()].sort(
    (first, second) => {
      const firstCity =
        first.city ||
        first.location_name ||
        first.office_name ||
        first.name ||
        "";

      const secondCity =
        second.city ||
        second.location_name ||
        second.office_name ||
        second.name ||
        "";

      return firstCity.localeCompare(secondCity);
    }
  );
}

/* =======================================
   Shared display helpers
======================================= */

function fact(label, value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  return `
    <div class="fact">
      <span class="fact-label">
        ${escapeHtml(label)}
      </span>

      <span class="fact-value">
        ${escapeHtml(
          formatDisplayValue(value)
        )}
      </span>
    </div>
  `;
}

function profileLink(url, label) {
  if (!url) {
    return "";
  }

  return `
    <a
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
      class="firm-link profile-external-link"
    >
      ${escapeHtml(label)}

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M7 17L17 7"></path>
        <path d="M7 7h10v10"></path>
      </svg>
    </a>
  `;
}

function emptyMessage(message) {
  return `
    <p class="loading">
      ${escapeHtml(message)}
    </p>
  `;
}

function metaPill(icon, text) {
  return `
    <span class="profile-meta-pill">
      ${icon}
      ${escapeHtml(text)}
    </span>
  `;
}

function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDisplayValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value)
      .filter(Boolean)
      .join(", ");
  }

  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return String(value);
}

function formatMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return `£${number.toLocaleString("en-GB")}`;
}

function dateValue(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isNaN(timestamp)
    ? Number.POSITIVE_INFINITY
    : timestamp;
}

function isValidDate(value) {
  return !Number.isNaN(
    new Date(value).getTime()
  );
}

function startOfToday() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

function startOfDate(value) {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

function isTrue(value) {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1"
  );
}

function uniqueSorted(values) {
  return [
    ...new Set(
      values
        .filter(Boolean)
        .map(value => String(value).trim())
        .filter(Boolean)
    )
  ].sort((first, second) =>
    first.localeCompare(second)
  );
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

/* =======================================
   Icons
======================================= */

function locationIcon() {
  return `
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
  `;
}

function rankIcon() {
  return `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7-5.4-4.7 7.1-.6z"></path>
    </svg>
  `;
}

function linkIcon() {
  return `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L11 4.9"></path>
      <path d="M14 11a5 5 0 0 0-7.1 0L4.8 13.1a5 5 0 0 0 7.1 7.1L13 19.1"></path>
    </svg>
  `;
}
