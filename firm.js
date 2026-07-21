// =======================================
// Vacatory
// firm.js — firm profile page
// =======================================

const params = new URLSearchParams(window.location.search);
const firmId = params.get("id");
const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();

    if (!firmId || typeof client === "undefined") {
        showError();
        return;
    }

    loadFirm();
});

function showError() {
    $("loadingState")?.classList.add("hidden");
    $("errorState")?.classList.remove("hidden");
}

function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const tab = button.dataset.tab;

            document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));

            button.classList.add("active");
            $(`tab-${tab}`)?.classList.add("active");
        });
    });
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

    renderFirmHeader(firm);
    renderOverview(firm);

    $("loadingState")?.classList.add("hidden");
    $("profileContent")?.classList.remove("hidden");

    await Promise.all([
        loadPracticeAreas(),
        loadRoles(),
        loadLocations(),
        loadVacationSchemes(firm.careers_url),
        loadTrainingContracts(firm.careers_url)
    ]);
}

function renderFirmHeader(firm) {
    document.title = `${firm.name || "Firm profile"} — Vacatory`;

    $("firmLogo").innerHTML = firm.logo_url
        ? `<img src="${escapeHtml(firm.logo_url)}" alt="${escapeHtml(firm.name)} logo">`
        : escapeHtml((firm.short_name || firm.name || "V").charAt(0).toUpperCase());

    $("firmName").textContent = firm.name || "Firm profile";
    $("firmType").textContent = firm.firm_type || "";
    $("firmOverview").textContent = firm.overview || "No overview available yet.";

    const metaRow = $("firmMeta");
    metaRow.innerHTML = "";

    if (firm.head_office) metaRow.innerHTML += metaPill(locationIcon(), firm.head_office);
    if (firm.uk_rank) metaRow.innerHTML += metaPill(rankIcon(), `UK Rank #${firm.uk_rank}`);
    if (firm.employee_count) metaRow.innerHTML += metaPill(peopleIcon(), `${Number(firm.employee_count).toLocaleString("en-GB")} people/lawyers`);

    const favKey = `vacatory-fav-${firmId}`;
    const favBtn = $("favouriteBtn");

    if (localStorage.getItem(favKey)) favBtn.classList.add("active");

    favBtn.addEventListener("click", () => {
        favBtn.classList.toggle("active");
        if (favBtn.classList.contains("active")) localStorage.setItem(favKey, "1");
        else localStorage.removeItem(favKey);
    });
}

function renderOverview(firm) {
    $("ov-size").textContent = firm.firm_size || "Not yet available";
    $("ov-secondments").textContent = firm.secondments || "Not yet available";
    $("ov-scholarships").textContent = firm.scholarships || "Not yet available";

    const links = $("ov-links");
    links.innerHTML = "";
    if (firm.website) links.innerHTML += profileLink(firm.website, "Firm website");
    if (firm.careers_url) links.innerHTML += profileLink(firm.careers_url, "Careers page");
    if (firm.linkedin) links.innerHTML += profileLink(firm.linkedin, "LinkedIn");
}

async function loadPracticeAreas() {
    const container = $("practiceAreasList");

    const { data, error } = await client
        .from("practice_areas")
        .select("*")
        .eq("firm_id", firmId)
        .order("featured", { ascending: false })
        .order("practice_area", { ascending: true });

    if (error || !data?.length) {
        container.innerHTML = "<p class='loading'>No practice areas listed yet.</p>";
        return;
    }

    container.innerHTML = data.map((pa) => `
        <article class="profile-card">
            <h3>${escapeHtml(pa.practice_area)}${pa.featured ? ' <span class="featured-tag">Featured</span>' : ""}</h3>
            ${formatBullets(pa.description)}
        </article>
    `).join("");
}

async function loadRoles() {
    const container = $("rolesList");

    const { data, error } = await client
        .from("firm_roles")
        .select("role_name")
        .eq("firm_id", firmId)
        .order("role_name", { ascending: true });

    if (error || !data?.length) {
        container.innerHTML = "<p class='loading'>No role data listed yet.</p>";
        return;
    }

    const uniqueRoles = [...new Set(data.map((role) => role.role_name).filter(Boolean))];

    container.innerHTML = `
        <ul class="simple-role-list" aria-label="Firm role titles">
            ${uniqueRoles.map((role) => `<li>${escapeHtml(role)}</li>`).join("")}
        </ul>
    `;
}

async function loadLocations() {
    const container = $("locationsList");

    const { data, error } = await client
        .from("locations")
        .select("*")
        .eq("firm_id", firmId)
        .order("region", { ascending: true })
        .order("country", { ascending: true })
        .order("city", { ascending: true });

    if (error || !data?.length) {
        container.innerHTML = "<p class='loading'>No locations listed yet.</p>";
        return;
    }

    container.innerHTML = data.map((loc) => `
        <article class="profile-card compact-card">
            <h3>${escapeHtml(loc.city)}${loc.country ? `, ${escapeHtml(loc.country)}` : ""}</h3>
            <p>${escapeHtml(loc.office_type || "Office")}${loc.region ? ` — ${escapeHtml(loc.region)}` : ""}</p>
            <div class="location-tags">
                ${loc.offers_vacation_scheme ? '<span class="status-pill">Vacation scheme</span>' : ""}
                ${loc.offers_training_contract ? '<span class="status-pill">Training contract</span>' : ""}
            </div>
        </article>
    `).join("");
}

