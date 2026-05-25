function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyDogName(name) {
  return normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
    const body = contentType.includes('application/json') ? JSON.stringify(await response.json()) : await response.text();
    return { ok: response.ok, status: response.status, contentType, body, url: response.url || url };
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(String(html || ''))) !== null) {
    try {
      links.push({ label: stripHtml(match[2]), url: new URL(match[1], baseUrl).toString() });
    } catch (error) {
      // ignore invalid links
    }
  }
  return links;
}

function extractCandidateDogLinks(html, baseUrl, dogName) {
  const wanted = normalize(dogName);
  const slug = slugifyDogName(dogName);
  return extractLinks(html, baseUrl)
    .filter((link) => {
      const haystack = normalize(`${link.label} ${link.url}`);
      return haystack.includes(wanted) || haystack.includes(slug);
    })
    .slice(0, 30);
}

function isLofSelectDogUrl(url) {
  return /centrale-canine\.fr\/lofselect\/chien\//i.test(String(url || ''));
}

function isPedigreeSetterUrl(url) {
  return /pedigree\.setter-anglais\.fr\/genealogie\//i.test(String(url || ''));
}

function normalizeLofDogBaseUrl(url) {
  const clean = String(url || '').split('#')[0].split('?')[0].replace(/\/+$/, '');
  return clean.replace(/\/(descendance|utilisations|pedigree|sante)$/i, '');
}

