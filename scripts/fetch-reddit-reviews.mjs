/**
 * fetch-reddit-reviews.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Scrapes r/whiskey and r/bourbon for flair:Review posts and does a best-effort
 * parse of bottle name, distillery, rating, and tasting notes.
 *
 * Output: scripts/reddit-reviews-raw.json  (edit + clean this before importing)
 *
 * Usage:
 *   node scripts/fetch-reddit-reviews.mjs
 *
 * No auth needed — uses Reddit's public JSON API.
 * Respects rate limits with a 1 s delay between pages.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "reddit-reviews-raw.json");

const USER_AGENT = "CommonCask/1.0 (whiskey bottle data research; contact via github)";
const SUBREDDITS = ["whiskey", "bourbon"];
const MAX_PAGES  = 10;   // 100 posts/page → up to 1 000 per subreddit
const DELAY_MS   = 1100; // stay well under Reddit's 60 req/min limit

// ── Rating extraction ─────────────────────────────────────────────────────────
// Tries multiple common r/whiskey review formats in order of specificity.
const RATING_PATTERNS = [
  /\*{0,2}(?:overall|rating|score|final|my rating|my score)[:\s*]+([0-9]+(?:\.[0-9]+)?)\s*\/\s*10\*{0,2}/i,
  /\b([0-9]+(?:\.[0-9]+)?)\s*\/\s*10\b/,
  /\*{0,2}([0-9]+(?:\.[0-9]+)?)\s*out of\s*10\*{0,2}/i,
];

function extractRating(text) {
  for (const pat of RATING_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      const v = parseFloat(m[1]);
      if (v >= 1 && v <= 10) return v;
    }
  }
  return null;
}

// ── Tasting notes extraction ──────────────────────────────────────────────────
function extractSection(text, label) {
  if (!text) return null;
  const pat = new RegExp(
    `\\*{0,2}(?:${label})\\*{0,2}\\s*[:\\-]\\s*([^\\n]{3,})`,
    "i"
  );
  const m = text.match(pat);
  const raw = m?.[1];
  if (!raw) return null;
  return raw.replace(/\*+/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
}

// ── Bottle name from title ────────────────────────────────────────────────────
// Strips review markers, ratings, and Reddit noise from the title.
function extractBottleName(title) {
  return title
    .replace(/^\[review\]\s*/i, "")
    .replace(/\breview\b/gi, "")
    .replace(/[|\-–—]\s*\d+(?:\.\d+)?\s*\/\s*10.*$/i, "") // trailing rating
    .replace(/\d+(?:\.\d+)?\s*\/\s*10/g, "")               // inline rating
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Distillery guesses ────────────────────────────────────────────────────────
// Naive keyword scan — enough to pre-fill the field for manual review.
const DISTILLERY_KEYWORDS = [
  ["Buffalo Trace",          ["buffalo trace", "btac", "btdc"]],
  ["Heaven Hill",            ["heaven hill", "elijah craig", "larceny", "evan williams", "bernheim", "henry mckenna"]],
  ["Wild Turkey",            ["wild turkey", "russell's reserve", "longbranch"]],
  ["Jim Beam / Beam Suntory",["jim beam", "maker's mark", "basil hayden", "knob creek", "booker's", "baker's", "little book", "legent"]],
  ["Four Roses",             ["four roses"]],
  ["Brown-Forman",           ["woodford reserve", "old forester", "jack daniel", "early times", "gentleman jack", "sinatra select"]],
  ["Willett",                ["willett", "pot still reserve", "family estate"]],
  ["Bardstown Bourbon",      ["bardstown bourbon", "collaborative series", "origin series"]],
  ["MGP / LDI",              ["mgp", "ldi", "whistlepig", "high west", "bulleit", "george dickel", "angostura"]],
  ["Michter's",              ["michter's", "michters"]],
  ["Angel's Envy",           ["angel's envy", "angels envy"]],
  ["Sagamore Spirit",        ["sagamore"]],
];

function guessDistillery(title, body) {
  const hay = `${title} ${body}`.toLowerCase();
  for (const [name, keywords] of DISTILLERY_KEYWORDS) {
    if (keywords.some((k) => hay.includes(k))) return name;
  }
  return "";
}

// ── Reddit API fetch ──────────────────────────────────────────────────────────
async function fetchPage(subreddit, after) {
  // title:review ensures "review" is in the post title
  // selftext:/10  ensures there's a "X/10" rating in the body
  const params = new URLSearchParams({
    q:            "title:review selftext:/10",
    restrict_sr:  "on",
    sort:         "top",
    t:            "all",
    limit:        "100",
    ...(after ? { after } : {}),
  });
  const url = `https://www.reddit.com/r/${subreddit}/search.json?${params}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Reddit ${res.status} on ${url}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const results = [];

  for (const sub of SUBREDDITS) {
    console.error(`\n── r/${sub} ─────────────────────`);
    let after = null;
    let page  = 0;

    while (page < MAX_PAGES) {
      console.error(`  page ${page + 1}…`);
      let json;
      try {
        json = await fetchPage(sub, after);
      } catch (err) {
        console.error(`  fetch error: ${err.message} — stopping`);
        break;
      }

      const posts = json?.data?.children ?? [];
      if (!posts.length) break;

      for (const { data: p } of posts) {
        const title  = p.title ?? "";
        const body   = p.selftext ?? "";
        const combined = `${title}\n${body}`;

        // Skip posts that are clearly not whiskey reviews
        if (p.is_video || p.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue;

        const rating     = extractRating(combined);
        const bottleName = extractBottleName(title);
        const distillery = guessDistillery(title, body);
        const nose       = extractSection(body, "nose");
        const palate     = extractSection(body, "palate|taste|flavor");
        const finish     = extractSection(body, "finish");

        results.push({
          // ── Fields to KEEP AS-IS (used by import script) ──────────────
          reddit_id:    p.id,                    // used as session_id on import
          subreddit:    sub,
          // ── Fields to CLEAN MANUALLY before importing ─────────────────
          bottle_id:    "",                       // ← fill this in (from whiskeys.ts)
          bottle_name:  bottleName,               // ← verify / correct
          distillery:   distillery,               // ← verify / correct
          rating_raw:   rating,                   // float e.g. 8.5 (rounded to int on import)
          // ── Optional tasting notes (import script uses these) ─────────
          nose:         nose   ?? "",
          palate:       palate ?? "",
          finish:       finish ?? "",
          // ── Reference ────────────────────────────────────────────────
          title,
          url:          `https://reddit.com${p.permalink}`,
          score:        p.score,                  // upvotes — useful for prioritising
          created_utc:  p.created_utc,
        });
      }

      after = json?.data?.after;
      if (!after) break;
      page++;
      await sleep(DELAY_MS);
    }
  }

  // Sort by upvote score descending so high-quality reviews come first
  results.sort((a, b) => b.score - a.score);

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  console.error(`\n✓ ${results.length} posts written to ${OUT_FILE}`);
  console.error(`  ${results.filter((r) => r.rating_raw !== null).length} have a parsed rating`);
  console.error(`  ${results.filter((r) => r.distillery).length} have a guessed distillery`);
  console.error("\nNext steps:");
  console.error("  1. Open scripts/reddit-reviews-raw.json");
  console.error("  2. Fill in bottle_id for each row (from src/data/whiskeys.ts)");
  console.error("  3. Fix bottle_name / distillery where wrong");
  console.error("  4. Delete rows you don't want");
  console.error("  5. Save as scripts/reddit-reviews-clean.json");
  console.error("  6. node scripts/import-reddit-ratings.mjs");
}

main().catch((e) => { console.error(e); process.exit(1); });
