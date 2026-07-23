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
      loadVacationSchemes(firm),
      loadTrainingContracts(firm)
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

    firmMeta.innerHTML =
      metaItems.join("");
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
    : `
      <p class="loading">
        Official links have not yet been added.
      </p>
    `;
}

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

      const targetPanel =
        document.getElementById(`tab-${target}`);

      targetPanel?.classList.add("active");
    });
  });
}

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

  if (!rows.length) {
    container.innerHTML = emptyMessage(
      "No practice areas have been listed yet."
    );

    return;
  }

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

async function loadVacationSchemes(firm) {
  const container =
    document.getElementById("vacationSchemesList");

  if (!container) {
    return;
  }

  const rows = await readOptionalRows(
    "vacation_schemes",
    "firm_id",
    firmId
  );

  const sortedRows = [...rows].sort(
    (first, second) =>
      dateValue(
        first.deadline ||
        first.application_close_date ||
        first.closes_on
      ) -
      dateValue(
        second.deadline ||
        second.application_close_date ||
        second.closes_on
      )
  );

  if (!sortedRows.length) {
    container.innerHTML = firm.careers_url
      ? `
        <p class="loading">
          No vacation-scheme records have been added yet.
          ${profileLink(
            firm.careers_url,
            "Visit the official careers page"
          )}
        </p>
      `
      : emptyMessage(
          "No vacation-scheme records have been added yet."
        );

    return;
  }

  container.innerHTML = sortedRows
    .map(scheme => {
      const schemeName =
        scheme.scheme_name ||
        scheme.opportunity_name ||
        scheme.programme_name ||
        "Vacation scheme";

      const schemeType =
        scheme.scheme_type ||
        scheme.opportunity_type ||
        "";

      const location =
        scheme.location ||
        scheme.location_text ||
        "";

      const applicationOpen =
        scheme.opens_on ||
        scheme.application_open ||
        scheme.application_open_date;

      const applicationDeadline =
        scheme.deadline ||
        scheme.application_deadline ||
        scheme.application_close_date ||
        scheme.closes_on;

      const programmeDates =
        scheme.programme_dates ||
        scheme.scheme_dates ||
        scheme.actual_programme_dates ||
        "";

      const applicationLink =
        scheme.application_link ||
        scheme.application_url ||
        firm.careers_url;

      return `
        <article class="profile-card application-card">
          <h3>
            ${escapeHtml(schemeName)}
          </h3>

          ${
            schemeType || location
              ? `
                <p>
                  ${escapeHtml(schemeType)}
                  ${
                    schemeType && location
                      ? " — "
                      : ""
                  }
                  ${escapeHtml(location)}
                </p>
              `
              : ""
          }

          <div class="profile-fact-grid">
            ${fact(
              "Applications open",
              formatDate(applicationOpen)
            )}

            ${fact(
              "Application deadline",
              formatDate(applicationDeadline)
            )}

            ${fact(
              "Programme dates",
              formatDisplayValue(programmeDates)
            )}

            ${fact(
              "Duration",
              scheme.duration ||
              scheme.programme_length
            )}

            ${fact(
              "Salary",
              scheme.salary ||
              scheme.payment
            )}

            ${fact(
              "Status",
              scheme.application_status ||
              scheme.status
            )}
          </div>

          ${
            scheme.eligibility
              ? `
                <p class="profile-eligibility">
                  <strong>Eligibility:</strong>
                  ${escapeHtml(scheme.eligibility)}
                </p>
              `
              : ""
          }

          ${
            applicationLink
              ? profileLink(
                  applicationLink,
                  "Official application information"
                )
              : ""
          }
        </article>
      `;
    })
    .join("");
}

async function loadTrainingContracts(firm) {
  const container =
    document.getElementById("trainingContractList");

  if (!container) {
    return;
  }

  const rows = await readOptionalRows(
    "training_contracts",
    "firm_id",
    firmId
  );

  const sortedRows = [...rows].sort(
    (first, second) =>
      dateValue(
        first.application_deadline ||
        first.application_close_date
      ) -
      dateValue(
        second.application_deadline ||
        second.application_close_date
      )
  );

  if (!sortedRows.length) {
    container.innerHTML = firm.careers_url
      ? `
        <p class="loading">
          No training-contract records have been added yet.
          ${profileLink(
            firm.careers_url,
            "Visit the official careers page"
          )}
        </p>
      `
      : emptyMessage(
          "No training-contract records have been added yet."
        );

    return;
  }

  container.innerHTML = sortedRows
    .map(contract => {
      const programmeName =
        contract.programme_name ||
        contract.training_contract_name ||
        "Training contract";

      const intake =
        contract.intake_year ||
        contract.start_year ||
        "";

      const applicationOpen =
        contract.application_open ||
        contract.application_open_date;

      const applicationDeadline =
        contract.application_deadline ||
        contract.application_close_date;

      const startDate =
        contract.start_date ||
        contract.programme_start_date;

      const applicationLink =
        contract.application_link ||
        contract.application_url ||
        firm.careers_url;

      return `
        <article class="profile-card application-card">
          <h3>
            ${escapeHtml(programmeName)}
            ${
              intake
                ? ` — ${escapeHtml(intake)} intake`
                : ""
            }
          </h3>

          ${
            contract.location
              ? `<p>${escapeHtml(contract.location)}</p>`
              : ""
          }

          <div class="profile-fact-grid">
            ${fact(
              "Applications open",
              formatDate(applicationOpen)
            )}

            ${fact(
              "Application deadline",
              formatDate(applicationDeadline)
            )}

            ${fact(
              "Start date",
              formatDate(startDate)
            )}

            ${fact(
              "First-year salary",
              formatMoney(
                contract.salary_first_year
              )
            )}

            ${fact(
              "Second-year salary",
              formatMoney(
                contract.salary_second_year
              )
            )}

            ${fact(
              "NQ salary",
              formatMoney(
                contract.salary_qualification ||
                contract.nq_salary
              )
            )}

            ${fact(
              "Seats",
              contract.seats ||
              contract.number_of_seats
            )}

            ${fact(
              "Status",
              contract.application_status ||
              contract.status
            )}
          </div>

          ${
            contract.eligibility
              ? `
                <p class="profile-eligibility">
                  <strong>Eligibility:</strong>
                  ${escapeHtml(contract.eligibility)}
                </p>
              `
              : ""
          }

          ${
            applicationLink
              ? profileLink(
                  applicationLink,
                  "Official application information"
                )
              : ""
          }
        </article>
      `;
    })
    .join("");
}

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
        ${escapeHtml(value)}
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
