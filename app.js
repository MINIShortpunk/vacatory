// =======================================
// Vacatory
// app.js
// =======================================

let firms = [];
let practiceAreasByFirm = new Map(); // firmId -> Set(practice_area)
let rolesByFirm = new Map();         // firmId -> Set(role_name)

document.addEventListener("DOMContentLoaded", () => {

    loadFirms();

    document
        .getElementById("searchInput")
        .addEventListener("input", applyFilters);

    ["filterPracticeArea", "filterRole", "filterFirmType"].forEach(id => {
        document.getElementById(id).addEventListener("change", applyFilters);
    });

    document.getElementById("filterReset").addEventListener("click", () => {
        document.getElementById("searchInput").value = "";
        document.getElementById("filterPracticeArea").value = "";
        document.getElementById("filterRole").value = "";
        document.getElementById("filterFirmType").value = "";
        applyFilters();
    });

});

async function loadFirms() {

    const container = document.getElementById("firms");

    container.innerHTML = "<p class='loading'>Loading firms...</p>";

    const { data, error } = await client
        .from("firms")
        .select("*")
        .eq("active", true)
        .order("uk_rank", { ascending: true });

    if (error) {

        console.error(error);

        container.innerHTML =
            "<p class='loading'>Unable to load firms.</p>";

        return;

    }

    firms = data || [];

    await loadFilterData();
    populateFilterOptions();

    displayFirms(firms);

}

async function loadFilterData() {

    const firmIds = firms.map(f => f.id);
    if (!firmIds.length) return;

    const [paResult, roleResult] = await Promise.all([
        client.from("practice_areas").select("firm_id, practice_area").in("firm_id", firmIds),
        client.from("firm_roles").select("firm_id, role_name").in("firm_id", firmIds)
    ]);

    practiceAreasByFirm = new Map();
    (paResult.data || []).forEach(row => {
        if (!practiceAreasByFirm.has(row.firm_id)) practiceAreasByFirm.set(row.firm_id, new Set());
        practiceAreasByFirm.get(row.firm_id).add(row.practice_area);
    });

    rolesByFirm = new Map();
    (roleResult.data || []).forEach(row => {
        if (!rolesByFirm.has(row.firm_id)) rolesByFirm.set(row.firm_id, new Set());
        rolesByFirm.get(row.firm_id).add(row.role_name);
    });

}

function populateFilterOptions() {

    const allPracticeAreas = new Set();
    practiceAreasByFirm.forEach(set => set.forEach(v => allPracticeAreas.add(v)));

    const allRoles = new Set();
    rolesByFirm.forEach(set => set.forEach(v => allRoles.add(v)));

    const allFirmTypes = new Set(firms.map(f => f.firm_type).filter(Boolean));

    fillSelect("filterPracticeArea", allPracticeAreas);
    fillSelect("filterRole", allRoles);
    fillSelect("filterFirmType", allFirmTypes);

}

function fillSelect(id, valuesSet) {

    const select = document.getElementById(id);
    const current = select.value;
    const placeholder = select.options[0];

    select.innerHTML = "";
    select.appendChild(placeholder);

    Array.from(valuesSet).sort().forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    select.value = current;

}

function displayFirms(list) {

    const container = document.getElementById("firms");

    if (!list.length) {

        container.innerHTML =
            "<p class='loading'>No firms found.</p>";

        return;

    }

    container.innerHTML = "";

    list.forEach(firm => {

        const card = document.createElement("div");

        card.className = "firm-card";

        const logo = firm.logo_url
            ? `<img src="${firm.logo_url}" alt="${firm.name} logo">`
            : (firm.short_name || firm.name || "V").charAt(0);

        card.innerHTML = `

<div class="firm-card-header">

    <div class="firm-logo">
        ${logo}
    </div>

    <button class="star" aria-label="Favourite firm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-7.5-4.6-10-9.3C.5 8.2 2 4.5 5.6 4c2-.3 3.9.7 5 2.3C11.7 4.7 13.6 3.7 15.6 4c3.6.5 5.1 4.2 3.6 7.7C16.7 16.4 12 21 12 21z"></path>
        </svg>
    </button>

</div>

<h3>${firm.name}</h3>

<p class="firm-type">${firm.firm_type ?? "Commercial Law"}</p>

<div class="firm-details">

    <p class="firm-location">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path>
            <circle cx="12" cy="10" r="2.4"></circle>
        </svg>
        ${firm.head_office ?? "United Kingdom"}
    </p>

</div>

<a href="firm.html?id=${firm.id}" class="firm-link">
    View profile
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M13 6l6 6-6 6"></path>
    </svg>
</a>

`;

        card.querySelector(".star").addEventListener("click", (e) => {

            e.stopPropagation();

            e.currentTarget.classList.toggle("active");

        });

        card.addEventListener("click", (e) => {

            if (e.target.closest(".star")) return;

            window.location.href = `firm.html?id=${firm.id}`;

        });

        container.appendChild(card);

    });

}
function applyFilters() {

    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const practiceArea = document.getElementById("filterPracticeArea").value;
    const role = document.getElementById("filterRole").value;
    const firmType = document.getElementById("filterFirmType").value;

    const filtered = firms.filter(firm => {

        const matchesSearch = !search || (
            (firm.name || "").toLowerCase().includes(search) ||
            (firm.firm_type || "").toLowerCase().includes(search) ||
            (firm.head_office || "").toLowerCase().includes(search) ||
            String(firm.uk_rank || "").includes(search)
        );

        const matchesPracticeArea = !practiceArea ||
            (practiceAreasByFirm.get(firm.id) && practiceAreasByFirm.get(firm.id).has(practiceArea));

        const matchesRole = !role ||
            (rolesByFirm.get(firm.id) && rolesByFirm.get(firm.id).has(role));

        const matchesFirmType = !firmType || firm.firm_type === firmType;

        return matchesSearch && matchesPracticeArea && matchesRole && matchesFirmType;

    });

    const anyFilterActive = search || practiceArea || role || firmType;
    document.getElementById("filterReset").classList.toggle("hidden", !anyFilterActive);

    displayFirms(filtered);

}
