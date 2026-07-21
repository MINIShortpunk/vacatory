// =======================================
// Vacatory
// theme.js
// =======================================

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("themeToggle");
    if (!button) return;

    button.addEventListener("click", () => {
        const current = document.documentElement.dataset.theme || "light";
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("vacatory-theme", next);
    });
});
