function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyDogName(name) {
  return normalize(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'user-agent': 'ElevagePro-Cynognostic/1.0',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? JSON.stringify(await response.json())
      : await response.text();

    return { ok: response.ok, status: response.status, contentType, body, url };
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(String(html || ''))) !== null) {
    const href = match[1];
    const label = stripHtml(match[2]);
    try {
      const absolute = new URL(href, baseUrl).toString();
      links.push({ label, url: absolute });
    } catch (error) {
      // ignore invalid links
    }
  }

  return links;
}

function extractCandidateDogLinks(html, baseUrl, dogName) {
  const wanted = normalize(dogName);
  return extractLinks(html, baseUrl)
    .filter((link) => {
      const haystack = normalize(`${link.label} ${link.url}`);
      return haystack.includes(wanted) || haystack.includes(slugifyDogName(dogName));
    })
    .slice(0, 20);
}

function extractPossibleDogNames(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  const matches = source.match(/\b[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' -]{4,}\b/g) || [];
  const blacklist = new Set([
    'CENTRALE CANINE', 'LOF SELECT', 'STATGESCON', 'SETTER ANGLAIS', 'FIELD TRIAL',
    'CHAMPIONNAT', 'RESULTATS', 'DESCENDANTS', 'PRODUCTION', 'UTILISATIONS', 'PEDIGREE'
  ]);

  const counts = new Map();
  matches
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 5 && item.length <= 60)
    .filter((item) => !blacklist.has(item))
    .forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 60);
}

function buildLofSelectCandidateUrls(dogName) {
  const q = encodeURIComponent(dogName || '');
  const slug = slugifyDogName(dogName);
  return [
    `https://www.centrale-canine.fr/lofselect/recherche-chien?search=${q}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien?nom=${q}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien?q=${q}`,
    `https://www.centrale-canine.fr/lofselect/chien/${slug}`,
    `https://www.centrale-canine.fr/lofselect/chien/${slug}/descendance`,
    `https://www.centrale-canine.fr/lofselect/chien/${slug}/utilisations`,
  ];
}

function buildPedigreeSetterCandidateUrls(dogName) {
  const q = encodeURIComponent(dogName || '');
  return [
    `https://pedigree.setter-anglais.fr/genealogie/recherche.php?nom=${q}`,
    `https://pedigree.setter-anglais.fr/genealogie/recherche.php?search=${q}`,
    `https://pedigree.setter-anglais.fr/genealogie/index.php?search=${q}`,
    `https://pedigree.setter-anglais.fr/genealogie/liste_portee.php?search=${q}`,
  ];
}

async function searchSourceCandidates(dogName, source = 'all') {
  const sources = [];
  if (source === 'all' || source === 'lofselect') {
    sources.push(...buildLofSelectCandidateUrls(dogName).map((url) => ({ source: 'LOF Select', url })));
  }
  if (source === 'all' || source === 'pedigree') {
    sources.push(...buildPedigreeSetterCandidateUrls(dogName).map((url) => ({ source: 'Pedigree Setter', url })));
  }

  const attempts = [];
  const candidates = [];

  for (const item of sources) {
    try {
      const response = await fetchWithTimeout(item.url);
      attempts.push({ source: item.source, url: item.url, status: response.status, contentType: response.contentType });
      if (!response.ok) continue;

      const links = extractCandidateDogLinks(response.body, item.url, dogName);
      links.forEach((link) => candidates.push({ source: item.source, ...link }));

      const text = stripHtml(response.body);
      if (normalize(text).includes(normalize(dogName))) {
        candidates.push({ source: item.source, label: `Page contenant ${dogName}`, url: item.url });
      }
    } catch (error) {
      attempts.push({ source: item.source, url: item.url, status: 'ERROR', error: error.message });
    }
  }

  const unique = [];
  const seen = new Set();
  candidates.forEach((candidate) => {
    if (!seen.has(candidate.url)) {
      seen.add(candidate.url);
      unique.push(candidate);
    }
  });

  return { dogName, attempts, candidates: unique.slice(0, 30) };
}

async function fetchDogSheet(url) {
  const response = await fetchWithTimeout(url);
  const text = stripHtml(response.body);
  const links = extractLinks(response.body, url);
  const possibleNames = extractPossibleDogNames(text);

  return {
    ok: response.ok,
    status: response.status,
    url,
    contentType: response.contentType,
    text: text.slice(0, 20000),
    links: links.slice(0, 80),
    possibleNames,
  };
}

function parseDescendantsText(text) {
  return String(text || '')
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((v) => normalize(v) === normalize(item)) === index)
    .slice(0, 40);
}

module.exports = {
  searchSourceCandidates,
  fetchDogSheet,
  parseDescendantsText,
  extractPossibleDogNames,
  buildLofSelectCandidateUrls,
  buildPedigreeSetterCandidateUrls,
};
