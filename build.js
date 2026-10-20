/*
 * Static multilingual build for chicplay.net.
 *   src/template.html + locales/{ko,en,ja}.json  ->  dist/, dist/en/, dist/ja/
 * Also copies assets, legal pages, robots.txt and emits sitemap.xml.
 * Pure Node (no dependencies). Run: `npm run build`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src', 'template.html');
const LOCALES_DIR = path.join(ROOT, 'locales');
const DIST = path.join(ROOT, 'dist');

const SITE = 'https://www.chicplay.net';

// locale -> { path on site, <html lang>, og:locale }
const LOCALES = {
  ko: { dir: '',    lang: 'ko', ogLocale: 'ko_KR', legalHash: ''    },
  en: { dir: 'en',  lang: 'en', ogLocale: 'en_US', legalHash: '#en' },
  ja: { dir: 'ja',  lang: 'ja', ogLocale: 'ja_JP', legalHash: '#en' },
};
const LANG_LABELS = { ko: 'KO', en: 'EN', ja: '日本語' };

const urlFor = (code) => SITE + '/' + (LOCALES[code].dir ? LOCALES[code].dir + '/' : '');

const HREFLANG = [
  `<link rel="alternate" hreflang="ko" href="${urlFor('ko')}" />`,
  `<link rel="alternate" hreflang="en" href="${urlFor('en')}" />`,
  `<link rel="alternate" hreflang="ja" href="${urlFor('ja')}" />`,
  `<link rel="alternate" hreflang="x-default" href="${urlFor('ko')}" />`,
].join('\n  ');

const JA_EXTRA_HEAD = [
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
  `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet" />`,
  `<style>`,
  `    :root {`,
  `      --font-sans: 'Noto Sans JP', 'Pretendard', system-ui, -apple-system, sans-serif;`,
  `      --font-serif: 'Fraunces', 'Noto Sans JP', serif;`,
  `    }`,
  `  </style>`,
].join('\n  ');

function langSwitch(current) {
  return Object.keys(LOCALES).map((code) => {
    const active = code === current ? ' is-active' : '';
    const aria = code === current ? ' aria-current="page"' : '';
    return `<a href="${urlFor(code)}" class="nav-lang${active}"${aria} hreflang="${code}">${LANG_LABELS[code]}</a>`;
  }).join('');
}

function ogLocaleAlternate(current) {
  return Object.keys(LOCALES)
    .filter((c) => c !== current)
    .map((c) => `<meta property="og:locale:alternate" content="${LOCALES[c].ogLocale}" />`)
    .join('\n  ');
}

function computed(code) {
  const L = LOCALES[code];
  return {
    lang: L.lang,
    canonical: urlFor(code),
    og_url: urlFor(code),
    og_locale: L.ogLocale,
    og_locale_alternate: ogLocaleAlternate(code),
    hreflang: HREFLANG,
    extra_head: code === 'ja' ? JA_EXTRA_HEAD : '',
    lang_switch: langSwitch(code),
    privacy_href: '/privacy.html' + L.legalHash,
    terms_href: '/terms.html' + L.legalHash,
  };
}

function render(template, dict) {
  const missing = new Set();
  const out = template.replace(/{{(\w+)}}/g, (m, key) => {
    if (!(key in dict)) { missing.add(key); return m; }
    return dict[key];
  });
  if (missing.size) throw new Error('Unfilled placeholders: ' + [...missing].join(', '));
  return out;
}

function sitemap() {
  const alts = Object.keys(LOCALES)
    .map((c) => `    <xhtml:link rel="alternate" hreflang="${c}" href="${urlFor(c)}"/>`)
    .join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('ko')}"/>`;
  const pages = Object.keys(LOCALES).map((c) =>
    `  <url>\n    <loc>${urlFor(c)}</loc>\n${alts}\n  </url>`).join('\n');
  const legal = [`${SITE}/terms.html`, `${SITE}/privacy.html`]
    .map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${pages}\n${legal}\n</urlset>\n`;
}

// ---- build ----
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const template = fs.readFileSync(SRC, 'utf8');

for (const code of Object.keys(LOCALES)) {
  const locale = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, code + '.json'), 'utf8'));
  const html = render(template, { ...computed(code), ...locale });
  const outDir = path.join(DIST, LOCALES[code].dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log('built', '/' + (LOCALES[code].dir ? LOCALES[code].dir + '/' : ''));
}

// Static assets + legal pages (single bilingual pages, served at root)
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
for (const f of ['terms.html', 'privacy.html', 'robots.txt']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
}

fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap());

console.log('copied assets + legal pages, wrote sitemap.xml');
console.log('done.');
