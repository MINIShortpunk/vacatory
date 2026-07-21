// =======================================
// Vacatory
// firm.js — firm profile page
// =======================================

const params = new URLSearchParams(window.location.search);
const firmId = params.get("id");

document.addEventListener("DOMContentLoaded", () => {

    if (!firmId) {
        showError();
        return;
    }

    loadFirm();

});

function showError() {
    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("errorState").classList.remove("hidden");
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

    // Header
    document.getElementById("firmLogo").innerHTML = firm.logo_url
        ? `<img src="${firm.logo_url}" alt="${firm.name} logo">`
        : (firm.short_name || firm.name || "V").charAt(0);

    document.getElementById("firmName").textContent = firm.name;
    document.getElementById("firmType").textContent = firm.firm_type ?? "";
    document.getElementById("firmOverview").textContent = firm.overview ?? "";

    const metaRow = document.getElementById("firmMeta");
    metaRow.innerHTML = "";

    if (firm.head_office) {
        metaRow.innerHTML += metaPill(locationIcon(), firm.head_office);
    }

    if (firm.uk_rank) {
        metaRow.innerHTML += metaPill(rankIcon(), `UK Rank #${firm.uk_rank}`);
    }

    // Overview tab
    document.getElementById("ov-size").textContent = firm.firm_size || "Not yet available";
    document.getElementById("ov-secondments").textContent = firm.secondments || "Not yet available";
    document.getElementById("ov-scholarships").textContent = firm.scholarships || "Not yet available";

    const links = document.getElementById("ov-links");
    links.innerHTML = "";

    if (firm.website) links.innerHTML += profileLink(firm.website, "Firm website");
    if (firm.careers_url) links.innerHTML += profileLink(firm.careers_url, "Careers page");
    if (firm.linkedin) links.innerHTML += profileLink(firm.linkedin, "LinkedIn");

    // Favourite button state
    const favKey = `vacatory-fav-${firmId}`;
    const favBtn = document.getElementById("favouriteBtn");

    if (localStorage.getItem(favKey)) {
        favBtn.classList.add("active");
    }

    favBtn.addEventListener("click", () => {
        favBtn.classList.toggle("active");

        if (favBtn.classList.contains("active")) {
            localStorage.setItem(favKey, "1");
        } else {
            localStorage.removeItem(favKey);
        }
    });

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("profileContent").classList.remove("hidden");

    loadPracticeAreas();
    loadRoles();
    loadLocations();
    loadVacationSchemes(firm.careers_url);
    loadTrainingContracts(firm.careers_url);

}

function metaPill(icon, text) {
    return `<span class="profile-meta-pill">${icon}${text}</span>`;
}

function locationIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2.4"></circle></svg>`;
}

function rankIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7-5.4-4.7 7.1-.6z"></path></svg>`;
}

function profileLink(url, label) {
    return `<a href="${url}" target="_blank" rel="noopener" class="firm-link profile-external-link">${label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M7 7h10v10"></path></svg>
    </a>`;
}

async function loadPracticeAreas() {

    const container = document.getElementById("practiceAreasList");

    const { data, error } = await client
        .from("practice_areas")
        .select("*")
        .eq("firm_id", firmId)
        .order("featured", { ascending: false });

    if (error || !data || !data.length) {
        container.innerHTML = "<p class='loading'>No practice areas listed yet.</p>";
        return;
    }

    container.innerHTML = data.map(pa => `
        <div class="profile-card">
            <h3>${pa.practice_area}${pa.featured ? ' <span class="featured-tag">Featured</span>' : ""}</h3>
            <p>${pa.description ?? ""}</p>
        </div>
    `).join("");

}

async function loadRoles() {

    const container = document.getElementById("rolesList");

    const { data, error } = await client
        .from("firm_roles")
        .select("role_name")
        .eq("firm_id", firmId)
        .order("role_name", { ascending: true });

    if (error || !data || !data.length) {
        container.innerHTML = "<p class='loading'>No role data listed yet.</p>";
        return;
    }

    container.innerHTML = `
        <ul class="simple-role-list">
            ${data.map(role => `<li>${role.role_name}</li>`).join("")}
        </ul>
    `;

}

