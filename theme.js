// =======================================
// Vacatory
// theme.js — theme and mobile navigation
// =======================================

document.addEventListener("DOMContentLoaded", () => {
  const themeButton = document.getElementById("themeToggle");

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const isDark =
        document.documentElement.dataset.theme === "dark";

      const nextTheme = isDark ? "light" : "dark";

      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem("vacatory-theme", nextTheme);
    });
  }

  const menuButton = document.getElementById("mobileMenuToggle");
  const mobileNavigation =
    document.getElementById("mobileNavigation");

  if (menuButton && mobileNavigation) {
    menuButton.addEventListener("click", () => {
      const isOpen =
        menuButton.getAttribute("aria-expanded") === "true";

      menuButton.setAttribute(
        "aria-expanded",
        String(!isOpen)
      );

      menuButton.setAttribute(
        "aria-label",
        isOpen
          ? "Open navigation menu"
          : "Close navigation menu"
      );

      mobileNavigation.hidden = isOpen;
    });

    mobileNavigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileNavigation.hidden = true;
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute(
          "aria-label",
          "Open navigation menu"
        );
      });
    });
  }
});
