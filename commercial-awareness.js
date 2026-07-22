// ======================================
// Vacatory
// Commercial Awareness page
// ======================================

let allNews = [];
let filteredNews = [];
let visibleArticleCount = 8;
let leadStoryId = null;

const ARTICLES_PER_PAGE = 8;

const FAVOURITES_KEY = "vacatory-favourites";
const SAVED_NEWS_KEY = "vacatory-saved-news";
const READ_NEWS_KEY = "vacatory-read-news";

document.addEventListener("DOMContentLoaded", () => {
  bindCommercialAwarenessControls();
  loadCommercialNews();
});

function bindCommercialAwarenessControls() {
  document
    .getElementById("newsSearch")
    ?.addEventListener("input", applyNewsFilters);

  document
    .getElementById("firmFilter")
    ?.addEventListener("change", applyNewsFilters);

  document
    .getElementById("topicFilter")
    ?.addEventListener("change", applyNewsFilters);

  document
    .getElementById("dateFilter")
    ?.addEventListener("change", applyNewsFilters);

  document
    .getElementById("favouriteOnlyFilter")
    ?.addEventListener("change", applyNewsFilters);

  document
    .getElementById("newsFilterReset")
    ?.addEventListener("click", resetNewsFilters);

  document
    .getElementById("newsEmptyReset")
    ?.addEventListener("click", resetNewsFilters);

  document
    .getElementById("newsRetry")
    ?.addEventListener("click", loadCommercialNews);

  document
    .getElementById("loadMoreNews")
    ?.addEventListener("click", () => {
      visibleArticleCount += ARTICLES_PER_PAGE;
      renderNewsFeed();
    });

  document
    .getElementById("favouriteFirmChips")
    ?.addEventListener("click", handleFavouriteFirmChip);

  document
    .getElementById("newsFeed")
    ?.addEventListener("click", handleArticleAction);
}

async function loadCommercialNews() {
  const loadingElement = document.getElementById("newsLoading");
  const errorElement = document.getElementById("newsError");
  const emptyElement = document.getElementById("newsEmpty");
  const feedElement = document.getElementById("newsFeed");
  const countElement = document.getElementById("newsCount");

  loadingElement.hidden = false;
  errorElement.hidden = true;
  emptyElement.hidden = true;

  if (feedElement) {
    feedElement.innerHTML = "";
  }

  if (countElement) {
    countElement.textContent = "Loading articles…";
  }

  if (typeof client === "undefined") {
    showCommercialNewsError(
      "The database connection is not available."
    );

    return;
  }

  try {
    const { data, error } = await client
      .from("commercial_news_feed_view")
      .select(`
        id,
        title,
        overview,
        why_it_matters,
        key_points,
        article_url,
        canonical_url,
        image_url,
        author,
        content_type,
        article_type,
        jurisdiction,
        published_at,
        published_date,
        first_seen_at,
        is_featured,
        is_breaking,
        summary_status,
        source_id,
        source_name,
        source_slug,
        source_type,
        is_official_source,
        source_homepage_url,
        firms,
        topics,
        primary_topic_slug,
        primary_topic_name,
        days_old,
        freshness_group
      `)
      .order("published_at", {
        ascending: false,
        nullsFirst: false
      })
      .limit(300);

    if (error) {
      throw error;
    }

    allNews = (data || [])
      .map(normaliseArticle)
      .sort(sortArticlesNewestFirst);

    populateNewsFilters();
    renderFavouriteFirmStrip();
    renderLeadStory();
    applyNewsFilters();
  } catch (error) {
    console.error(
      "Failed to load commercial awareness news:",
      error
    );

    showCommercialNewsError(
      "Something went wrong while loading the latest news."
    );
  }
}

function normaliseArticle(article) {
  const firms = deduplicateObjects(
    normaliseJsonArray(article.firms),
    "firm_id"
  );

  const topics = deduplicateObjects(
    normaliseJsonArray(article.topics),
    "topic_id"
  );

  return {
    ...article,
    firms,
    topics
  };
}

function normaliseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function deduplicateObjects(items, key) {
  const uniqueItems = new Map();

  items.forEach(item => {
    if (!item || !item[key]) return;

    const itemKey = String(item[key]);

    if (!uniqueItems.has(itemKey)) {
      uniqueItems.set(itemKey, item);
      return;
    }

    const existingItem = uniqueItems.get(itemKey);

    if (item.is_primary && !existingItem.is_primary) {
      uniqueItems.set(itemKey, item);
    }
  });

  return Array.from(uniqueItems.values());
}

function populateNewsFilters() {
  const firmMap = new Map();
  const topicMap = new Map();

  allNews.forEach(article => {
    article.firms.forEach(firm => {
      if (!firm.firm_id || !firm.firm_name) return;

      firmMap.set(
        String(firm.firm_id),
        firm.firm_name
      );
    });

    article.topics.forEach(topic => {
      if (!topic.slug || !topic.name) return;

      topicMap.set(
        topic.slug,
        topic.name
      );
    });
  });

  fillNewsSelect(
    "firmFilter",
    firmMap,
    "All firms"
  );

  fillNewsSelect(
    "topicFilter",
    topicMap,
    "All topics"
  );
}

function fillNewsSelect(
  elementId,
  optionMap,
  placeholder
) {
  const select = document.getElementById(elementId);

  if (!select) return;

  const currentValue = select.value;
  const fragment = document.createDocumentFragment();

  const placeholderOption =
    document.createElement("option");

  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;

  fragment.appendChild(placeholderOption);

  Array.from(optionMap.entries())
    .sort((first, second) => {
      return first[1].localeCompare(
        second[1],
        "en-GB"
      );
    })
    .forEach(([value, label]) => {
      const option = document.createElement("option");

      option.value = value;
      option.textContent = label;

      fragment.appendChild(option);
    });

  select.replaceChildren(fragment);

  const valueStillExists =
    Array.from(select.options).some(option => {
      return option.value === currentValue;
    });

  if (valueStillExists) {
    select.value = currentValue;
  }
}

function renderFavouriteFirmStrip() {
  const section = document.getElementById(
    "favouriteFirmsSection"
  );

  const chipsContainer = document.getElementById(
    "favouriteFirmChips"
  );

  const favouriteOnlyFilter = document.getElementById(
    "favouriteOnlyFilter"
  );

  if (!section || !chipsContainer) return;

  const favouriteIds = getStoredSet(FAVOURITES_KEY);
  const firmsWithNews = new Map();

  allNews.forEach(article => {
    article.firms.forEach(firm => {
      const firmId = String(firm.firm_id || "");

      if (
        !firmId ||
        !firm.firm_name ||
        !favouriteIds.has(firmId)
      ) {
        return;
      }

      firmsWithNews.set(
        firmId,
        firm.firm_name
      );
    });
  });

  if (favouriteOnlyFilter) {
    favouriteOnlyFilter.disabled =
      favouriteIds.size === 0;

    favouriteOnlyFilter.title =
      favouriteIds.size === 0
        ? "Add firms to your favourites first"
        : "";
  }

  if (!firmsWithNews.size) {
    section.hidden = true;
    chipsContainer.innerHTML = "";
    return;
  }

  section.hidden = false;

  chipsContainer.innerHTML =
    Array.from(firmsWithNews.entries())
      .sort((first, second) => {
        return first[1].localeCompare(
          second[1],
          "en-GB"
        );
      })
      .map(([firmId, firmName]) => {
        return `
          <button
            class="ca-favourite-chip"
            type="button"
            data-firm-id="${escapeHtml(firmId)}"
          >
            ${escapeHtml(firmName)}
          </button>
        `;
      })
      .join("");
}

