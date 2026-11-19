// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others) that the public pages changed,
// so they re-crawl them soon. Run after deploying a change to a public page:
//
//     node scripts/indexnow.mjs
//
// It reads the live sitemap, so new public pages are included once they are in src/app/sitemap.ts.
// The key file public/<key>.txt must be live first (it is listed in PUBLIC_PATHS in
// src/lib/supabase/proxy-session.ts). The key is public by design; it only proves the site is ours.

const SITE = "https://polaris.tiffanyaisys.com";
const KEY = "ccf5a106b3f9490fade1bab6bed13bc2";

const sitemap = await fetch(`${SITE}/sitemap.xml`).then((r) => r.text());
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (urlList.length === 0) throw new Error("No URLs found in the sitemap.");

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});

// 200 = accepted, 202 = received (key check pending), 403 = key file not found, 422 = URLs not on this host.
console.log(`IndexNow answered ${res.status} for ${urlList.length} URLs:`);
for (const url of urlList) console.log(`  ${url}`);
