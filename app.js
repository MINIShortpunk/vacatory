// ======================================
// VacAttack
// app.js
// ======================================

document.addEventListener("DOMContentLoaded", () => {
    loadFirms();
});

async function loadFirms() {

    const firmsContainer = document.getElementById("firms");

    firmsContainer.innerHTML = "Loading firms...";

    const { data, error } = await client
        .from("firms")
        .select("*")
        .order("uk_rank", { ascending: true });

    if (error) {

        console.error(error);

        firmsContainer.innerHTML =
            "Unable to load firms.";

        return;

    }

    if (data.length === 0) {

        firmsContainer.innerHTML =
            "No firms found.";

        return;

    }

    firmsContainer.innerHTML = "";

    data.forEach(firm => {

        firmsContainer.innerHTML += `
            <div class="card">
                <h3>${firm.name}</h3>
                <p>${firm.firm_type}</p>
                <p>${firm.head_office}</p>
            </div>
        `;

    });

}
