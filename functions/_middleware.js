const site = "https://atlantisprivee.com";
const articleSlug = /^[a-z0-9_-]+$/;
const articleDirectory = "/guides/";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

function renderDirectory(articles) {
  const categories = new Map();

  for (const article of articles) {
    if (article.status !== "published" || !articleSlug.test(article.slug ?? "")) continue;

    const category = article.category || "Other guides";
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(
      '<li><a href="/articles/' + article.slug + '">' + escapeHtml(article.title) + "</a></li>",
    );
  }

  return [...categories.keys()].sort().map(category =>
    "<section><h2>" + escapeHtml(category) + "</h2><ul>" +
    categories.get(category).join("\n") + "</ul></section>",
  ).join("\n");
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  if (url.pathname === "/guides") {
    return Response.redirect(new URL(articleDirectory, url), 301);
  }

  if (url.pathname === articleDirectory) {
    const [shell, catalog] = await Promise.all([
      env.ASSETS.fetch(new URL(articleDirectory, url)),
      env.ASSETS.fetch(new URL("/data/articles.json", url)),
    ]);
    if (!shell.ok || !catalog.ok) {
      return new Response("Article directory temporarily unavailable.", { status: 503 });
    }

    const [template, articles] = await Promise.all([shell.text(), catalog.json()]);
    const html = template.replace("<!-- ARTICLE_DIRECTORY -->", () => renderDirectory(articles));
    return new Response(request.method === "HEAD" ? null : html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // Keep historical /article?slug= links working without relying on JavaScript.
  const slug = url.searchParams.get("slug");
  if (!slug || !articleSlug.test(slug)) {
    return new Response(request.method === "HEAD" ? null : "Article not found.", { status: 404 });
  }

  const path = "/articles/" + slug;
  const article = await env.ASSETS.fetch(new Request(new URL(path, url), {
    method: request.method === "HEAD" ? "HEAD" : "GET",
  }));
  return article.ok ? Response.redirect(new URL(path, site), 301) : article;
}
