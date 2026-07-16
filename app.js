/* ==================================
   VacAttack
   app.js
================================== */

document.addEventListener("DOMContentLoaded", () => {

    console.log("VacAttack Loaded");

    const cards = document.querySelectorAll(".card");

    cards.forEach(card => {

        card.addEventListener("click", () => {

            const title = card.querySelector("h3").innerText;

            switch (title) {

                case "🏢 Law Firms":
                    alert("Law Firms page coming next.");
                    break;

                case "📅 Deadlines":
                    alert("Deadlines page coming next.");
                    break;

                case "📰 Commercial Awareness":
                    alert("Commercial Awareness page coming next.");
                    break;

                case "⭐ Favourites":
                    alert("Favourites page coming next.");
                    break;

                case "📝 My Notes":
                    alert("Notes page coming next.");
                    break;

                case "☕ Keep VacAttack Free":
                    window.open(
                        "https://buymeacoffee.com/",
                        "_blank"
                    );
                    break;

                default:
                    console.log(title);

            }

        });

    });

});
