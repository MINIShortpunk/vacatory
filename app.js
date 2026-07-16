// =======================================
// Vacatory
// app.js
// =======================================

let firms = [];

document.addEventListener("DOMContentLoaded", () => {

    loadFirms();

    document
        .getElementById("searchInput")
        .addEventListener("input", searchFirms);

});

async function loadFirms() {

    const container = document.getElementById("firms");

    container.innerHTML = "<p class='loading'>Loading firms...</p>";

    const { data, error } = await client
        .from("firms")
        .select("*")
        .order("uk_rank", { ascending: true });

    if (error) {

        console.error(error);

        container.innerHTML =
            "<p class='loading'>Unable to load firms.</p>";

        return;

    }

    firms = data || [];

    document.getElementById("firmCount").textContent =
        firms.length;

    displayFirms(firms);

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

        card.innerHTML = `

<div class="firm-card-header">

    <div class="firm-logo">

        ${firm.name ? firm.name.charAt(0) : "V"}

    </div>

    <div class="firm-main">

        <h3>${firm.name}</h3>

        <p class="firm-city">

            ${firm.head_office ?? "United Kingdom"}

        </p>

    </div>

    <button
        class="star"
        aria-label="Favourite">

        ☆

    </button>

</div>

<div class="firm-meta">

    <span class="status-pill">

        Applications Open

    </span>

    <span class="firm-rank">

        UK #${firm.uk_rank ?? "-"}

    </span>

</div>

<div class="firm-bottom">

    <span>

        ${firm.firm_type ?? "Commercial Law"}

    </span>

    <span class="chevron">

        →

    </span>

</div>

`;

        card.addEventListener("click", () => {

            alert("Firm profile coming next.");

        });

        container.appendChild(card);

    });

}
function searchFirms() {

    const search = document
        .getElementById("searchInput")
        .value
        .trim()
        .toLowerCase();

    if (!search) {

        displayFirms(firms);

        return;

    }

    const filtered = firms.filter(firm =>

        (firm.name || "")
            .toLowerCase()
            .includes(search)

        ||

        (firm.firm_type || "")
            .toLowerCase()
            .includes(search)

        ||

        (firm.head_office || "")
            .toLowerCase()
            .includes(search)

        ||

        String(firm.uk_rank || "")
            .includes(search)

    );

    displayFirms(filtered);

}
