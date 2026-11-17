#!/usr/bin/env node
/**
 * release-watch.mjs — the weekly new-release check.
 * ──────────────────────────────────────────────────────────────────────────
 * Finds whiskey releases the site doesn't list yet and queues them for the
 * admin to approve at /admin. It never adds anything to the site by itself.
 *
 *   scan     Read the Breaking Bourbon release calendar and print the
 *            entries that are new, or whose details changed, since the last
 *            committed scan — for producers the site carries.
 *   feeds    Print recent headlines from whiskey news feeds (a second place
 *            to spot releases, and to check a calendar entry against).
 *   submit   Queue curated bottles (a JSON file) as pending submissions.
 *   commit   Record the last scan as seen, so those entries aren't raised
 *            again unless their details change.
 *   status   How many release-watch bottles are waiting for review.
 *
 * Typical run:  scan → decide what to add → submit picks.json → commit
 *
 * No dependencies (Node 18+). State lives outside the repo, in
 *   ~/Desktop/Whiskey Website Project/release-watch/   (or $RELEASE_WATCH_DIR)
 * Supabase settings are read from a .env.local (--env <path>, or
 * $RELEASE_WATCH_ENV, or the first one found beside the project's worktrees).
 *
 * Options: --site <url>   catalog to compare against (default the live site)
 *          --dry-run      with submit: validate and print, insert nothing
 *          --all          with scan: ignore the ledger and list everything
 *          --days <n>     with feeds: how far back to look (default 8)
 * ──────────────────────────────────────────────────────────────────────────
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const SITE = option("--site", "https://www.commoncask.com").replace(/\/$/, "");
const PROJECT_DIR = path.join(os.homedir(), "Desktop", "Whiskey Website Project");
const STATE_DIR = process.env.RELEASE_WATCH_DIR ?? path.join(PROJECT_DIR, "release-watch");
const LEDGER = path.join(STATE_DIR, "ledger.json");
const LAST_SCAN = path.join(STATE_DIR, "last-scan.json");

const CALENDAR_URL = "https://www.breakingbourbon.com/release-calendar";
const CALENDAR_NAME = "Breaking Bourbon release calendar";
const FEEDS = [
  { name: "The Whiskey Wash", url: "https://thewhiskeywash.com/feed/" },
  { name: "Fred Minnick", url: "https://www.fredminnick.com/feed/" },
  { name: "BourbonBlog", url: "https://www.bourbonblog.com/feed/" },
];
const USER_AGENT = "Mozilla/5.0 (compatible; release-watch/1.0)";
const SESSION = "release-watch";

const STYLES = ["Bourbon", "Wheated Bourbon", "High Rye Bourbon", "Rye Whiskey", "Wheat Whiskey", "Tennessee Whiskey", "Blended American", "American Single Malt"];
const RARITY_SCORE = { common: 12, limited: 40, rare: 65, allocated: 82, unicorn: 95 };
const AVAILABILITY = ["current", "limited_release", "discontinued"];

/**
 * Words in a calendar entry's name that identify a producer the site carries.
 * Keyed by the site's brand id. Add a line here when a producer is added.
 */
const PRODUCER_WORDS = {
  "buffalo-trace-distillery": ["buffalo trace", "eagle rare", "weller", "e.h. taylor", "eh taylor", "e. h. taylor", "stagg", "sazerac", "blanton", "elmer t", "benchmark", "old charter", "traveller", "van winkle", "thomas h. handy", "rock hill", "double eagle", "o.f.c", "antique collection", "prohibition collection", "experimental collection"],
  "heaven-hill": ["elijah craig", "parker's heritage", "bernheim", "larceny", "heaven hill", "old fitzgerald", "evan williams", "rittenhouse", "henry mckenna", "pikesville", "mellow corn", "square 6"],
  "wild-turkey": ["wild turkey", "russell's", "rare breed", "longbranch", "master's keep"],
  "four-roses": ["four roses"],
  "brown-forman": ["woodford", "old forester", "jack daniel", "coopers' craft", "king of kentucky"],
  "beam-suntory": ["knob creek", "booker", "basil hayden", "baker's 7", "baker's 13", "baker's high", "baker's single", "overholt", "jim beam", "old grand-dad", "old grand dad", "legent", "little book", "hardin's creek", "old crow", "clermont steep"],
  michters: ["michter"],
  "bombergers-declaration": ["bomberger", "shenk"],
  "high-west": ["high west"],
  willett: ["willett", "noah's mill", "rowan's creek", "johnny drum", "old bardstown", "kentucky vintage", "pure kentucky"],
  "angels-envy": ["angel's envy"],
  "bardstown-bourbon": ["bardstown bourbon"],
  buckners: ["buckner", "augusta distillery", "old route 8"],
  "new-riff-distilling": ["new riff"],
  "penelope-bourbon": ["penelope"],
  holladay: ["holladay"],
  "still-austin": ["still austin"],
  "sagamore-spirit": ["sagamore"],
  "redwood-empire-whiskey": ["redwood empire"],
  "kentucky-peerless": ["peerless"],
  "four-gate": ["four gate"],
  "makers-mark": ["maker's mark"],
  "templeton-rye": ["templeton"],
  "leopold-bros": ["leopold"],
  bulleit: ["bulleit"],
  "smooth-ambler": ["smooth ambler", "old scout"],
  "barton-1792": ["1792", "very old barton", "thomas s. moore"],
  jeffersons: ["jefferson's"],
  barrell: ["barrell "],
  "cascade-hollow": ["george dickel", "cascade moon", "cascade hollow"],
  "wilderness-trail": ["wilderness trail"],
  "rabbit-hole": ["rabbit hole"],
  nulu: ["nulu"],
};
/** Other companies' bottlings of a carried distillery's whiskey: not that producer's release. */
const INDEPENDENT_BOTTLERS = ["lost lantern", "dragon's milk"];

