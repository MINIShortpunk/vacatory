// =====================================
// VacAttack
// app.js
// =====================================

document.addEventListener("DOMContentLoaded", () => {
    loadFirms();
});

async function loadFirms() {

    const firmsContainer = document.getElementById("firms");

    firmsContainer.innerHTML = "<p>Loading firms...</p>";

    const { data, error } = await supabase
        .from("firms")
        .select("*")
        .order("uk_rank", { ascending: true });

    if (error) {
        console.error(error);

        firmsContainer.innerHTML = `
            <p>Unable to load firms.</p>
        `;

        return;
    }

    if (!data || data.length === 0) {
        firmsContainer.innerHTML = `
            <p>No firms found.</p>
        `;

        return;
    }

    firmsContainer.innerHTML = "";

    data.forEach(firm => {

        const card = document.createElement("div");

        card.className = "card";

        card.innerHTML = `
            <h3>${firm.name}</h3>

            <p><strong>Rank:</strong> ${firm.uk_rank ?? "-"}</p>

            <p><strong>Type:</strong> ${firm.firm_type ?? "-"}</p>

            <p><strong>Head Office:</strong> ${firm.head_office ?? "-"}</p>
        `;

        firmsContainer.appendChild(card);

    });

}
