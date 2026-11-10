// build.js
// Netlify ovo pokreće pri svakom pushu. Iz posts.json pravi:
//   /blog/<naslov-teksta>/  posebna stranica za svaki tekst
//   /blog/                  spisak svih tekstova
//   /sitemap.xml i /robots.txt za Google
// Tekstove i dalje dodajete samo u posts.json.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
// Netlify sam daje pravu adresu sajta (i kad kupite domen, mijenja se automatski)
const SITE = (process.env.URL || 'https://verdant-kulfi-e880ec.netlify.app').replace(/\/+$/, '');
const SITE_NAME = 'Psihoterapija Jovana Simoni';

/* ---------- pomoćne funkcije ---------- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mora biti isto kao postSlugs u index.html
function slugify(s) {
  const map = { 'š': 's', 'đ': 'dj', 'č': 'c', 'ć': 'c', 'ž': 'z', 'Š': 's', 'Đ': 'dj', 'Č': 'c', 'Ć': 'c', 'Ž': 'z' };
  return String(s || '')
    .replace(/[šđčćžŠĐČĆŽ]/g, c => map[c])
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tekst';
}
function postSlugs(list) {
  const used = {};
  return list.map(p => {
    let s = p.slug ? slugify(p.slug) : slugify(p.title);
    if (used[s]) { used[s] += 1; s = s + '-' + used[s]; } else { used[s] = 1; }
    return s;
  });
}

function imageOf(p) {
  if (p.image) return p.image;
  const m = String(p.bg || '').match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
  return m ? m[1] : null;
}
const absPath = img => (/^https?:\/\//.test(img) ? img : '/' + String(img).replace(/^\/+/, ''));

function formatBody(body) {
  body = String(body || '');
  if (/<p[\s>]/i.test(body)) return body;
  return body.split(/\n\s*\n/).filter(x => x.trim())
    .map(x => '<p>' + esc(x.trim()).replace(/\n/g, '<br>') + '</p>').join('\n');
}

const MONTHS = { januar: 1, februar: 2, mart: 3, april: 4, maj: 5, jun: 6, jul: 7, avgust: 8, septembar: 9, oktobar: 10, novembar: 11, decembar: 12 };
function isoDate(d) {
  const m = String(d || '').toLowerCase().match(/(\d{1,2})\.\s*([a-zčćžšđ]+)\s+(\d{4})/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/* ---------- izgled (isti stil kao početna) ---------- */

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />`;

const CSS = `
  :root { --clay:#C49A7A; --clay-lt:#E8D5C0; --sage:#8A9E8C; --sage-lt:#D6E2D7; --cream:#F7F2EC; --ink:#2C2420; --ink-soft:#6B5C55; --white:#FDFAF7; --border:#E0D4C8; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--ink); }
  img { max-width: 100%; display: block; }
  a { color: inherit; }
  :focus-visible { outline: 2px solid var(--clay); outline-offset: 3px; }
  nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem 4vw; background: rgba(247,242,236,0.95); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; }
  .nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.4rem; text-decoration: none; line-height: 1.1; }
  .nav-logo span { color: var(--clay); font-style: italic; }
  .nav-links { display: flex; gap: 2rem; list-style: none; }
  .nav-links a { font-size: 0.8rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); text-decoration: none; }
  .nav-links a:hover { color: var(--clay); }
  .nav-cta { font-size: 0.78rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; background: var(--clay); color: var(--white); padding: 0.6rem 1.4rem; border-radius: 2rem; text-decoration: none; white-space: nowrap; }
  .nav-cta:hover { background: var(--ink); }
  main { padding: 4rem 4vw 6rem; }
  .back { display: inline-block; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: var(--clay); text-decoration: none; margin-bottom: 2.5rem; }
  .back:hover { color: var(--ink); }
  article { max-width: 700px; margin: 0 auto; }
  .tag { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--clay); margin-bottom: 1rem; }
  h1 { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(2.4rem, 5vw, 3.6rem); line-height: 1.1; margin-bottom: 1rem; }
  .meta { font-size: 0.85rem; color: var(--ink-soft); padding-bottom: 2rem; margin-bottom: 2.5rem; border-bottom: 1px solid var(--border); }
  .cover { max-width: 460px; margin: 0 auto 2.5rem; border-radius: 0.8rem; }
  .content p { font-size: 1.08rem; line-height: 1.9; color: var(--ink-soft); font-weight: 300; margin-bottom: 1.3rem; }
  .cta { margin-top: 3.5rem; background: var(--white); border: 1px solid var(--border); border-radius: 1.2rem; padding: 2.2rem; }
  .cta h2 { font-family: 'Cormorant Garamond', serif; font-weight: 400; font-size: 1.8rem; margin-bottom: 0.6rem; }
  .cta p { color: var(--ink-soft); font-weight: 300; line-height: 1.7; margin-bottom: 1.4rem; }
  .btn { display: inline-block; padding: 0.85rem 2rem; background: var(--clay); color: var(--white); border-radius: 2rem; font-size: 0.82rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; }
  .btn:hover { background: var(--ink); }
  .more { max-width: 1100px; margin: 5rem auto 0; }
  .more h2, .list-head h1 { font-family: 'Cormorant Garamond', serif; font-weight: 300; }
  .more h2 { font-size: 2rem; margin-bottom: 1.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.8rem; }
  .card { display: flex; flex-direction: column; background: var(--white); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; text-decoration: none; transition: transform 0.25s, box-shadow 0.25s; }
  .card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(44,36,32,0.1); }
  .card .thumb { aspect-ratio: 4 / 5; background: var(--clay-lt); display: flex; align-items: center; justify-content: center; }
  .card .thumb img { width: 100%; height: 100%; object-fit: contain; }
  .card .body { padding: 1.3rem; }
  .card .t { font-size: 0.66rem; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: var(--clay); }
  .card h3 { font-family: 'Cormorant Garamond', serif; font-weight: 400; font-size: 1.35rem; line-height: 1.3; margin: 0.5rem 0; }
  .card p { font-size: 0.88rem; line-height: 1.65; color: var(--ink-soft); font-weight: 300; }
  .list-head { max-width: 1100px; margin: 0 auto 3rem; }
  .list-head p { color: var(--ink-soft); font-weight: 300; line-height: 1.7; max-width: 520px; }
  .list { max-width: 1100px; margin: 0 auto; }
  footer { background: #1A1310; color: rgba(247,242,236,0.45); padding: 2rem 4vw; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; font-size: 0.8rem; }
  footer a { color: var(--clay); text-decoration: none; }
  .footer-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; color: rgba(247,242,236,0.75); font-style: italic; }
  @media (max-width: 800px) { .nav-links { display: none; } .nav-logo { font-size: 1.15rem; } main { padding-top: 2.5rem; } }
