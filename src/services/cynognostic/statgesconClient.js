const DEFAULT_BASE_URL = 'https://statgescon.onrender.com';

function cleanBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRowsFromHtml(html) {
  const rows = [];
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const matches = String(html || '').match(rowRegex) || [];

  matches.forEach((rowHtml) => {
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const cell = stripHtml(cellMatch[1]);
      if (cell) cells.push(cell);
    }
    if (cells.length) rows.push(cells);
  });

  return rows;
}

function filterRows(rows, query) {
  const wanted = normalize(query);
  if (!wanted) return rows.slice(0, 50);
  return rows.filter((row) => normalize(row.join(' | ')).includes(wanted)).slice(0, 80);
}

function rowsToText(rows) {
  return rows.map((row) => row.join(' | ')).join('\n');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'user-agent': 'ElevagePro-Cynognostic/1.0',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildCandidateUrls(baseUrl, query) {
  const q = encodeURIComponent(query || '');
  return [
    `${baseUrl}/`,
    `${baseUrl}/?q=${q}`,
    `${baseUrl}/?search=${q}`,
    `${baseUrl}/?terme=${q}`,
    `${baseUrl}/search?q=${q}`,
  ];
}

async function searchStatgesconTable(query, options = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl || process.env.STATGESCON_BASE_URL);
  const candidateUrls = buildCandidateUrls(baseUrl, query);
  const attempts = [];

  for (const url of candidateUrls) {
    try {
      const response = await fetchWithTimeout(url);
      const contentType = response.headers.get('content-type') || '';
      const status = response.status;
      const body = contentType.includes('application/json') ? JSON.stringify(await response.json()) : await response.text();
      attempts.push({ url, status, contentType });

      if (!response.ok) continue;

      const rows = extractRowsFromHtml(body);
      const matchedRows = filterRows(rows, query);
      const pageText = stripHtml(body);
      const fallbackMatches = pageText
        .split(/(?<=\.)\s+|\n+/)
        .filter((line) => normalize(line).includes(normalize(query)))
        .slice(0, 80);

      if (matchedRows.length || fallbackMatches.length || pageText.length > 50) {
        return {
          ok: true,
          baseUrl,
          query,
          url,
          type: rows.length ? 'html-table' : 'html-text',
          attempts,
          totalRowsDetected: rows.length,
          matchedRows,
          text: matchedRows.length ? rowsToText(matchedRows) : fallbackMatches.join('\n'),
          rawPreview: pageText.slice(0, 12000),
        };
      }
    } catch (error) {
      attempts.push({ url, status: 'ERROR', error: error.message });
    }
  }

  return {
    ok: false,
    baseUrl,
    query,
    attempts,
    totalRowsDetected: 0,
    matchedRows: [],
    text: '',
    rawPreview: '',
    message: 'Aucun tableau StatGescon exploitable n a ete recupere. Si le site charge ses donnees par JavaScript, il faudra brancher la route JSON exacte ou exporter le CSV.'
  };
}

module.exports = {
  searchStatgesconTable,
  searchStatgesconDog: searchStatgesconTable,
  buildCandidateUrls,
};
