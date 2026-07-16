document.addEventListener("DOMContentLoaded", () => {
    loadFirms();
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
        container.innerHTML = "<p>Unable to load firms.</p>";
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = "<p>No firms found.</p>";
        return;
    }

    container.innerHTML = "";

    data.forEach(firm => {

        const card = document.createElement("div");

        card.className = "firm-card";

        card.innerHTML = `

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

                ${firm.firm_type}

            </p>

            <p class="firm-location">

                📍 ${firm.head_office}

            </p>

            <div class="firm-footer">

                <span class="status">

                    Coming Soon

                </span>

                <button class="view-button">

                    View Firm →

                </button>

            </div>

        `;

        container.appendChild(card);

    });

}
