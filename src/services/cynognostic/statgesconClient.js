const DEFAULT_BASE_URL = 'https://statgescon.onrender.com';

function cleanBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeResult(payload, url, contentType) {
  if (contentType.includes('application/json')) {
    return {
      ok: true,
      url,
      type: 'json',
      payload,
      text: JSON.stringify(payload, null, 2),
    };
  }

  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const text = stripHtml(raw);
  return {
    ok: true,
    url,
    type: 'html',
    payload: null,
    text: text.slice(0, 12000),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'ElevagePro-Cynognostic/1.0',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildCandidateUrls(baseUrl, dogName) {
  const q = encodeURIComponent(dogName || '');
  return [
    `${baseUrl}/api/search?q=${q}`,
    `${baseUrl}/api/results?dog=${q}`,
    `${baseUrl}/api/chiens?search=${q}`,
    `${baseUrl}/api/chien?nom=${q}`,
    `${baseUrl}/search?q=${q}`,
    `${baseUrl}/?q=${q}`,
  ];
}

async function searchStatgesconDog(dogName, options = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl || process.env.STATGESCON_BASE_URL);
  const candidateUrls = buildCandidateUrls(baseUrl, dogName);
  const attempts = [];

  for (const url of candidateUrls) {
    try {
      const response = await fetchWithTimeout(url);
      const contentType = response.headers.get('content-type') || '';
      const status = response.status;
      const body = contentType.includes('application/json') ? await response.json() : await response.text();
      attempts.push({ url, status, contentType });

      if (response.ok) {
        const normalized = normalizeResult(body, url, contentType);
        if (normalized.text && normalized.text.length > 20) {
          return {
            ...normalized,
            baseUrl,
            dogName,
            attempts,
          };
        }
      }
    } catch (error) {
      attempts.push({ url, status: 'ERROR', error: error.message });
    }
  }

  return {
    ok: false,
    baseUrl,
    dogName,
    attempts,
    text: '',
    message: 'Aucune route StatGescon exploitable n a repondu. Verifier le site, le nom du chien ou exposer une route API JSON/CSV.',
  };
}

module.exports = {
  searchStatgesconDog,
  buildCandidateUrls,
};