function extractLofDogLinks(html, baseUrl, dogName = '') {
  const wanted = normalize(dogName);
  const slug = slugifyDogName(dogName);
  return extractLinks(html, baseUrl)
    .filter((link) => /centrale-canine\.fr\/lofselect\/chien\//i.test(link.url))
    .filter((link) => {
      if (!wanted) return true;
      const haystack = normalize(`${link.label} ${link.url}`);
      return haystack.includes(wanted) || haystack.includes(slug);
    })
    .map((link) => ({ ...link, url: normalizeLofDogBaseUrl(link.url) }))
    .slice(0, 20);
}

function extractPossibleDogNames(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  const matches = source.match(/\b[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý' -]{4,}\b/g) || [];
  const blacklist = new Set([
    'CENTRALE CANINE', 'LOF SELECT', 'STATGESCON', 'SETTER ANGLAIS', 'FIELD TRIAL',
    'CHAMPIONNAT', 'RESULTATS', 'DESCENDANTS', 'PRODUCTION', 'UTILISATIONS', 'PEDIGREE',
    'RECHERCHE CHIEN', 'IDENTIFIANT', 'ACCUEIL', 'CONTACT', 'MENTIONS LEGALES',
    'ARBRE AUTOUR', 'GENEALOGIE', 'LISTE PORTEE'
  ]);
  const counts = new Map();
  matches
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 5 && item.length <= 70)
    .filter((item) => !blacklist.has(item))
    .forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 100);
}

function extractPedigreeSetterId(url) {
  const raw = String(url || '');
  try {
    const parsed = new URL(raw);
    const id = parsed.searchParams.get('id') || parsed.searchParams.get('ID') || parsed.searchParams.get('IDPERE') || parsed.searchParams.get('IDMERE');
    if (id && /^\d+$/.test(id)) return id;
  } catch (error) {
    // fallback below
  }
  const match = raw.match(/[?&](?:id|ID|IDPERE|IDMERE)=(\d+)/);
  return match ? match[1] : '';
}

function buildPedigreeAroundUrls(url) {
  const id = extractPedigreeSetterId(url);
  if (!id) return [url];
  const base = 'https://pedigree.setter-anglais.fr/genealogie';
  return [
    `${base}/arbre.php?id=${id}&fn=pedigree`,
    `${base}/arbre_autour.php?id=${id}`,
    `${base}/liste_portee.php?IDPERE=${id}`,
    `${base}/liste_portee.php?IDMERE=${id}`,
  ];
}

function buildDogSheetUrls(url) {
  const clean = String(url || '').trim();
  if (!clean) return [];
  if (isLofSelectDogUrl(clean)) {
    const base = normalizeLofDogBaseUrl(clean);
    return [base, `${base}/descendance`, `${base}/utilisations`];
  }
  if (isPedigreeSetterUrl(clean)) return buildPedigreeAroundUrls(clean);
  return [clean];
}

function buildLofSelectCandidateUrls(dogName) {
  const q = encodeURIComponent(dogName || '');
  const slug = slugifyDogName(dogName);
  return [
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?search=${q}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?nom=${q}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?q=${q}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien?search=${q}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien?nom=${q}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien?q=${q}`,
    `https://www.centrale-canine.fr/lofselect/chien/${slug}`,
    `https://www.centrale-canine.fr/lofselect/chien/${slug}/descendance`,
    `https://www.centrale-canine.fr/lofselect/chien/${slug}/utilisations`,
  ];
}

function buildLofSelectIdentifierUrls(identifier, dogName = '') {
  const rawId = String(identifier || '').trim();
  const id = encodeURIComponent(rawId);
  const q = encodeURIComponent(dogName || '');
  const slug = slugifyDogName(dogName);
  const directUrls = /^\d{5,10}$/.test(rawId) && slug
    ? [
        `https://www.centrale-canine.fr/lofselect/chien/${slug}-${rawId}`,
        `https://www.centrale-canine.fr/lofselect/chien/${slug}-${rawId}/descendance`,
        `https://www.centrale-canine.fr/lofselect/chien/${slug}-${rawId}/utilisations`,
      ]
    : [];
  return [
    ...directUrls,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?identifiant=${id}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?numero_identification=${id}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?id=${id}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?q=${id}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?search=${id}`,
    `https://www.centrale-canine.fr/lofselect/recherche-chien/identifiant?search=${q}`,
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

function extractIdentifiersFromRecords(records = []) {
  const identifiers = new Set();
  records.forEach((record) => {
    const values = Object.values(record.object || {}).concat(record.row || []);
    values.forEach((value) => {
      const raw = String(value || '').trim();
      if (/^[0-9A-Z]{6,20}$/i.test(raw) && /\d/.test(raw)) identifiers.add(raw);
      (raw.match(/\b\d{6,9}\b/g) || []).forEach((match) => identifiers.add(match));
    });
  });
  return Array.from(identifiers).slice(0, 12);
}

async function resolveLofSelectDog(dogName, identifiers = []) {
  const attempts = [];
  const candidates = [];
  const urls = [...buildLofSelectCandidateUrls(dogName), ...identifiers.flatMap((id) => buildLofSelectIdentifierUrls(id, dogName))];
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url);
      attempts.push({ source: 'LOF Select', url, status: response.status, contentType: response.contentType });
      if (!response.ok) continue;
      if (isLofSelectDogUrl(response.url)) candidates.push({ source: 'LOF Select', label: dogName || response.url, url: normalizeLofDogBaseUrl(response.url) });
      extractLofDogLinks(response.body, url, dogName).forEach((link) => candidates.push({ source: 'LOF Select', ...link }));
      const text = stripHtml(response.body);
      if (isLofSelectDogUrl(url) && normalize(text).includes(normalize(dogName))) candidates.push({ source: 'LOF Select', label: `Fiche probable ${dogName}`, url: normalizeLofDogBaseUrl(url) });
    } catch (error) {
      attempts.push({ source: 'LOF Select', url, status: 'ERROR', error: error.message });
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
  return { dogName, identifiers, attempts, candidates: unique.slice(0, 20), bestCandidate: unique[0] || null };
}

async function searchSourceCandidates(dogName, source = 'all') {
  const sources = [];
  if (source === 'all' || source === 'lofselect') sources.push(...buildLofSelectCandidateUrls(dogName).map((url) => ({ source: 'LOF Select', url })));
  if (source === 'all' || source === 'pedigree') sources.push(...buildPedigreeSetterCandidateUrls(dogName).map((url) => ({ source: 'Pedigree Setter', url })));
  const attempts = [];
  const candidates = [];
  for (const item of sources) {
    try {
      const response = await fetchWithTimeout(item.url);
      attempts.push({ source: item.source, url: item.url, status: response.status, contentType: response.contentType });
      if (!response.ok) continue;
      const links = item.source === 'LOF Select' ? extractLofDogLinks(response.body, item.url, dogName) : extractCandidateDogLinks(response.body, item.url, dogName);
      links.forEach((link) => candidates.push({ source: item.source, ...link }));
      const text = stripHtml(response.body);
      if (normalize(text).includes(normalize(dogName))) candidates.push({ source: item.source, label: `Page contenant ${dogName}`, url: item.url });
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
  const urls = buildDogSheetUrls(url);
  const attempts = [];
  const texts = [];
  const links = [];
  for (const targetUrl of urls) {
    try {
      const response = await fetchWithTimeout(targetUrl);
      attempts.push({ url: targetUrl, status: response.status, contentType: response.contentType });
      if (!response.ok) continue;
      const text = stripHtml(response.body);
      texts.push(`SOURCE: ${targetUrl}\n${text}`);
      links.push(...extractLinks(response.body, targetUrl));
    } catch (error) {
      attempts.push({ url: targetUrl, status: 'ERROR', error: error.message });
    }
  }
  const fullText = texts.join('\n\n');
  return {
    ok: texts.length > 0,
    status: attempts.find((attempt) => attempt.status === 200)?.status || attempts[0]?.status || 'ERROR',
    url,
    urls,
    attempts,
    contentType: attempts.find((attempt) => attempt.contentType)?.contentType || '',
    text: fullText.slice(0, 30000),
    links: links.slice(0, 120),
    possibleNames: extractPossibleDogNames(fullText),
  };
}

function parseDescendantsText(text) {
  return String(text || '')
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((v) => normalize(v) === normalize(item)) === index)
    .slice(0, 60);
}

module.exports = {
  searchSourceCandidates,
  fetchDogSheet,
  parseDescendantsText,
  extractPossibleDogNames,
  extractIdentifiersFromRecords,
  extractPedigreeSetterId,
  resolveLofSelectDog,
  buildLofSelectCandidateUrls,
  buildLofSelectIdentifierUrls,
  buildPedigreeSetterCandidateUrls,
  buildDogSheetUrls,
};
