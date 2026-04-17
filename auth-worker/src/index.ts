// Sveltia CMS auth Worker
// ─────────────────────────────────────────────────────────────────────────────
// Minimal OAuth relay for Sveltia/Decap CMS talking to GitHub. Replaces
// Netlify's hosted relay (which Sveltia doesn't fully handshake with).
//
// Flow:
//   1. Sveltia admin opens popup: GET {worker}/auth?provider=github&scope=repo,user
//   2. We redirect to github.com/login/oauth/authorize?...&redirect_uri={worker}/callback
//   3. User authorizes on GitHub → GitHub redirects to {worker}/callback?code=...
//   4. We exchange the code for a token via github.com/login/oauth/access_token
//   5. We return a tiny HTML page that does the Sveltia handshake:
//        - popup postMessages 'authorizing:github' to opener
//        - opener responds 'authorized:github' (means "I'm ready for the token")
//        - popup postMessages 'authorization:github:success:<json>' with the token
//        - popup closes
//
// Cost: free tier — ~3 requests per admin login, zero cost per user.

interface Env {
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	ALLOWED_DOMAIN: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/auth") {
			return handleAuth(request, env);
		}
		if (url.pathname === "/callback") {
			return handleCallback(request, env);
		}
		if (url.pathname === "/" || url.pathname === "") {
			return new Response(
				"Sveltia CMS auth worker is alive.\n" +
					`Target admin: https://${env.ALLOWED_DOMAIN}/admin/\n` +
					"Endpoints: /auth, /callback\n",
				{ headers: { "content-type": "text/plain" } }
			);
		}
		return new Response("Not found", { status: 404 });
	},
};

function handleAuth(request: Request, env: Env): Response {
	const url = new URL(request.url);
	const provider = url.searchParams.get("provider") ?? "github";
	if (provider !== "github") {
		return new Response(`Unsupported provider: ${provider}`, { status: 400 });
	}

	const scope = url.searchParams.get("scope") ?? "repo,user";
	const redirectUri = `${url.origin}/callback`;

	const authorize = new URL("https://github.com/login/oauth/authorize");
	authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
	authorize.searchParams.set("scope", scope);
	authorize.searchParams.set("redirect_uri", redirectUri);
	// state would add CSRF protection; for a low-risk team CMS we skip it.

	return Response.redirect(authorize.toString(), 302);
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	if (!code) return new Response("Missing `code` query param", { status: 400 });

	let token: string;
	try {
		const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				"user-agent": "team-4159-cms-auth-worker",
			},
			body: JSON.stringify({
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				code,
			}),
		});
		const data = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
		if (!data.access_token) {
			return new Response(
				`GitHub token exchange failed: ${data.error ?? "unknown"} — ${data.error_description ?? ""}`,
				{ status: 500 }
			);
		}
		token = data.access_token;
	} catch (err) {
		return new Response(`Token exchange error: ${String(err)}`, { status: 502 });
	}

	const targetOrigin = `https://${env.ALLOWED_DOMAIN}`;
	const payload = JSON.stringify({ provider: "github", token });

	// HTML that performs Sveltia's handshake. The opener (admin tab) is
	// listening for 'authorizing:<provider>' → replies 'authorized:<provider>' →
	// we then send the actual token.
	const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<title>Authorizing…</title>
	<style>
		body { font-family: system-ui, sans-serif; padding: 2rem; color: #333; text-align: center; }
	</style>
</head>
<body>
	<p>Authorizing with GitHub…</p>
	<script>
	(function () {
		var payload = ${JSON.stringify(payload)};
		var targetOrigin = ${JSON.stringify(targetOrigin)};
		var provider = "github";

		function sendAuthorizing() {
			try { window.opener.postMessage("authorizing:" + provider, targetOrigin); }
			catch (e) { document.body.innerHTML = "<p>Could not reach admin window. Close this and try again.</p>"; }
		}

		function onMessage(e) {
			// Accept any origin on the intended target host (Sveltia sometimes
			// posts back from the admin origin, not the exact string we sent).
			if (e.origin !== targetOrigin) return;
			if (e.data === "authorized:" + provider) {
				window.removeEventListener("message", onMessage);
				window.opener.postMessage(
					"authorization:" + provider + ":success:" + payload,
					targetOrigin
				);
				setTimeout(function () { window.close(); }, 150);
			}
		}

		window.addEventListener("message", onMessage);
		// Kick off: announce we're ready. Retry a few times in case the opener
		// hasn't attached its listener yet.
		var kicks = 0;
		var interval = setInterval(function () {
			if (kicks++ > 20) clearInterval(interval);
			sendAuthorizing();
		}, 100);
	})();
	</script>
</body>
</html>`;

	return new Response(html, {
		headers: {
			"content-type": "text/html;charset=utf-8",
			"cache-control": "no-store",
		},
	});
}