function handleFavouriteFirmChip(event) {
  const chip = event.target.closest(
    "[data-firm-id]"
  );

  if (!chip) return;

  const firmFilter =
    document.getElementById("firmFilter");

  if (!firmFilter) return;

  const firmId = chip.dataset.firmId || "";

  firmFilter.value =
    firmFilter.value === firmId
      ? ""
      : firmId;

  applyNewsFilters();

  document
    .querySelector(".ca-controls")
    ?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function renderLeadStory() {
  const leadContainer =
    document.getElementById("leadStory");

  if (!leadContainer) return;

  if (!allNews.length) {
    leadStoryId = null;

    leadContainer.innerHTML = `
      <div class="ca-lead-loading">
        New commercial-awareness stories will appear here.
      </div>
    `;

    return;
  }

  const favouriteIds =
    getStoredSet(FAVOURITES_KEY);

  const isFavouriteFirmArticle = article => {
    return article.firms.some(firm => {
      return favouriteIds.has(
        String(firm.firm_id)
      );
    });
  };

  const leadArticle =
    allNews.find(article => {
      return (
        article.is_featured &&
        isFavouriteFirmArticle(article)
      );
    }) ||
    allNews.find(article => {
      return isFavouriteFirmArticle(article);
    }) ||
    allNews.find(article => {
      return article.is_featured;
    }) ||
    allNews.find(article => {
      return article.is_breaking;
    }) ||
    allNews[0];

  leadStoryId = String(leadArticle.id);

  const articleUrl =
    getSafeExternalUrl(leadArticle.article_url);

  const title =
    leadArticle.title ||
    "Commercial-awareness update";

  const summary =
    leadArticle.overview ||
    leadArticle.why_it_matters ||
    "Read the latest official update and consider how it could affect clients, firms or the wider market.";

  const publishedLabel =
    formatFullDate(
      leadArticle.published_at ||
      leadArticle.published_date
    ) || "Date not published";

  const topicLabel =
    leadArticle.primary_topic_name ||
    leadArticle.topics[0]?.name ||
    formatArticleType(leadArticle.article_type);

  const sourceLabel =
    leadArticle.source_name ||
    "Official source";

  const headlineMarkup = articleUrl
    ? `
      <a
        href="${escapeHtml(articleUrl)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHtml(title)}
      </a>
    `
    : escapeHtml(title);

  const sourceLinkMarkup = articleUrl
    ? `
      <a
        class="ca-lead-link"
        href="${escapeHtml(articleUrl)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Read original source
        <span aria-hidden="true">→</span>
      </a>
    `
    : "";

  leadContainer.innerHTML = `
    <div class="ca-lead-meta">
      <span>
        ${escapeHtml(topicLabel)}
      </span>

      <span aria-hidden="true">·</span>

      <span>
        ${escapeHtml(sourceLabel)}
      </span>

      <span aria-hidden="true">·</span>

      <time>
        ${escapeHtml(publishedLabel)}
      </time>
    </div>

    <h2>
      ${headlineMarkup}
    </h2>

    <p class="ca-lead-summary">
      ${escapeHtml(summary)}
    </p>

    ${sourceLinkMarkup}
  `;
}

function applyNewsFilters() {
  const searchTerm = normaliseText(
    document
      .getElementById("newsSearch")
      ?.value || ""
  );

  const selectedFirm =
    document
      .getElementById("firmFilter")
      ?.value || "";

  const selectedTopic =
    document
      .getElementById("topicFilter")
      ?.value || "";

  const selectedDateRange =
    document
      .getElementById("dateFilter")
      ?.value || "";

  const favouriteOnly =
    document
      .getElementById("favouriteOnlyFilter")
      ?.checked || false;

  const favouriteIds =
    getStoredSet(FAVOURITES_KEY);

  const cutoffDate = selectedDateRange
    ? createCutoffDate(
        Number.parseInt(selectedDateRange, 10)
      )
    : null;

  filteredNews = allNews
    .filter(article => {
      const linkedFirmIds =
        article.firms.map(firm => {
          return String(firm.firm_id);
        });

      const linkedTopicSlugs =
        article.topics.map(topic => {
          return topic.slug;
        });

      const matchesFirm =
        !selectedFirm ||
        linkedFirmIds.includes(selectedFirm);

      const matchesTopic =
        !selectedTopic ||
        linkedTopicSlugs.includes(selectedTopic);

      const matchesFavourite =
        !favouriteOnly ||
        linkedFirmIds.some(firmId => {
          return favouriteIds.has(firmId);
        });

      const matchesDate =
        !cutoffDate ||
        articleWasPublishedAfter(
          article,
          cutoffDate
        );

      const searchText = normaliseText([
        article.title,
        article.overview,
        article.why_it_matters,
        article.source_name,
        article.article_type,
        article.content_type,
        article.jurisdiction,
        article.primary_topic_name,
        ...article.firms.map(firm => {
          return firm.firm_name;
        }),
        ...article.topics.map(topic => {
          return topic.name;
        })
      ].filter(Boolean).join(" "));

      const matchesSearch =
        !searchTerm ||
        searchText.includes(searchTerm);

      return (
        matchesFirm &&
        matchesTopic &&
        matchesFavourite &&
        matchesDate &&
        matchesSearch
      );
    })
    .sort(sortArticlesNewestFirst);

  visibleArticleCount = ARTICLES_PER_PAGE;

  updateNewsFilterState();
  renderNewsFeed();
}

function updateNewsFilterState() {
  const searchTerm =
    document
      .getElementById("newsSearch")
      ?.value.trim() || "";

  const selectedFirm =
    document
      .getElementById("firmFilter")
      ?.value || "";

  const selectedTopic =
    document
      .getElementById("topicFilter")
      ?.value || "";

  const selectedDate =
    document
      .getElementById("dateFilter")
      ?.value || "";

  const favouriteOnly =
    document
      .getElementById("favouriteOnlyFilter")
      ?.checked || false;

  const resetButton =
    document.getElementById("newsFilterReset");

  const filtersAreActive = Boolean(
    searchTerm ||
    selectedFirm ||
    selectedTopic ||
    selectedDate ||
    favouriteOnly
  );

  resetButton?.classList.toggle(
    "hidden",
    !filtersAreActive
  );

  document
    .querySelectorAll(".ca-favourite-chip")
    .forEach(chip => {
      chip.classList.toggle(
        "active",
        chip.dataset.firmId === selectedFirm
      );
    });
}

function renderNewsFeed() {
  const loadingElement =
    document.getElementById("newsLoading");

  const errorElement =
    document.getElementById("newsError");

  const emptyElement =
    document.getElementById("newsEmpty");

  const feedElement =
    document.getElementById("newsFeed");

  const countElement =
    document.getElementById("newsCount");

  const loadMoreButton =
    document.getElementById("loadMoreNews");

  loadingElement.hidden = true;
  errorElement.hidden = true;

  if (!feedElement) return;

  if (countElement) {
    countElement.textContent =
      filteredNews.length === 1
        ? "1 article"
        : `${filteredNews.length} articles`;
  }

  if (!filteredNews.length) {
    emptyElement.hidden = false;
    feedElement.innerHTML = "";

    if (loadMoreButton) {
      loadMoreButton.hidden = true;
    }

    return;
  }

  emptyElement.hidden = true;

  const visibleArticles =
    filteredNews.slice(
      0,
      visibleArticleCount
    );

  feedElement.innerHTML =
    visibleArticles
      .map(renderArticleCard)
      .join("");

  if (loadMoreButton) {
    loadMoreButton.hidden =
      visibleArticles.length >= filteredNews.length;
  }
}

function renderArticleCard(article) {
  const articleId = String(article.id);

  const savedArticles =
    getStoredSet(SAVED_NEWS_KEY);

  const readArticles =
    getStoredSet(READ_NEWS_KEY);

  const isSaved =
    savedArticles.has(articleId);

  const isRead =
    readArticles.has(articleId);

  const dateParts = formatCardDate(
    article.published_at ||
    article.published_date
  );

  const articleUrl =
    getSafeExternalUrl(article.article_url);

  const headline =
    article.title ||
    "Untitled update";

  const summary =
    article.overview || "";

  const whyItMatters =
    article.why_it_matters || "";

  const primaryFirm =
    article.firms.find(firm => {
      return firm.is_primary;
    }) ||
    article.firms[0] ||
    null;

  const firmLabel =
    formatFirmNames(article.firms);

  const sourceLabel =
    article.source_name ||
    "Official source";

  const headlineMarkup = articleUrl
    ? `
      <a
        href="${escapeHtml(articleUrl)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${escapeHtml(headline)}
      </a>
    `
    : escapeHtml(headline);

  const summaryMarkup = summary
    ? `
      <p class="ca-card-summary">
        ${escapeHtml(summary)}
      </p>
    `
    : "";

  const whyItMattersMarkup =
    whyItMatters
      ? `
        <div class="ca-why-matters">
          <strong>Why it matters</strong>
          ${escapeHtml(whyItMatters)}
        </div>
      `
      : "";

  const topicMarkup = article.topics.length
    ? `
      <div class="ca-card-tags">
        ${article.topics
          .slice(0, 4)
          .map(topic => {
            return `
              <span class="ca-topic-tag">
                ${escapeHtml(topic.name)}
              </span>
            `;
          })
          .join("")}
      </div>
    `
    : "";

  const firmLinkMarkup =
    primaryFirm?.firm_id
      ? `
        <a
          class="ca-card-action"
          href="firm.html?id=${encodeURIComponent(
            primaryFirm.firm_id
          )}"
        >
          View firm
          <span aria-hidden="true">→</span>
        </a>
      `
      : "";

  const originalLinkMarkup =
    articleUrl
      ? `
        <a
          class="ca-card-link"
          href="${escapeHtml(articleUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Original source
          <span aria-hidden="true">↗</span>
        </a>
      `
      : "";

  return `
    <article
      class="ca-card ${isRead ? "ca-card-read" : ""}"
      data-article-id="${escapeHtml(articleId)}"
    >

      <div class="ca-card-date">
        <span class="day">
          ${escapeHtml(dateParts.day)}
        </span>

        <span class="month">
          ${escapeHtml(dateParts.month)}
        </span>
      </div>

      <div class="ca-card-main">

        <div class="ca-card-context">
          ${
            firmLabel
              ? `
                <span class="ca-card-firm">
                  ${escapeHtml(firmLabel)}
                </span>

                <span
                  class="ca-card-context-separator"
                  aria-hidden="true"
                >
                  ·
                </span>
              `
              : ""
          }

          <span class="ca-card-source">
            ${escapeHtml(sourceLabel)}
            ${
              article.is_official_source
                ? " · Official"
                : ""
            }
          </span>
        </div>

        <h3>
          ${headlineMarkup}
        </h3>

        ${summaryMarkup}
        ${whyItMattersMarkup}
        ${topicMarkup}

      </div>

      <aside class="ca-card-aside">

        <div class="ca-card-actions">

          <button
            class="ca-card-action ${isSaved ? "active" : ""}"
            type="button"
            data-action="save"
            data-id="${escapeHtml(articleId)}"
            aria-pressed="${isSaved}"
          >
            ${isSaved ? "Saved" : "Save"}
            <span aria-hidden="true">
              ${isSaved ? "✓" : "+"}
            </span>
          </button>

          <button
            class="ca-card-action ${isRead ? "active" : ""}"
            type="button"
            data-action="read"
            data-id="${escapeHtml(articleId)}"
            aria-pressed="${isRead}"
          >
            ${isRead ? "Marked read" : "Mark as read"}
            <span aria-hidden="true">
              ${isRead ? "✓" : "○"}
            </span>
          </button>

          ${firmLinkMarkup}

        </div>

        ${originalLinkMarkup}

      </aside>

    </article>
  `;
}

function handleArticleAction(event) {
  const actionButton = event.target.closest(
    "[data-action][data-id]"
  );

  if (!actionButton) return;

  const action =
    actionButton.dataset.action;

  const articleId =
    actionButton.dataset.id;

  if (!articleId) return;

  if (action === "save") {
    toggleStoredValue(
      SAVED_NEWS_KEY,
      articleId
    );
  }

  if (action === "read") {
    toggleStoredValue(
      READ_NEWS_KEY,
      articleId
    );
  }

  renderNewsFeed();
}

function resetNewsFilters() {
  const searchInput =
    document.getElementById("newsSearch");

  const firmFilter =
    document.getElementById("firmFilter");

  const topicFilter =
    document.getElementById("topicFilter");

  const dateFilter =
    document.getElementById("dateFilter");

  const favouriteOnlyFilter =
    document.getElementById(
      "favouriteOnlyFilter"
    );

  if (searchInput) {
    searchInput.value = "";
  }

  if (firmFilter) {
    firmFilter.value = "";
  }

  if (topicFilter) {
    topicFilter.value = "";
  }

  if (dateFilter) {
    dateFilter.value = "";
  }

  if (favouriteOnlyFilter) {
    favouriteOnlyFilter.checked = false;
  }

  applyNewsFilters();
  searchInput?.focus();
}

function showCommercialNewsError(message) {
  const loadingElement =
    document.getElementById("newsLoading");

  const errorElement =
    document.getElementById("newsError");

  const emptyElement =
    document.getElementById("newsEmpty");

  const countElement =
    document.getElementById("newsCount");

  const leadContainer =
    document.getElementById("leadStory");

  loadingElement.hidden = true;
  emptyElement.hidden = true;
  errorElement.hidden = false;

  const errorParagraph =
    errorElement.querySelector("p");

  if (errorParagraph) {
    errorParagraph.textContent = message;
  }

  if (countElement) {
    countElement.textContent =
      "Unable to load articles";
  }

  if (leadContainer) {
    leadContainer.innerHTML = `
      <div class="ca-lead-loading">
        The lead story could not be loaded.
      </div>
    `;
  }
}

function getStoredSet(storageKey) {
  try {
    const storedValue = JSON.parse(
      localStorage.getItem(storageKey) ||
      "[]"
    );

    if (!Array.isArray(storedValue)) {
      return new Set();
    }

    return new Set(
      storedValue.map(String)
    );
  } catch {
    return new Set();
  }
}

function toggleStoredValue(
  storageKey,
  value
) {
  const storedValues =
    getStoredSet(storageKey);

  const stringValue =
    String(value);

  if (storedValues.has(stringValue)) {
    storedValues.delete(stringValue);
  } else {
    storedValues.add(stringValue);
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify(
      Array.from(storedValues)
    )
  );

  return storedValues.has(stringValue);
}

function formatFirmNames(firms) {
  const names = firms
    .map(firm => firm.firm_name)
    .filter(Boolean);

  if (!names.length) {
    return "";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return names.join(" and ");
  }

  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

function formatArticleType(value) {
  if (!value) {
    return "Commercial awareness";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => {
      return character.toUpperCase();
    });
}

function createCutoffDate(daysAgo) {
  if (!Number.isFinite(daysAgo)) {
    return null;
  }

  const cutoffDate = new Date();

  cutoffDate.setHours(
    0,
    0,
    0,
    0
  );

  cutoffDate.setDate(
    cutoffDate.getDate() - daysAgo
  );

  return cutoffDate;
}

function articleWasPublishedAfter(
  article,
  cutoffDate
) {
  const publishedDate = parseNewsDate(
    article.published_at ||
    article.published_date
  );

  if (!publishedDate) {
    return false;
  }

  return publishedDate >= cutoffDate;
}

function sortArticlesNewestFirst(
  firstArticle,
  secondArticle
) {
  const firstTime =
    getArticleSortTime(firstArticle);

  const secondTime =
    getArticleSortTime(secondArticle);

  return secondTime - firstTime;
}

function getArticleSortTime(article) {
  const date = parseNewsDate(
    article.published_at ||
    article.published_date ||
    article.first_seen_at
  );

  return date
    ? date.getTime()
    : 0;
}

function parseNewsDate(value) {
  if (!value) return null;

  const dateOnlyPattern =
    /^\d{4}-\d{2}-\d{2}$/;

  const date = dateOnlyPattern.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatCardDate(value) {
  const date = parseNewsDate(value);

  if (!date) {
    return {
      day: "—",
      month: "Date TBC"
    };
  }

  return {
    day: date.toLocaleDateString(
      "en-GB",
      {
        day: "numeric"
      }
    ),

    month: date.toLocaleDateString(
      "en-GB",
      {
        month: "short",
        year: "numeric"
      }
    )
  };
}

function formatFullDate(value) {
  const date = parseNewsDate(value);

  if (!date) return "";

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );
}

function getSafeExternalUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function normaliseText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
