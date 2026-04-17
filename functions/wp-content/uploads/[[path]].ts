// Cloudflare Pages function: serves any /wp-content/uploads/<path> request
// from the shared R2 bucket (team-4159-website-bucket). Mirrors the worker
// route in the EmDash project so the 491 migrated media files work here too.

interface Env {
	MEDIA: R2Bucket;
}

export const onRequest: PagesFunction<Env> = async ({ params, env }) => {
	const pathParts = Array.isArray(params.path) ? params.path : [params.path];
	const key = "wp-content/uploads/" + pathParts.join("/");
	const obj = await env.MEDIA.get(key);
	if (!obj) return new Response("Not found", { status: 404 });

	const ext = key.split(".").pop()?.toLowerCase() ?? "";
	const type = MIME_TYPES[ext] ?? "application/octet-stream";
	return new Response(obj.body, {
		headers: {
			"content-type": type,
			"cache-control": "public, max-age=31536000, immutable",
			"etag": obj.httpEtag,
		},
	});
};

const MIME_TYPES: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	pdf: "application/pdf",
	mp4: "video/mp4",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	zip: "application/zip",
};