async function loadVacationSchemes(careersUrl) {
    const container = $("vacationSchemesList");

    const { data, error } = await client
        .from("vacation_schemes")
        .select("*")
        .eq("firm_id", firmId)
        .order("opens_on", { ascending: true, nullsFirst: false })
        .order("location", { ascending: true });

    if (error || !data?.length) {
        container.innerHTML = careersUrl
            ? `<p class='loading'>No vacation scheme data listed yet. ${profileLink(careersUrl, "Visit the firm's careers page")}</p>`
            : "<p class='loading'>No vacation scheme data listed yet.</p>";
        return;
    }

    container.innerHTML = data.map((vs) => `
        <article class="profile-card">
            <h3>${escapeHtml(vs.scheme_name || "Vacation Scheme")}</h3>
            <p class="muted-line">${escapeHtml([vs.scheme_type, vs.location].filter(Boolean).join(" — "))}</p>
            <div class="profile-fact-grid">
                ${fact("Opens", formatDate(vs.opens_on))}
                ${fact("Deadline", formatDate(vs.deadline))}
                ${fact("Programme", dateRange(vs.programme_start, vs.programme_end))}
                ${fact("Duration", vs.duration)}
                ${fact("Salary", vs.salary)}
                ${fact("Status", vs.status)}
            </div>
            ${vs.eligibility ? `<div class="profile-eligibility"><strong>Eligibility</strong>${formatBullets(vs.eligibility)}</div>` : ""}
            ${vs.application_process ? `<details class="more-details"><summary>Application process</summary>${formatBullets(vs.application_process)}</details>` : ""}
            ${(vs.application_link || careersUrl) ? profileLink(vs.application_link || careersUrl, "Apply / more info") : ""}
        </article>
    `).join("");
}

async function loadTrainingContracts(careersUrl) {
    const container = $("trainingContractList");

    const { data, error } = await client
        .from("training_contracts")
        .select("*")
        .eq("firm_id", firmId)
        .order("start_date", { ascending: true, nullsFirst: false })
        .order("location", { ascending: true });

    if (error || !data?.length) {
        container.innerHTML = careersUrl
            ? `<p class='loading'>No training contract data listed yet. ${profileLink(careersUrl, "Visit the firm's careers page")}</p>`
            : "<p class='loading'>No training contract data listed yet.</p>";
        return;
    }

    container.innerHTML = data.map((tc) => `
        <article class="profile-card">
            <h3>Training Contract${tc.intake_year ? ` — ${escapeHtml(tc.intake_year)} intake` : ""}</h3>
            <p class="muted-line">${escapeHtml(tc.location || "")}</p>
            <div class="profile-fact-grid">
                ${fact("Applications open", formatDate(tc.application_open))}
                ${fact("Deadline", formatDate(tc.application_deadline))}
                ${fact("Start date", formatDate(tc.start_date))}
                ${fact("Year 1 salary", formatMoney(tc.salary_first_year))}
                ${fact("Year 2 salary", formatMoney(tc.salary_second_year))}
                ${fact("NQ salary", formatMoney(tc.salary_qualification))}
                ${fact("Seats", tc.seats)}
                ${fact("Status", tc.status)}
            </div>
            ${tc.eligibility ? `<div class="profile-eligibility"><strong>Eligibility</strong>${formatBullets(tc.eligibility)}</div>` : ""}
            ${tc.application_process ? `<details class="more-details"><summary>Programme and application process</summary>${formatBullets(tc.application_process)}</details>` : ""}
            ${(tc.application_link || careersUrl) ? profileLink(tc.application_link || careersUrl, "Apply / more info") : ""}
        </article>
    `).join("");
}

function metaPill(icon, text) {
    return `<span class="profile-meta-pill">${icon}${escapeHtml(text)}</span>`;
}

function profileLink(url, label) {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="firm-link profile-external-link">${escapeHtml(label)}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"></path></svg>
    </a>`;
}

function fact(label, value) {
    if (value === null || value === undefined || value === "") return "";
    return `<div class="fact"><span class="fact-label">${escapeHtml(label)}</span><span class="fact-value">${escapeHtml(value)}</span></div>`;
}

function formatBullets(text) {
    if (!text) return "";

    const lines = String(text)
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) return "";

    const bulletLines = lines
        .map((line) => line.replace(/^•\s*/, "").trim())
        .filter(Boolean);

    if (lines.some((line) => line.startsWith("•"))) {
        return `<ul class="content-bullets">${bulletLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
    }

    return `<p>${escapeHtml(text)}</p>`;
}

function formatDate(d) {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function dateRange(start, end) {
    if (!start && !end) return "";
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
    return formatDate(start || end);
}

function formatMoney(n) {
    if (n === null || n === undefined || n === "") return "";
    return `£${Number(n).toLocaleString("en-GB")}`;
}

function locationIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2.4"></circle></svg>`;
}

function rankIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7-5.4-4.7 7.1-.6z"></path></svg>`;
}

function peopleIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
}
