#!/usr/bin/env node
// Exports content from the EmDash prod D1 into markdown files + a homepage JSON.
// Run from the Sveltia project root:
//   pnpm node scripts/export-from-emdash.mjs
// Requires wrangler authenticated to the 4159 CardinalBotics account.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "..");
const pagesDir = path.join(root, "src/content/pages");
const postsDir = path.join(root, "src/content/posts");
const homepageDir = path.join(root, "src/content/homepage");

fs.mkdirSync(pagesDir, { recursive: true });
fs.mkdirSync(postsDir, { recursive: true });
fs.mkdirSync(homepageDir, { recursive: true });

const DB = "team-4159-website-database";
function q(sql) {
	const out = execSync(
		`npx wrangler d1 execute ${DB} --remote --json --command ${JSON.stringify(sql)}`,
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
	);
	// wrangler prints noise before the JSON array
	const m = out.match(/\[\s*\{\s*"results"/);
	if (!m) throw new Error("no JSON in wrangler output");
	const start = m.index;
	let depth = 0, end = start;
	for (let i = start; i < out.length; i++) {
		if (out[i] === "[") depth++;
		else if (out[i] === "]") {
			depth--;
			if (depth === 0) { end = i + 1; break; }
		}
	}
	return JSON.parse(out.slice(start, end))[0].results;
}

function esc(s) {
	if (s === null || s === undefined) return "";
	// YAML frontmatter: use double-quoted string, escape backslash and quote
	return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function fm(data) {
	const lines = ["---"];
	for (const [k, v] of Object.entries(data)) {
		if (v === null || v === undefined) continue;
		lines.push(`${k}: "${esc(v)}"`);
	}
	lines.push("---");
	return lines.join("\n");
}

// ── pages ──────────────────────────────────────────────────────────────────
console.log("exporting pages...");
const pageRows = q("SELECT slug, title, html_content, published_at FROM ec_pages WHERE status='published' AND slug != 'homepage-config'");
let nPages = 0;
for (const r of pageRows) {
	const slug = r.slug || "";
	if (!slug) continue;
	const body = (r.html_content || "").trim();
	if (!body) continue;
	const file = path.join(pagesDir, `${slug}.md`);
	fs.writeFileSync(
		file,
		fm({ title: r.title || slug, date: r.published_at }) + "\n\n" + body + "\n"
	);
	nPages++;
}
console.log(`  wrote ${nPages} pages`);

// ── posts ──────────────────────────────────────────────────────────────────
console.log("exporting posts...");
const postRows = q("SELECT slug, title, html_content, excerpt, published_at FROM ec_posts WHERE status='published'");
let nPosts = 0;
for (const r of postRows) {
	const slug = r.slug || "";
	if (!slug) continue;
	const body = (r.html_content || "").trim();
	const file = path.join(postsDir, `${slug}.md`);
	fs.writeFileSync(
		file,
		fm({
			title: r.title || slug,
			excerpt: r.excerpt,
			date: r.published_at,
		}) + "\n\n" + (body || r.excerpt || "") + "\n"
	);
	nPosts++;
}
console.log(`  wrote ${nPosts} posts`);

// ── homepage singleton ─────────────────────────────────────────────────────
console.log("exporting homepage config...");
const hpRows = q("SELECT content FROM ec_pages WHERE slug='homepage-config' LIMIT 1");
let slots = {};
if (hpRows.length) {
	try {
		const blocks = JSON.parse(hpRows[0].content || "[]");
		let key = null;
		for (const b of blocks) {
			if (b._type !== "block") continue;
			const text = (b.children ?? []).map((c) => c.text ?? "").join("");
			if (/^h[1-6]$/.test(b.style ?? "")) {
				key = text.trim().toLowerCase().replace(/\s+/g, "_");
			} else if ((b.style === "normal" || !b.style) && key && text.trim()) {
				slots[key] = slots[key] ? slots[key] + "\n\n" + text : text;
			}
		}
	} catch (e) {
		console.warn("  couldn't parse homepage-config content:", e.message);
	}
}

const homepage = {
	hero_pitch: slots.hero_pitch ?? "Lowell High School's FIRST Robotics team. Six weeks. A hundred-and-twenty-five pound machine. One shot at the field. We've been doing this since 2012.",
	seasons_count: slots.seasons_count ?? "14",
	seasons_label: slots.seasons_label ?? "Seasons · and counting",
	mission_title: slots.mission_title ?? "We build to",
	mission_accent: slots.mission_accent ?? "inspire.",
	mission_statement: slots.mission_statement ?? "CardinalBotics inspires youth by promoting creativity, teamwork, and commitment to our community. Through robotics, we develop the skills necessary to become leaders of a dynamic, increasingly technology-dependent society.",
	mission_focus: slots.mission_focus ?? "Design, fabrication, programming, electronics, business, PR.",
	mission_competition: slots.mission_competition ?? "State regionals, district events, and World Championships.",
	mission_outreach: slots.mission_outreach ?? "FLL mentorship, demos, and the IGNITE Women in STEM panel.",
	join_title: slots.join_title ?? "Join the",
	join_accent: slots.join_accent ?? "team.",
	cta_donate_label: "Support the Team",
	cta_donate_url: "https://www.sfedfund.org/team4159",
	cta_sponsors_label: "Our Sponsors",
	cta_sponsors_url: "/pages/current-sponsors",
	join_cta1_label: "Prospective Members",
	join_cta1_url: "/pages/contact-us",
	join_cta2_label: "Sponsor the Team",
	join_cta2_url: "/pages/current-sponsors",
	join_cta3_label: "Request a Demo",
	join_cta3_url: "/pages/outreach",
};
fs.writeFileSync(path.join(homepageDir, "main.json"), JSON.stringify(homepage, null, 2) + "\n");
console.log("  wrote homepage/main.json");

console.log("done.");
