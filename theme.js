// =======================================
// Vacatory
// theme.js — light/dark mode toggle
// (the initial theme is set by an inline script in <head> to avoid a flash;
// this file only wires up the button once the DOM is ready)
// =======================================

document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    btn.addEventListener("click", () => {

        const isDark = document.documentElement.dataset.theme === "dark";
        const next = isDark ? "light" : "dark";

        document.documentElement.dataset.theme = next;
        localStorage.setItem("vacatory-theme", next);

    });

});
