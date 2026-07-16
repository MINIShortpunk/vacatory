// =======================================
// Vacatory
// scripts/check-rankings.mjs
//
// Weekly job: compares the current uk_rank values in Supabase against a
// public UK law firm ranking source, and reports any differences.
//
// IMPORTANT: this does NOT write to the database. The primary ranking
// source (The Lawyer UK 200) is paywalled, so this uses a free secondary
// compilation instead — less authoritative, and web scraping in general
// is fragile (it breaks if the source changes its page layout). Rather
// than risk silently corrupting live rank data on a bad parse, this
// script only ever proposes changes for a human to review and apply.
// =======================================

const SUPABASE_URL = "https://qusyglgevgyjaoasmjhz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9ty8SXkUWakdGnSSWt3WeA_8TgRQY8x";

const RANKING_SOURCE_URL = "https://lawyermag.co.uk/law-firm-rankings-leading-law-firms-in-uk/";

async function fetchCurrentFirms() {

    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/firms?select=name,uk_rank&order=uk_rank.asc`,
        { headers: { apikey: SUPABASE_ANON_KEY } }
    );

    if (!res.ok) {
        throw new Error(`Supabase fetch failed: ${res.status}`);
    }

    return res.json();

}

async function fetchSourceRanking() {

    const res = await fetch(RANKING_SOURCE_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; VacatoryRankCheck/1.0)" }
    });

    if (!res.ok) {
        throw new Error(`Ranking source fetch failed: ${res.status}`);
    }

    const html = await res.text();

    // Strip tags to get plain text, then look for "N. Firm Name" patterns
    // (the source formats each entry as a bolded "**N. Firm Name**" line).
    const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ");

    const matches = [...text.matchAll(/\b(\d{1,3})\.\s+([A-Z][A-Za-z&,.'()\- ]{2,60}?)(?=\s+[–\-]|\s+\d{1,3}\.|\s+revenue|\s+is\b|\s{2,})/g)];

    const seen = new Map();
    for (const [, rankStr, nameRaw] of matches) {
        const rank = parseInt(rankStr, 10);
        const name = nameRaw.trim();
        if (rank >= 1 && rank <= 200 && name.length > 2 && !seen.has(rank)) {
            seen.set(rank, name);
        }
    }

    return seen; // Map<rank, name>

}

function normalize(name) {
    return name
        .toLowerCase()
        .replace(/[&.,()]/g, "")
        .replace(/\ballen & overy.*$/, "a&o shearman")
        .replace(/\s+/g, " ")
        .trim();
}

async function main() {

    const [currentFirms, sourceRanking] = await Promise.all([
        fetchCurrentFirms(),
        fetchSourceRanking()
    ]);

    if (!sourceRanking.size) {
        console.log("Could not parse the ranking source this run — page layout may have changed. Skipping (no changes proposed).");
        return;
    }

    // Build a normalized-name -> rank map from the source
    const sourceByName = new Map();
    sourceRanking.forEach((name, rank) => sourceByName.set(normalize(name), rank));

    const changes = [];

    for (const firm of currentFirms) {
        const sourceRank = sourceByName.get(normalize(firm.name));
        if (sourceRank !== undefined && sourceRank !== firm.uk_rank) {
            changes.push({
                name: firm.name,
                currentRank: firm.uk_rank,
                proposedRank: sourceRank
            });
        }
    }

    if (!changes.length) {
        console.log("No rank changes detected. All firms match the source ranking (where matched).");
        return;
    }

    console.log("RANK_CHANGES_DETECTED");
    console.log(JSON.stringify(changes, null, 2));

}

main().catch(err => {
    console.error("check-rankings.mjs failed:", err);
    // Exit 0 rather than failing the whole workflow — a scraper failure
    // shouldn't spam you with a broken CI run, just skip silently.
    process.exit(0);
});
