// =======================================
// Vacatory
// app.js — firms list page
// =======================================

let firms = [];
let practiceAreasByFirm = new Map();
let rolesByFirm = new Map();

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
    if (typeof client === "undefined") {
        $("firms").innerHTML = "<p class='loading'>Supabase is not connected yet. Check supabase.js.</p>";
        return;
    }

    loadFirms();

    ["searchInput", "filterPracticeArea", "filterRole", "filterFirmType"].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener(id === "searchInput" ? "input" : "change", applyFilters);
    });

    const reset = $("filterReset");
    if (reset) {
        reset.addEventListener("click", () => {
            $("searchInput").value = "";
            $("filterPracticeArea").value = "";
            $("filterRole").value = "";
            $("filterFirmType").value = "";
            applyFilters();
        });
    }
});

async function loadFirms() {
    const container = $("firms");
    container.innerHTML = "<p class='loading'>Loading firms...</p>";

    const { data, error } = await client
        .from("firms")
        .select("*")
        .eq("active", true)
        .order("uk_rank", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

    if (error) {
        console.error(error);
        container.innerHTML = "<p class='loading'>Unable to load firms. Please check Supabase or try refreshing.</p>";
        updateFirmCount(0, 0);
        return;
    }

    firms = data || [];

    await loadFilterData();
    populateFilterOptions();
    displayFirms(firms);
}

async function loadFilterData() {
    const firmIds = firms.map((firm) => firm.id).filter(Boolean);
    if (!firmIds.length) return;

    const [practiceResult, rolesResult] = await Promise.all([
        client.from("practice_areas").select("firm_id, practice_area").in("firm_id", firmIds),
        client.from("firm_roles").select("firm_id, role_name").in("firm_id", firmIds)
    ]);

    if (practiceResult.error) console.warn("Practice areas failed to load", practiceResult.error);
    if (rolesResult.error) console.warn("Roles failed to load", rolesResult.error);

    practiceAreasByFirm = new Map();
    (practiceResult.data || []).forEach((row) => {
        if (!practiceAreasByFirm.has(row.firm_id)) practiceAreasByFirm.set(row.firm_id, new Set());
        if (row.practice_area) practiceAreasByFirm.get(row.firm_id).add(row.practice_area);
    });

    rolesByFirm = new Map();
    (rolesResult.data || []).forEach((row) => {
        if (!rolesByFirm.has(row.firm_id)) rolesByFirm.set(row.firm_id, new Set());
        if (row.role_name) rolesByFirm.get(row.firm_id).add(row.role_name);
    });
}

function populateFilterOptions() {
    const allPracticeAreas = new Set();
    practiceAreasByFirm.forEach((set) => set.forEach((value) => allPracticeAreas.add(value)));

    const allRoles = new Set();
    rolesByFirm.forEach((set) => set.forEach((value) => allRoles.add(value)));

    const allFirmTypes = new Set(firms.map((firm) => firm.firm_type).filter(Boolean));

    fillSelect("filterPracticeArea", allPracticeAreas);
    fillSelect("filterRole", allRoles);
    fillSelect("filterFirmType", allFirmTypes);
}

function fillSelect(id, valuesSet) {
    const select = $(id);
    if (!select) return;

    const current = select.value;
    const firstOptionText = select.options[0]?.textContent || "All";

    select.innerHTML = `<option value="">${escapeHtml(firstOptionText)}</option>`;

    Array.from(valuesSet)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

    select.value = Array.from(select.options).some((option) => option.value === current) ? current : "";
}

function displayFirms(list) {
    const container = $("firms");
    updateFirmCount(list.length, firms.length);

    if (!list.length) {
        container.innerHTML = "<p class='loading'>No firms found. Try clearing the filters.</p>";
        return;
    }

    container.innerHTML = list.map((firm) => firmCard(firm)).join("");

    container.querySelectorAll(".firm-card").forEach((card) => {
        const id = card.dataset.firmId;

        card.addEventListener("click", (event) => {
            if (event.target.closest(".star") || event.target.closest("a")) return;
            window.location.href = `firm.html?id=${encodeURIComponent(id)}`;
        });

        const star = card.querySelector(".star");
        const favKey = `vacatory-fav-${id}`;
        if (localStorage.getItem(favKey)) star.classList.add("active");

        star.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            star.classList.toggle("active");
            if (star.classList.contains("active")) localStorage.setItem(favKey, "1");
            else localStorage.removeItem(favKey);
        });
    });
}

function firmCard(firm) {
    const id = escapeHtml(firm.id);
    const name = escapeHtml(firm.name || "Unnamed firm");
    const shortName = escapeHtml(firm.short_name || firm.name || "V");
    const type = escapeHtml(firm.firm_type || "Commercial law");
    const headOffice = escapeHtml(firm.head_office || "United Kingdom");
    const rank = firm.uk_rank ? `<span class="mini-pill">UK Rank #${escapeHtml(firm.uk_rank)}</span>` : "";

    const logo = firm.logo_url
        ? `<img src="${escapeHtml(firm.logo_url)}" alt="${name} logo">`
        : shortName.charAt(0).toUpperCase();

    return `
        <article class="firm-card" data-firm-id="${id}">
            <div class="firm-card-header">
                <div class="firm-logo">${logo}</div>
                <button class="star" aria-label="Favourite ${name}" type="button">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2 4.5 5.6 4c2-.3 3.9.7 5 2.3C11.7 4.7 13.6 3.7 15.6 4c3.6.5 5.1 4.2 3.6 7.7C16.7 16.4 12 21 12 21z"></path>
                    </svg>
                </button>
            </div>
            <h3>${name}</h3>
            <p class="firm-type">${type}</p>
            <div class="firm-details">
                <p class="firm-location">${locationIcon()}${headOffice}</p>
                ${rank}
            </div>
            <a href="firm.html?id=${id}" class="firm-link" aria-label="View ${name} profile">
                View profile
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
            </a>
        </article>
    `;
}

function applyFilters() {
    const search = ($("searchInput")?.value || "").trim().toLowerCase();
    const practiceArea = $("filterPracticeArea")?.value || "";
    const role = $("filterRole")?.value || "";
    const firmType = $("filterFirmType")?.value || "";

    const filtered = firms.filter((firm) => {
        const haystack = [
            firm.name,
            firm.short_name,
            firm.firm_type,
            firm.head_office,
            firm.overview,
            firm.uk_rank ? `rank ${firm.uk_rank}` : ""
        ].join(" ").toLowerCase();

        const matchesSearch = !search || haystack.includes(search);
        const matchesPracticeArea = !practiceArea || practiceAreasByFirm.get(firm.id)?.has(practiceArea);
        const matchesRole = !role || rolesByFirm.get(firm.id)?.has(role);
        const matchesFirmType = !firmType || firm.firm_type === firmType;

        return matchesSearch && matchesPracticeArea && matchesRole && matchesFirmType;
    });

    const anyFilterActive = Boolean(search || practiceArea || role || firmType);
    $("filterReset")?.classList.toggle("hidden", !anyFilterActive);

    displayFirms(filtered);
}

function updateFirmCount(showing, total) {
    const count = $("firmCount");
    if (!count) return;

    if (!total) count.textContent = "No firms loaded yet.";
    else if (showing === total) count.textContent = `${total} firm${total === 1 ? "" : "s"} loaded.`;
    else count.textContent = `Showing ${showing} of ${total} firms.`;
}

function locationIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2.4"></circle></svg>`;
}
