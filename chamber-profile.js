// =======================================
// Vacatory
// chamber-profile.js
// Individual barristers' chambers profile
// =======================================

const chamberParams = new URLSearchParams(window.location.search);
const chamberId = chamberParams.get("id");

document.addEventListener("DOMContentLoaded", () => {
  setupProfileTabs();

  if (!chamberId) {
    showProfileError();
    return;
  }

  loadChamberProfile();
});

async function loadChamberProfile() {
  if (typeof client === "undefined") {
    console.error("The Supabase client is unavailable.");
    showProfileError();
    return;
  }

  try {
    const { data: chamber, error } = await client
      .from("chambers")
      .select("*")
      .eq("id", chamberId)
      .single();

    if (error || !chamber) {
      throw error || new Error("Chambers profile not found.");
    }

    renderChamberHeader(chamber);

    const opportunities =
      await loadChamberOpportunityRows(chamber);

    await Promise.all([
      loadPracticeAreas(chamber),
      loadLocations(chamber),
      loadOpportunities(chamber, opportunities),
      loadFunding(chamber, opportunities),
      loadAccessibility(chamber)
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
    console.error(
      "Unable to load chambers profile:",
      error
    );

    showProfileError();
  }
}

function showProfileError() {
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

/* =======================================
   Tabs
======================================= */

function setupProfileTabs() {
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
   Header
======================================= */

function getChamberName(chamber) {
  return (
    chamber.name ||
    chamber.official_name ||
    chamber.chambers_name ||
    chamber.trading_name ||
    "Barristers’ chambers"
  );
}

function renderChamberHeader(chamber) {
  const name = getChamberName(chamber);

  document.title = `${name} — Vacatory`;

  const logo =
    document.getElementById("chambersLogo");

  const nameElement =
    document.getElementById("chambersName");

  const typeElement =
    document.getElementById("chambersType");

  const overviewElement =
    document.getElementById("chambersOverview");

  const metaElement =
    document.getElementById("chambersMeta");

  if (logo) {
    const initial = (
      chamber.short_name ||
      name
    )
      .trim()
      .charAt(0)
      .toUpperCase();

    logo.innerHTML = chamber.logo_url
      ? `
        <img
          src="${escapeHtml(chamber.logo_url)}"
          alt="${escapeHtml(name)} logo"
        >
      `
      : escapeHtml(initial);
  }

  if (nameElement) {
    nameElement.textContent = name;
  }

  if (typeElement) {
    typeElement.textContent =
      chamber.chambers_type ||
      chamber.type ||
      "Barristers’ chambers";
  }

  if (overviewElement) {
    overviewElement.textContent =
      chamber.overview ||
      chamber.official_overview ||
      chamber.description ||
      "A detailed overview has not yet been added.";
  }

  if (metaElement) {
    const items = [];

    const location =
      chamber.principal_location ||
      chamber.principal_city ||
      chamber.city ||
      chamber.location;

    if (location) {
      items.push(
        metaPill(
          locationIcon(),
          location
        )
      );
    }

    if (chamber.circuit || chamber.region) {
      items.push(
        metaPill(
          circuitIcon(),
          chamber.circuit ||
          chamber.region
        )
      );
    }

    if (
      chamber.website ||
      chamber.website_url
    ) {
      items.push(
        metaPill(
          linkIcon(),
          "Official website available"
        )
      );
    }

    metaElement.innerHTML = items.join("");
  }

  renderOverviewFacts(chamber);
  renderOfficialLinks(chamber);
}

function renderOverviewFacts(chamber) {
  const totalMembers =
    chamber.number_of_members ??
    chamber.member_count ??
    chamber.members_count ??
    chamber.total_members;

  const silks =
    chamber.number_of_silks ??
    chamber.silk_count ??
    chamber.silks_count;

  const juniors =
    chamber.number_of_juniors ??
    chamber.junior_count ??
    chamber.juniors_count;

  const membershipParts = [];

  if (
    silks !== null &&
    silks !== undefined &&
    silks !== ""
  ) {
    membershipParts.push(`${silks} silks`);
  }

  if (
    juniors !== null &&
    juniors !== undefined &&
    juniors !== ""
  ) {
    membershipParts.push(`${juniors} juniors`);
  }

  setText(
    "ov-members",
    totalMembers !== null &&
    totalMembers !== undefined &&
    totalMembers !== ""
      ? String(totalMembers)
      : "Not yet available"
  );

  setText(
    "ov-membership",
    membershipParts.length
      ? membershipParts.join(" · ")
      : "Not yet available"
  );

  setText(
    "ov-circuit",
    chamber.circuit ||
    chamber.region ||
    "Not yet available"
  );
}

function renderOfficialLinks(chamber) {
  const container =
    document.getElementById("ov-links");

  if (!container) {
    return;
  }

  const links = [];

  const website =
    chamber.website ||
    chamber.website_url ||
    chamber.official_website;

  const pupillageUrl =
    chamber.pupillage_url ||
    chamber.pupillage_page ||
    chamber.recruitment_url;

  const miniPupillageUrl =
    chamber.mini_pupillage_url ||
    chamber.mini_pupillage_page;

  if (website) {
    links.push(
      profileLink(
        website,
        "Official chambers website"
      )
    );
  }

  if (pupillageUrl) {
    links.push(
      profileLink(
        pupillageUrl,
        "Official pupillage information"
      )
    );
  }

  if (miniPupillageUrl) {
    links.push(
      profileLink(
        miniPupillageUrl,
        "Official mini-pupillage information"
      )
    );
  }

  container.innerHTML = links.length
    ? links.join("")
    : emptyMessage(
        "Official links have not yet been added."
      );
}

/* =======================================
   Practice areas
======================================= */

async function loadPracticeAreas(chamber) {
  const container =
    document.getElementById("practiceAreasList");

  if (!container) {
    return;
  }

  const rows = [];

  rows.push(
    ...await readRowsUsingPossibleKeys(
      "chambers_practice_areas",
      [
        ["chambers_id", chamberId],
        ["organisation_id", chamber.organisation_id]
      ]
    )
  );

  rows.push(
    ...await readRowsUsingPossibleKeys(
      "organisation_practice_areas",
      [
        ["organisation_id", chamber.organisation_id]
      ]
    )
  );

  const ownPracticeAreas = parseListValue(
    chamber.practice_areas ||
    chamber.practice_areas_list ||
    chamber.services
  );

  const mappedAreas = rows
    .map(row => ({
      name:
        row.practice_area ||
        row.practice_name ||
        row.service_name ||
        row.name,

      description:
        row.description ||
        row.summary ||
        ""
    }))
    .filter(area => area.name);

  ownPracticeAreas.forEach(name => {
    mappedAreas.push({
      name,
      description: ""
    });
  });

  const uniqueAreas = deduplicateObjects(
    mappedAreas,
    area => normaliseText(area.name)
  ).sort((first, second) =>
    first.name.localeCompare(second.name)
  );

  if (!uniqueAreas.length) {
    container.innerHTML = emptyMessage(
      "No practice areas have been listed yet."
    );

    return;
  }

  container.innerHTML = uniqueAreas
    .map(area => `
      <article class="profile-card">
        <h3>${escapeHtml(area.name)}</h3>

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
   Locations
======================================= */

async function loadLocations(chamber) {
  const container =
    document.getElementById("locationsList");

  if (!container) {
    return;
  }

  const rows = await readRowsUsingPossibleKeys(
    "organisation_locations",
    [
      ["organisation_id", chamber.organisation_id],
      ["chambers_id", chamberId]
    ]
  );

  const ownLocation = {
    city:
      chamber.principal_city ||
      chamber.principal_location ||
      chamber.city ||
      chamber.location,

    country:
      chamber.country,

    region:
      chamber.circuit ||
      chamber.region,

    address:
      chamber.principal_address ||
      chamber.address,

    accessibility:
      chamber.premises_accessibility ||
      chamber.accessibility_information
  };

  const allLocations = [...rows];

  if (ownLocation.city || ownLocation.address) {
    allLocations.push(ownLocation);
  }

  const uniqueLocations = deduplicateObjects(
    allLocations,
    location => {
      const city =
        location.city ||
        location.location_name ||
        location.office_name ||
        location.name ||
        "";

      const address =
        location.address ||
        location.office_address ||
        "";

      return normaliseText(
        `${city}|${address}`
      );
    }
  );

  if (!uniqueLocations.length) {
    container.innerHTML = emptyMessage(
      "No chambers locations have been listed yet."
    );

    return;
  }

  container.innerHTML = uniqueLocations
    .map(location => {
      const city =
        location.city ||
        location.location_name ||
        location.office_name ||
        location.name ||
        "Chambers";

      const country =
        location.country || "";

      const region =
        location.circuit ||
        location.region ||
        "";

      const address =
        location.address ||
        location.office_address ||
        "";

      const accessibility =
        location.accessibility ||
        location.accessibility_information ||
        location.premises_accessibility ||
        "";

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
            region
              ? `<p>${escapeHtml(region)}</p>`
              : ""
          }

          ${
            address
              ? `<p>${escapeHtml(address)}</p>`
              : ""
          }

          ${
            accessibility
              ? `
                <p>
                  <strong>Accessibility:</strong>
                  ${escapeHtml(accessibility)}
                </p>
              `
              : ""
          }
        </article>
      `;
    })
    .join("");
}

/* =======================================
   Opportunity data
======================================= */

async function loadChamberOpportunityRows(chamber) {
  const rows = [];

  rows.push(
    ...await readRowsUsingPossibleKeys(
      "vacation_schemes",
      [
        ["chambers_id", chamberId],
        ["organisation_id", chamber.organisation_id]
      ]
    )
  );

  rows.push(
    ...await readRowsUsingPossibleKeys(
      "deadlines_public_view",
      [
        ["chambers_id", chamberId],
        ["organisation_id", chamber.organisation_id],
        ["provider_id", chamber.organisation_id]
      ]
    )
  );

  return deduplicateObjects(
    rows,
    row => {
      const id =
        row.id ||
        row.opportunity_id ||
        row.cycle_id ||
        "";

      const name =
        row.scheme_name ||
        row.opportunity_name ||
        row.programme_name ||
        row.opportunity_type ||
        "";

      const closingDate =
        row.application_close_date ||
        row.application_deadline ||
        row.deadline ||
        row.closes_on ||
        "";

      return normaliseText(
        `${id}|${name}|${closingDate}`
      );
    }
  );
}

/* =======================================
   Combined opportunities
======================================= */

async function loadOpportunities(
  chamber,
  opportunityRows
) {
  const list =
    document.getElementById("opportunitiesList");

  const loading =
    document.getElementById("opportunitiesLoading");

  const empty =
    document.getElementById("opportunitiesEmpty");

  if (!list) {
    return;
  }

  const opportunities = opportunityRows
    .map(row =>
      normaliseChamberOpportunity(
        row,
        chamber
      )
    )
    .filter(Boolean)
    .sort(sortOpportunitiesByClosingDate);

  loading?.classList.add("hidden");

  if (!opportunities.length) {
    empty?.classList.remove("hidden");
    list.innerHTML = "";

    const fallbackUrl =
      chamber.pupillage_url ||
      chamber.pupillage_page ||
      chamber.mini_pupillage_url ||
      chamber.mini_pupillage_page ||
      chamber.recruitment_url ||
      chamber.website ||
      chamber.website_url;

    if (fallbackUrl) {
      empty.innerHTML = `
        No structured opportunity records have been added yet.

        ${profileLink(
          fallbackUrl,
          "Visit the official recruitment page"
        )}
      `;
    }

    return;
  }

  empty?.classList.add("hidden");

  list.innerHTML = opportunities
    .map(renderOpportunity)
    .join("");
}

function normaliseChamberOpportunity(
  row,
  chamber
) {
  const typeCode =
    getOpportunityType(row);

  if (!typeCode) {
    return null;
  }

  const defaultName =
    typeCode === "pupillage"
      ? "Pupillage"
      : typeCode === "assessed_mini_pupillage"
        ? "Assessed mini-pupillage"
        : "Mini-pupillage";

  const defaultType =
    typeCode === "pupillage"
      ? "Pupillage"
      : typeCode === "assessed_mini_pupillage"
        ? "Assessed mini-pupillage"
        : "Mini-pupillage";

  const name =
    row.scheme_name ||
    row.opportunity_name ||
    row.programme_name ||
    row.official_name ||
    defaultName;

  const location =
    row.location ||
    row.location_text ||
    row.city ||
    chamber.principal_location ||
    chamber.principal_city ||
    chamber.city ||
    "Location not stated";

  const applicationUrl =
    row.application_url ||
    row.application_link ||
    row.official_url ||
    row.source_url ||
    (
      typeCode === "pupillage"
        ? (
          chamber.pupillage_url ||
          chamber.pupillage_page ||
          chamber.recruitment_url
        )
        : (
          chamber.mini_pupillage_url ||
          chamber.mini_pupillage_page ||
          chamber.recruitment_url
        )
    );

  return {
    typeCode,
    name,

    type:
      row.opportunity_type_name ||
      row.opportunity_type ||
      row.scheme_type ||
      defaultType,

    location,

    practiceArea:
      row.practice_area ||
      row.practice_area_name,

    openingDate:
      row.application_open_date ||
      row.application_open ||
      row.opens_on ||
      row.opening_date,

    closingDate:
      row.application_close_date ||
      row.application_deadline ||
      row.deadline ||
      row.closes_on,

    startDate:
      row.start_date ||
      row.programme_start_date ||
      row.pupillage_start_date,

    programmeDates:
      row.programme_dates ||
      row.scheme_dates ||
      row.actual_programme_dates,

    duration:
      row.duration ||
      row.programme_length,

    status:
      row.application_status ||
      row.status,

    award:
      row.pupillage_award ||
      row.award_amount ||
      row.funding_amount ||
      row.salary ||
      row.payment,

    places:
      row.number_of_places ||
      row.number_of_pupillages ||
      row.places,

    format:
      row.format ||
      row.delivery_method,

    applicationRoute:
      row.application_route ||
      row.application_method,

    assessed:
      typeCode === "assessed_mini_pupillage"
        ? "Yes"
        : row.assessed,

    eligibility:
      row.eligibility,

    academicRequirements:
      row.academic_requirements ||
      row.academic_requirement,

    applicationProcess:
      row.application_process ||
      row.selection_process,

    interviewProcess:
      row.interview_process ||
      row.interview_stages,

    writtenAssessment:
      row.written_assessment ||
      row.written_exercise,

    advocacyAssessment:
      row.advocacy_assessment ||
      row.advocacy_exercise,

    structure:
      row.pupillage_structure ||
      row.programme_structure ||
      row.structure,

    tenancy:
      row.tenancy_information ||
      row.tenancy_process,

    expenses:
      row.travel_expenses ||
      row.expenses_support ||
      row.expense_support,

    reasonableAdjustments:
      row.reasonable_adjustments ||
      row.adjustments_process,

    additionalDetails:
      row.additional_details ||
      row.notes ||
      row.description,

    applicationUrl
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

  return startOfDate(value) >= startOfToday()
    ? 0
    : 2;
}

function renderOpportunity(opportunity) {
  const deadline =
    formatDate(opportunity.closingDate) ||
    "Not announced";

  const startDate =
    formatOpportunityStart(opportunity) ||
    "Not announced";

  const facts =
    buildOpportunityFacts(opportunity);

  const detailSections =
    buildOpportunityDetailSections(
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
          <h3>${escapeHtml(opportunity.name)}</h3>

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
      "Location",
      opportunity.location
    ),

    fact(
      "Practice area",
      opportunity.practiceArea
    ),

    fact(
      "Places",
      opportunity.places
    ),

    fact(
      "Pupillage award or payment",
      formatMoneyOrText(
        opportunity.award
      )
    ),

    fact(
      "Format",
      opportunity.format
    ),

    fact(
      "Assessed",
      formatDisplayValue(
        opportunity.assessed
      )
    ),

    fact(
      "Application route",
      opportunity.applicationRoute
    ),

    fact(
      "Status",
      opportunity.status
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
    "Application process",
    opportunity.applicationProcess
  );

  addBulletSection(
    sections,
    "Interview process",
    opportunity.interviewProcess
  );

  addBulletSection(
    sections,
    "Written assessment",
    opportunity.writtenAssessment
  );

  addBulletSection(
    sections,
    "Advocacy assessment",
    opportunity.advocacyAssessment
  );

  addBulletSection(
    sections,
    "Programme structure",
    opportunity.structure
  );

  addBulletSection(
    sections,
    "Tenancy information",
    opportunity.tenancy
  );

  addBulletSection(
    sections,
    "Travel and expenses",
    opportunity.expenses
  );

  addBulletSection(
    sections,
    "Reasonable adjustments",
    opportunity.reasonableAdjustments
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
   Funding
======================================= */

async function loadFunding(
  chamber,
  opportunities
) {
  const container =
    document.getElementById("fundingList");

  if (!container) {
    return;
  }

  const fundingCards = [];

  const chamberFunding =
    collectPresentFields(
      chamber,
      [
        [
          "Pupillage award",
          [
            "pupillage_award",
            "award_amount",
            "pupillage_funding"
          ]
        ],
        [
          "Drawdown",
          [
            "drawdown",
            "drawdown_available",
            "award_drawdown"
          ]
        ],
        [
          "Guaranteed earnings",
          [
            "guaranteed_earnings",
            "receipts_guarantee",
            "minimum_receipts"
          ]
        ],
        [
          "Travel or expenses",
          [
            "travel_expenses",
            "expenses_support",
            "expense_support"
          ]
        ],
        [
          "Bar course support",
          [
            "bar_course_funding",
            "bar_course_support"
          ]
        ]
      ]
    );

  if (chamberFunding.length) {
    fundingCards.push(`
      <article class="profile-card">
        <h3>Chambers funding</h3>

        <div class="profile-fact-grid">
          ${chamberFunding
            .map(item =>
              fact(
                item.label,
                formatMoneyOrText(item.value)
              )
            )
            .join("")}
        </div>
      </article>
    `);
  }

  opportunities
    .filter(row =>
      getOpportunityType(row) === "pupillage"
    )
    .forEach(row => {
      const award =
        row.pupillage_award ||
        row.award_amount ||
        row.funding_amount ||
        row.salary ||
        row.payment;

      const drawdown =
        row.drawdown ||
        row.drawdown_available ||
        row.award_drawdown;

      const guaranteedEarnings =
        row.guaranteed_earnings ||
        row.receipts_guarantee ||
        row.minimum_receipts;

      if (
        !award &&
        !drawdown &&
        !guaranteedEarnings
      ) {
        return;
      }

      const name =
        row.scheme_name ||
        row.opportunity_name ||
        row.programme_name ||
        "Pupillage";

      fundingCards.push(`
        <article class="profile-card">
          <h3>${escapeHtml(name)}</h3>

          <div class="profile-fact-grid">
            ${fact(
              "Award",
              formatMoneyOrText(award)
            )}

            ${fact(
              "Drawdown",
              formatDisplayValue(drawdown)
            )}

            ${fact(
              "Guaranteed earnings",
              formatMoneyOrText(
                guaranteedEarnings
              )
            )}

            ${fact(
              "Payment timing",
              row.payment_schedule ||
              row.payment_timing
            )}

            ${fact(
              "Travel support",
              row.travel_expenses ||
              row.expenses_support
            )}

            ${fact(
              "Relocation support",
              row.relocation_support
            )}
          </div>
        </article>
      `);
    });

  container.innerHTML = fundingCards.length
    ? fundingCards.join("")
    : emptyMessage(
        "No verified funding information has been added yet."
      );
}

/* =======================================
   EDI and accessibility
======================================= */

async function loadAccessibility(chamber) {
  const container =
    document.getElementById("accessibilityList");

  if (!container) {
    return;
  }

  const sections = [
    {
      title:
        "Equality, diversity and inclusion",

      value:
        firstPresentValue(
          chamber,
          [
            "edi_information",
            "equality_diversity_inclusion",
            "diversity_information",
            "edi_policy"
          ]
        )
    },
    {
      title:
        "Reasonable adjustments",

      value:
        firstPresentValue(
          chamber,
          [
            "reasonable_adjustments",
            "adjustments_process",
            "candidate_adjustments"
          ]
        )
    },
    {
      title:
        "Premises accessibility",

      value:
        firstPresentValue(
          chamber,
          [
            "premises_accessibility",
            "accessibility_information",
            "building_accessibility"
          ]
        )
    },
    {
      title:
        "Social mobility and outreach",

      value:
        firstPresentValue(
          chamber,
          [
            "social_mobility",
            "outreach_information",
            "access_programmes"
          ]
        )
    },
    {
      title:
        "Adjustments contact",

      value:
        firstPresentValue(
          chamber,
          [
            "adjustments_contact",
            "accessibility_contact",
            "recruitment_contact"
          ]
        )
    }
  ].filter(section => section.value);

  if (!sections.length) {
    container.innerHTML = emptyMessage(
      "No detailed EDI or accessibility information has been added yet."
    );

    return;
  }

  container.innerHTML = sections
    .map(section => {
      const points =
        splitIntoBulletPoints(section.value);

      return `
        <article class="profile-card">
          <h3>${escapeHtml(section.title)}</h3>

          ${
            points.length > 1
              ? `
                <ul class="opportunity-bullets">
                  ${points
                    .map(point => `
                      <li>${escapeHtml(point)}</li>
                    `)
                    .join("")}
                </ul>
              `
              : `
                <p>
                  ${escapeHtml(
                    formatDisplayValue(
                      section.value
                    )
                  )}
                </p>
              `
          }
        </article>
      `;
    })
    .join("");
}

/* =======================================
   Opportunity type
======================================= */

function getOpportunityType(row) {
  const rawType = normaliseText(
    row.opportunity_type_name ||
    row.opportunity_type ||
    row.scheme_type ||
    row.scheme_name ||
    row.opportunity_name ||
    row.programme_name ||
    ""
  );

  if (
    rawType.includes("assessed") &&
    rawType.includes("mini")
  ) {
    return "assessed_mini_pupillage";
  }

  if (rawType.includes("mini")) {
    return "mini_pupillage";
  }

  if (rawType.includes("pupillage")) {
    return "pupillage";
  }

  return "";
}

/* =======================================
   Database helpers
======================================= */

async function readRowsUsingPossibleKeys(
  tableName,
  keyPairs
) {
  const rows = [];

  for (const [columnName, value] of keyPairs) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    try {
      const { data, error } = await client
        .from(tableName)
        .select("*")
        .eq(columnName, value);

      if (error) {
        console.warn(
          `Unable to query ${tableName}.${columnName}:`,
          error.message
        );

        continue;
      }

      rows.push(...(data || []));
    } catch (error) {
      console.warn(
        `Unable to query ${tableName}.${columnName}:`,
        error
      );
    }
  }

  return deduplicateObjects(
    rows,
    row => String(
      row.id ||
      row.cycle_id ||
      row.opportunity_id ||
      JSON.stringify(row)
    )
  );
}

function collectPresentFields(
  record,
  definitions
) {
  return definitions
    .map(([label, keys]) => ({
      label,
      value: firstPresentValue(
        record,
        keys
      )
    }))
    .filter(item =>
      item.value !== null &&
      item.value !== undefined &&
      item.value !== ""
    );
}

function firstPresentValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      return value;
    }
  }

  return "";
}

function parseListValue(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    return Object.values(value)
      .flatMap(parseListValue)
      .filter(Boolean);
  }

  return String(value)
    .split(/[,;|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function deduplicateObjects(
  rows,
  keyFunction
) {
  const map = new Map();

  rows.forEach(row => {
    const key = keyFunction(row);

    if (!key) {
      return;
    }

    if (!map.has(key)) {
      map.set(key, row);
    }
  });

  return [...map.values()];
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

function metaPill(icon, text) {
  return `
    <span class="profile-meta-pill">
      ${icon}
      ${escapeHtml(text)}
    </span>
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

function formatMoneyOrText(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  if (typeof value === "number") {
    return `£${value.toLocaleString("en-GB")}`;
  }

  const text = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(text)) {
    return `£${Number(text).toLocaleString("en-GB")}`;
  }

  return text;
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

function circuitIcon() {
  return `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M8 12h8"></path>
      <path d="M12 8v8"></path>
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