async function loadLocations() {

    const container = document.getElementById("locationsList");

    const { data, error } = await client
        .from("locations")
        .select("*")
        .eq("firm_id", firmId)
        .order("city", { ascending: true });

    if (error || !data || !data.length) {
        container.innerHTML = "<p class='loading'>No locations listed yet.</p>";
        return;
    }

    container.innerHTML = data.map(loc => `
        <div class="profile-card">
            <h3>${loc.city}, ${loc.country ?? ""}</h3>
            <p>${loc.office_type ?? ""}${loc.region ? ` — ${loc.region}` : ""}</p>
            <div class="location-tags">
                ${loc.offers_vacation_scheme ? '<span class="status-pill">Vacation scheme</span>' : ""}
                ${loc.offers_training_contract ? '<span class="status-pill">Training contract</span>' : ""}
            </div>
        </div>
    `).join("");

}

async function loadVacationSchemes(careersUrl) {

    const container = document.getElementById("vacationSchemesList");

    const { data, error } = await client
        .from("vacation_schemes")
        .select("*")
        .eq("firm_id", firmId);

    if (error || !data || !data.length) {
        container.innerHTML = careersUrl
            ? `<p class='loading'>No vacation scheme data listed yet. ${profileLink(careersUrl, "Visit the firm's careers page")}</p>`
            : "<p class='loading'>No vacation scheme data listed yet.</p>";
        return;
    }

    container.innerHTML = data.map(vs => `
        <div class="profile-card">
            <h3>${vs.scheme_name ?? "Vacation Scheme"}</h3>
            <p>${vs.scheme_type ?? ""}${vs.location ? ` — ${vs.location}` : ""}</p>
            <div class="profile-fact-grid">
                ${fact("Opens", formatDate(vs.opens_on))}
                ${fact("Deadline", formatDate(vs.deadline))}
                ${fact("Duration", vs.duration)}
                ${fact("Salary", vs.salary)}
                ${fact("Status", vs.status)}
            </div>
            ${vs.eligibility ? `<p class="profile-eligibility"><strong>Eligibility:</strong> ${vs.eligibility}</p>` : ""}
            ${(vs.application_link || careersUrl) ? profileLink(vs.application_link || careersUrl, "Apply / more info") : ""}
        </div>
    `).join("");

}

async function loadTrainingContracts(careersUrl) {

    const container = document.getElementById("trainingContractList");

    const { data, error } = await client
        .from("training_contracts")
        .select("*")
        .eq("firm_id", firmId);

    if (error || !data || !data.length) {
        container.innerHTML = careersUrl
            ? `<p class='loading'>No training contract data listed yet. ${profileLink(careersUrl, "Visit the firm's careers page")}</p>`
            : "<p class='loading'>No training contract data listed yet.</p>";
        return;
    }

    container.innerHTML = data.map(tc => `
        <div class="profile-card">
            <h3>Training Contract${tc.intake_year ? ` — ${tc.intake_year} intake` : ""}</h3>
            <p>${tc.location ?? ""}</p>
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
            ${tc.eligibility ? `<p class="profile-eligibility"><strong>Eligibility:</strong> ${tc.eligibility}</p>` : ""}
            ${(tc.application_link || careersUrl) ? profileLink(tc.application_link || careersUrl, "Apply / more info") : ""}
        </div>
    `).join("");

}

function fact(label, value) {
    if (!value) return "";
    return `<div class="fact"><span class="fact-label">${label}</span><span class="fact-value">${value}</span></div>`;
}

function formatDate(d) {
    if (!d) return "";

    const date = new Date(d);

    if (isNaN(date)) return d;

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function formatMoney(n) {
    if (n === null || n === undefined) return "";
    return `£${Number(n).toLocaleString("en-GB")}`;
}