`;

const NAV = `<nav>
  <a href="/" class="nav-logo">Psihoterapija <span>Jovana Simoni</span></a>
  <ul class="nav-links">
    <li><a href="/blog/">Blog</a></li>
    <li><a href="/#o-meni">O meni</a></li>
    <li><a href="/#usluge">Usluge</a></li>
    <li><a href="/#kontakt">Kontakt</a></li>
  </ul>
  <a href="/#kontakt" class="nav-cta">Zakažite seansu</a>
</nav>`;

const FOOTER = `<footer>
  <span class="footer-logo">${SITE_NAME}</span>
  <span>© ${new Date().getFullYear()} Sva prava zadržana</span>
  <a href="https://www.instagram.com/unutrasnji_prostor/" target="_blank" rel="noopener">Instagram</a>
</footer>`;

function card(p, slug) {
  const img = imageOf(p);
  return `<a class="card" href="/blog/${slug}/">
      <div class="thumb">${img ? `<img src="${esc(absPath(img))}" alt="${esc(p.title)}" loading="lazy">` : ''}</div>
      <div class="body">
        <span class="t">${esc(p.tag)}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.excerpt)}</p>
      </div>
    </a>`;
}

function head({ title, description, url, image, type, jsonld }) {
  return `<!DOCTYPE html>
<html lang="sr-Latn-ME">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  ${image ? `<meta property="og:image" content="${esc(image)}" />` : ''}
  <meta property="og:locale" content="sr_ME" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
  ${FONTS}
  <style>${CSS}</style>