// ── Small helpers ─────────────────────────────────────────────────────────────

function fail(message) {
  console.error("release-watch: " + message);
  process.exit(1);
}

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const strip = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/[​-‍]/g, "").replace(/\s+/g, " ").trim();

/** Lower-case, straight quotes, single spaces — for comparing names. */
function norm(text) {
  return text.normalize("NFKD").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}
const words = (text) => new Set(norm(text).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1));
}

function loadEnv() {
  const candidates = [option("--env"), process.env.RELEASE_WATCH_ENV, path.join(STATE_DIR, ".env"), path.join(__dirname, "..", ".env.local")];
  const worktrees = path.join(PROJECT_DIR, ".claude", "worktrees");
  if (fs.existsSync(worktrees)) for (const dir of fs.readdirSync(worktrees).sort()) candidates.push(path.join(worktrees, dir, ".env.local"));
  for (const file of candidates) {
    if (!file || !fs.existsSync(file)) continue;
    const env = {};
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
    }
    if (env.NEXT_PUBLIC_SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return { url: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ""), key: env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, canRead: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) };
    }
  }
  fail("no .env.local with the Supabase settings was found; pass --env <path>");
}

async function supabase(env, method, query, body) {
  const res = await fetch(`${env.url}/rest/v1/${query}`, {
    method,
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, "Content-Type": "application/json", Prefer: method === "POST" ? "return=minimal" : "count=exact" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${query.split("?")[0]} → ${res.status} ${await res.text()}`);
  return method === "GET" ? res.json() : null;
}

// ── Sources ───────────────────────────────────────────────────────────────────

/** Every entry on the calendar page: name, month heading, the details line and its links. */
function parseCalendar(html) {
  const entries = [];
  const parts = html.split(/<div class="reviewheader">([^<]+)<\/div>/);
  for (let i = 1; i < parts.length; i += 2) {
    const month = strip(parts[i]);
    for (const block of parts[i + 1].split('<div class="name-parent-div">').slice(1)) {
      const name = block.match(/<div class="calendar-text bold">([\s\S]*?)<\/div>/);
      if (!name) continue;
      const details = block.match(/<div class="calendar-text[^"]*w-richtext">([\s\S]*?)<\/div>/);
      const links = {};
      for (const m of block.matchAll(/<div class="div-block-110(?: black)?"><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)) {
        links[strip(m[2])] = m[1].startsWith("/") ? "https://www.breakingbourbon.com" + m[1] : m[1];
      }
      const text = details ? strip(details[1]).replace(/^-\s*/, "") : "";
      const proof = text.match(/(\d+(?:\.\d+)?)\s*Proof/);
      const price = text.match(/\$\s?([\d,]+(?:\.\d+)?)/);
      const age = text.match(/Aged (?:at least |a minimum of |for )?(\d+)(?:\s*-\s*\d+)? years?/i);
      entries.push({
        listedAs: strip(name[1]),
        month,
        details: text,
        proof: proof ? Number(proof[1]) : null,
        // A range or "varies" is not one proof.
        proofIsSingle: Boolean(proof) && !/varies|\d\s*(?:-|to|\/)\s*\d+(?:\.\d+)?\s*Proof/i.test(text),
        price: price ? Number(price[1].replace(/,/g, "")) : null,
        halfBottle: /375\s*mL/i.test(text),
        age: age ? Number(age[1]) : null,
        links,
      });
    }
  }
  return entries;
}

async function loadCatalog() {
  const data = JSON.parse(await get(`${SITE}/api/catalog`));
  const bottles = [];
  const subBrands = new Map();
  for (const brand of data.brands) {
    for (const sb of brand.subBrands) {
      subBrands.set(sb.id, { id: sb.id, name: sb.name, brandId: brand.id, brandName: brand.name });
      for (const bt of sb.bottles) bottles.push({ ...bt, subBrandId: sb.id, brandId: brand.id });
    }
  }
  return { brands: data.brands, subBrands, bottles };
}

function producerOf(listedAs, catalog) {
  const low = norm(listedAs) + " ";
  if (INDEPENDENT_BOTTLERS.some((b) => low.includes(b))) return null;
  for (const [brandId, list] of Object.entries(PRODUCER_WORDS)) if (list.some((w) => low.includes(w))) return brandId;
  // Producers added to the site since this list was written: match on the brand's own name.
  for (const brand of catalog.brands) {
    const lead = norm(brand.name).replace(/ (distillery|distilling co\.?|distilling|whiskey co\.?|whiskey|bourbon|spirits|company)$/g, "");
    if (lead.length > 4 && low.includes(lead)) return brand.id;
  }
  return null;
}

/** The existing bottles whose names look most like this one. */
function nearest(listedAs, bottles, count = 3) {
  const mine = words(listedAs);
  return bottles
    .map((b) => {
      const theirs = words(b.name);
      let shared = 0;
      for (const w of mine) if (theirs.has(w)) shared++;
      return { name: b.name, proof: b.abv ? Math.round(b.abv * 20) / 10 : null, price: b.price, subBrandId: b.subBrandId, score: shared / (mine.size + theirs.size - shared || 1) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((b) => ({ ...b, score: Math.round(b.score * 100) / 100 }));
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function scan() {
  const year = new Date().getFullYear();
  const [html, catalog] = await Promise.all([get(CALENDAR_URL), loadCatalog()]);
  const entries = parseCalendar(html);
  if (entries.length < 20) fail(`only ${entries.length} calendar entries parsed — the page layout has probably changed`);

  const ledger = readJson(LEDGER, { entries: {} });
  const seen = {};
  const fresh = [];
  let carried = 0;
  for (const entry of entries) {
    const key = `${year}|${norm(entry.listedAs)}`;
    seen[key] = { listedAs: entry.listedAs, month: entry.month, details: entry.details };
    const brandId = producerOf(entry.listedAs, catalog);
    if (!brandId) continue;
    carried++;
    const before = ledger.entries[key];
    if (!flag("--all") && before && before.details === entry.details) continue;
    const brand = catalog.brands.find((b) => b.id === brandId);
    fresh.push({
      ...entry,
      change: before ? "details changed" : "new",
      previousDetails: before?.details,
      ready: entry.proofIsSingle && entry.price != null,
      producer: { id: brandId, name: brand?.name },
      lines: (brand?.subBrands ?? []).map((sb) => ({ id: sb.id, name: sb.name, bottles: sb.bottles.length })),
      nearestExisting: nearest(entry.listedAs, catalog.bottles.filter((b) => b.brandId === brandId)),
    });
  }
  writeJson(LAST_SCAN, { scannedAt: new Date().toISOString(), source: CALENDAR_URL, entries: seen });
  console.log(
    JSON.stringify(
      {
        source: CALENDAR_NAME,
        url: CALENDAR_URL,
        calendarEntries: entries.length,
        fromProducersWeCarry: carried,
        toConsider: fresh.length,
        note: "ready=false means no price or no single proof yet; leave those — they come back when the calendar fills them in.",
        entries: fresh,
      },
      null,
      1
    )
  );
}

async function feeds() {
  const days = Number(option("--days", "8"));
  const since = Date.now() - days * 86400000;
  const out = [];
  for (const feed of FEEDS) {
    try {
      const xml = await get(feed.url);
      for (const item of xml.split(/<item[\s>]/).slice(1)) {
        const pick = (tag) => {
          const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
          return m ? strip(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")) : "";
        };
        const date = new Date(pick("pubDate"));
        if (Number.isNaN(date.getTime()) || date.getTime() < since) continue;
        out.push({ feed: feed.name, date: date.toISOString().slice(0, 10), title: pick("title"), url: pick("link") });
      }
    } catch (err) {
      out.push({ feed: feed.name, error: String(err.message ?? err) });
    }
  }
  console.log(JSON.stringify(out, null, 1));
}

async function submit() {
  const file = args[1];
  if (!file || file.startsWith("--")) fail("usage: release-watch.mjs submit <picks.json> [--dry-run]");
  const picks = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(picks)) fail("the picks file must be a JSON array");
  const [catalog, env] = [await loadCatalog(), loadEnv()];
  const ledger = readJson(LEDGER, { entries: {} });
  ledger.submitted ??= [];

  const waiting = env.canRead ? await supabase(env, "GET", `submissions?select=data&session_id=eq.${SESSION}&status=eq.pending`) : [];
  const taken = new Set([...catalog.bottles.map((b) => norm(b.name)), ...waiting.map((w) => norm(w.data?.bottleName ?? "")), ...ledger.submitted.map(norm)]);

  const rows = [];
  const problems = [];
  for (const [i, p] of picks.entries()) {
    const where = `#${i + 1} ${p.name ?? "(no name)"}`;
    const line = catalog.subBrands.get(p.subBrandId);
    const errors = [];
    if (!p.name) errors.push("name is missing");
    if (!line) errors.push(`no line with id "${p.subBrandId}" on the site`);
    if (!(p.proof >= 60 && p.proof <= 170)) errors.push(`proof ${p.proof} is not a plausible single proof`);
    if (!(p.price > 0)) errors.push("price is missing");
    if (!RARITY_SCORE[p.rarity]) errors.push(`rarity must be one of ${Object.keys(RARITY_SCORE).join(", ")}`);
    if (p.style && !STYLES.includes(p.style)) errors.push(`style must be one of: ${STYLES.join(", ")} (or left out)`);
    if (p.availability && !AVAILABILITY.includes(p.availability)) errors.push(`availability must be one of ${AVAILABILITY.join(", ")}`);
    if (p.name && taken.has(norm(p.name))) errors.push("a bottle with this name is already on the site or waiting for review");
    if (errors.length) {
      problems.push(`${where}: ${errors.join("; ")}`);
      continue;
    }
    taken.add(norm(p.name));
    rows.push({
      type: "bottle",
      parent_id: line.id,
      parent_name: line.name,
      session_id: SESSION,
      data: {
        bottleName: p.name,
        bottleAbv: Math.round(p.proof * 50) / 100,
        bottlePrice: p.price,
        ...(p.age ? { bottleAge: p.age } : {}),
        bottleRarity: p.rarity,
        bottleRarityScore: p.rarityScore ?? RARITY_SCORE[p.rarity],
        bottleDescription: p.description ?? "",
        ...(p.style ? { bottleStyle: p.style } : {}),
        bottleAvailability: p.availability ?? "limited_release",
        curated: true,
        release: { producer: line.brandName, source: p.source ?? CALENDAR_NAME, url: p.url ?? CALENDAR_URL, listedAs: p.listedAs, details: p.details, month: p.month },
      },
    });
  }

  for (const r of rows) console.log(`queue: ${r.data.bottleName} → ${r.data.release.producer} / ${r.parent_name} (${r.data.bottleAbv * 2} proof, $${r.data.bottlePrice})`);
  for (const p of problems) console.log("SKIPPED " + p);
  if (flag("--dry-run")) return console.log(`dry run: ${rows.length} would be queued, ${problems.length} skipped`);
  if (rows.length) {
    await supabase(env, "POST", "submissions", rows);
    ledger.submitted.push(...rows.map((r) => r.data.bottleName));
    writeJson(LEDGER, ledger);
  }
  console.log(`${rows.length} queued for review at ${SITE}/admin; ${problems.length} skipped`);
  if (problems.length) process.exitCode = 2;
}

function commit() {
  const last = readJson(LAST_SCAN, null);
  if (!last) fail("no scan to commit; run scan first");
  const ledger = readJson(LEDGER, { entries: {} });
  let added = 0;
  let changed = 0;
  for (const [key, entry] of Object.entries(last.entries)) {
    const before = ledger.entries[key];
    if (!before) added++;
    else if (before.details !== entry.details) changed++;
    ledger.entries[key] = { ...entry, firstSeen: before?.firstSeen ?? last.scannedAt, lastSeen: last.scannedAt };
  }
  ledger.lastCommitted = last.scannedAt;
  writeJson(LEDGER, ledger);
  console.log(`ledger: ${Object.keys(ledger.entries).length} entries (${added} new, ${changed} updated) as of ${last.scannedAt}`);
}

async function status() {
  const env = loadEnv();
  if (!env.canRead) fail("the service role key is needed to read pending submissions");
  const waiting = await supabase(env, "GET", `submissions?select=data,submitted_at&session_id=eq.${SESSION}&status=eq.pending&order=submitted_at`);
  console.log(JSON.stringify({ waitingForReview: waiting.length, reviewAt: `${SITE}/admin`, bottles: waiting.map((w) => w.data?.bottleName) }, null, 1));
}

const commands = { scan, feeds, submit, commit, status };
if (!commands[command]) fail(`usage: release-watch.mjs <${Object.keys(commands).join("|")}> [options]`);
Promise.resolve(commands[command]()).catch((err) => fail(String(err.message ?? err)));
