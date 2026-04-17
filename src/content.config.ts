import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const pages = defineCollection({
	loader: glob({ base: "src/content/pages", pattern: "**/*.md" }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		date: z.coerce.date().optional(),
	}),
});

const posts = defineCollection({
	loader: glob({ base: "src/content/posts", pattern: "**/*.md" }),
	schema: z.object({
		title: z.string(),
		excerpt: z.string().optional(),
		date: z.coerce.date().optional(),
	}),
});

const homepage = defineCollection({
	loader: glob({ base: "src/content/homepage", pattern: "*.json" }),
	schema: z.object({
		hero_pitch: z.string(),
		seasons_count: z.string(),
		seasons_label: z.string(),
		mission_title: z.string(),
		mission_accent: z.string(),
		mission_statement: z.string(),
		mission_focus: z.string(),
		mission_competition: z.string(),
		mission_outreach: z.string(),
		join_title: z.string(),
		join_accent: z.string(),
		cta_donate_label: z.string(),
		cta_donate_url: z.string(),
		cta_sponsors_label: z.string(),
		cta_sponsors_url: z.string(),
		join_cta1_label: z.string(),
		join_cta1_url: z.string(),
		join_cta2_label: z.string(),
		join_cta2_url: z.string(),
		join_cta3_label: z.string(),
		join_cta3_url: z.string(),
	}),
});

export const collections = { pages, posts, homepage };