</head>`;
}

/* ---------- stranice ---------- */

function postPage(p, slug, others) {
  const url = `${SITE}/blog/${slug}/`;
  const img = imageOf(p);
  const imgAbs = img ? (/^https?:/.test(img) ? img : SITE + absPath(img)) : null;
  const iso = isoDate(p.date);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    description: p.excerpt,
    image: imgAbs || undefined,
    datePublished: iso || undefined,
    inLanguage: 'sr-Latn-ME',
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: 'Jovana Simoni' },
    publisher: { '@type': 'Organization', name: SITE_NAME }
  };
  return `${head({ title: `${p.title} | ${SITE_NAME}`, description: p.excerpt, url, image: imgAbs, type: 'article', jsonld })}
<body>
${NAV}
<main>
  <article>
    <a class="back" href="/blog/">Svi tekstovi</a>
    <p class="tag">${esc(p.tag)}</p>
    <h1>${esc(p.title)}</h1>
    <p class="meta">${[p.date, p.readTime].filter(Boolean).map(esc).join(', ')}</p>
    ${img ? `<img class="cover" src="${esc(absPath(img))}" alt="${esc(p.title)}">` : ''}
    <div class="content">
${formatBody(p.body)}
    </div>
    <div class="cta">
      <h2>Želite da o ovome razgovaramo?</h2>
      <p>Ako ste u ovom tekstu prepoznali nešto svoje, pišite mi. Radim uživo u Podgorici i online.</p>
      <a class="btn" href="/#kontakt">Zakažite razgovor</a>
    </div>
  </article>
  ${others.length ? `<section class="more">
    <h2>Pročitajte još</h2>
    <div class="grid">
      ${others.map(o => card(o.p, o.slug)).join('\n      ')}
    </div>
  </section>` : ''}
</main>
${FOOTER}
</body>
</html>`;
}

function listPage(posts, slugs) {
  const url = `${SITE}/blog/`;
  return `${head({ title: `Blog | ${SITE_NAME}`, description: 'Tekstovi o emocijama, odnosima, promjeni i ličnom rastu. Psihoterapija u Podgorici i online.', url, type: 'website' })}
<body>
${NAV}
<main>
  <div class="list-head">
    <a class="back" href="/">Početna</a>
    <h1>Blog</h1>
    <p>Pišem o stvarima o kojima razgovaramo i u terapiji. O promjeni, strahu, odnosima i o tome kako da budemo malo blaži prema sebi.</p>
  </div>
  <div class="list grid">
    ${posts.map((p, i) => card(p, slugs[i])).join('\n    ')}
  </div>
</main>
${FOOTER}
</body>
</html>`;
}

/* ---------- pokretanje ---------- */

let posts;
try {
  posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'posts.json'), 'utf8'));
} catch (e) {
  console.error('\nGREŠKA u posts.json: ' + e.message);
  console.error('Najčešće fali zarez između dva posta, ima zarez viška poslije posljednjeg, ili su u tekstu obični navodnici " umjesto „ “.');
  console.error('Sajt nije promijenjen. Ispravite posts.json i ponovo uradite push.\n');
  process.exit(1);
}
if (!Array.isArray(posts)) { console.error('posts.json mora počinjati sa [ i završavati se sa ]'); process.exit(1); }

const slugs = postSlugs(posts);
const blogDir = path.join(ROOT, 'blog');
fs.rmSync(blogDir, { recursive: true, force: true });
fs.mkdirSync(blogDir, { recursive: true });

posts.forEach((p, i) => {
  const others = posts.map((o, j) => ({ p: o, slug: slugs[j] })).filter((_, j) => j !== i).slice(0, 3);
  const dir = path.join(blogDir, slugs[i]);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), postPage(p, slugs[i], others));
  console.log('Napravljena stranica: /blog/' + slugs[i] + '/');
});
fs.writeFileSync(path.join(blogDir, 'index.html'), listPage(posts, slugs));

const urls = [`${SITE}/`, `${SITE}/blog/`, ...slugs.map(s => `${SITE}/blog/${s}/`)];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Gotovo. Broj tekstova: ${posts.length}. Napravljeni su i sitemap.xml i robots.txt za ${SITE}`);
