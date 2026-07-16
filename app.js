// ======================================
// VacAttack
// app.js
// ======================================

let firms = [];

document.addEventListener("DOMContentLoaded", () => {

    loadFirms();

    document
        .getElementById("searchInput")
        .addEventListener("input", searchFirms);

});

async function loadFirms() {

    const container = document.getElementById("firms");

    container.innerHTML = "<p>Loading firms...</p>";

    const { data, error } = await client
        .from("firms")
        .select("*")
        .order("uk_rank", { ascending: true });

    if (error) {

        console.error(error);

        container.innerHTML =
            "<p>Unable to load firms.</p>";

        return;

    }

    firms = data || [];

    displayFirms(firms);

}

function displayFirms(list) {

    const container = document.getElementById("firms");

    if (list.length === 0) {

        container.innerHTML =
            "<p>No firms found.</p>";

        return;

    }

    container.innerHTML = "";

    list.forEach(firm => {

        container.innerHTML += `

        <div class="firm-card">

            <div class="firm-top">

                <div>

                    <h3>${firm.name}</h3>

                    <span class="rank">

                        UK Rank #${firm.uk_rank ?? "-"}

                    </span>

                </div>

                <button class="star">

                    ☆

                </button>

            </div>

            <p class="firm-type">

                ${firm.firm_type ?? ""}

            </p>

            <p class="firm-location">

                📍 ${firm.head_office ?? ""}

            </p>

            <div class="firm-footer">

                <span class="status">

                    Active

                </span>

                <button class="view-button">

                    View Firm →

                </button>

            </div>

        </div>

        `;

    });

}

function searchFirms() {

    const search = document
        .getElementById("searchInput")
        .value
        .toLowerCase();

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

    );

    displayFirms(filtered);

}
