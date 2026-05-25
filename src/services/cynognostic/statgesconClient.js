const DEFAULT_BASE_URL = 'https://statgescon.onrender.com';

const STATGESCON_CSV_FILES = [
  'statistiques_par_chien.csv',
  'statistiques_par_affixe.csv',
  'statistiques_par_discipline.csv',
  'statistiques_chien_discipline.csv',
];

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

function detectDelimiter(line) {
  const candidates = [';', ',', '\t', '|'];
  return candidates
    .map((delimiter) => ({ delimiter, count: String(line || '').split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  return lines.map((line) => parseCsvLine(line, delimiter));
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
  if (!wanted) return rows.slice(0, 80);
  return rows.filter((row) => normalize(row.join(' | ')).includes(wanted)).slice(0, 120);
}

function rowsToText(rows, sourceName = '') {
  return rows
    .map((row) => `${sourceName ? `[${sourceName}] ` : ''}${row.join(' | ')}`)
    .join('\n');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'text/csv,text/plain,text/html,application/json;q=0.9,*/*;q=0.8',
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
    ...STATGESCON_CSV_FILES.map((file) => `${baseUrl}/${file}`),
    `${baseUrl}/`,
    `${baseUrl}/?q=${q}`,
    `${baseUrl}/?search=${q}`,
    `${baseUrl}/?terme=${q}`,
    `${baseUrl}/search?q=${q}`,
  ];
}

async function searchCsvFiles(baseUrl, query, attempts) {
  const allMatches = [];
  let totalRowsDetected = 0;
  let firstOkUrl = null;

  for (const file of STATGESCON_CSV_FILES) {
    const url = `${baseUrl}/${file}`;
    try {
      const response = await fetchWithTimeout(url);
      const contentType = response.headers.get('content-type') || '';
      const status = response.status;
      const body = await response.text();
      attempts.push({ url, status, contentType });

      if (!response.ok) continue;
      if (!firstOkUrl) firstOkUrl = url;

      const rows = parseCsv(body);
      totalRowsDetected += rows.length;
      const matchedRows = filterRows(rows, query);
      matchedRows.forEach((row) => allMatches.push({ source: file, row }));
    } catch (error) {
      attempts.push({ url, status: 'ERROR', error: error.message });
    }
  }

  if (allMatches.length) {
    return {
      ok: true,
      url: firstOkUrl,
      type: 'csv',
      totalRowsDetected,
      matchedRows: allMatches.map((item) => [item.source, ...item.row]),
      text: allMatches.map((item) => rowsToText([item.row], item.source)).join('\n'),
      rawPreview: '',
    };
  }

  return { ok: false, totalRowsDetected, matchedRows: [], text: '', rawPreview: '', url: firstOkUrl, type: 'csv' };
}

async function searchHtmlFallback(baseUrl, query, attempts) {
  const urls = [`${baseUrl}/`, `${baseUrl}/?q=${encodeURIComponent(query || '')}`];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url);
      const contentType = response.headers.get('content-type') || '';
      const status = response.status;
      const body = await response.text();
      attempts.push({ url, status, contentType });

      if (!response.ok) continue;

      const rows = extractRowsFromHtml(body);
      const matchedRows = filterRows(rows, query);
      const pageText = stripHtml(body);
      const fallbackMatches = pageText
        .split(/(?<=\.)\s+|\n+/)
        .filter((line) => normalize(line).includes(normalize(query)))
        .slice(0, 80);

      return {
        ok: matchedRows.length > 0 || fallbackMatches.length > 0,
        url,
        type: rows.length ? 'html-table' : 'html-text',
        totalRowsDetected: rows.length,
        matchedRows,
        text: matchedRows.length ? rowsToText(matchedRows) : fallbackMatches.join('\n'),
        rawPreview: pageText.slice(0, 12000),
      };
    } catch (error) {
      attempts.push({ url, status: 'ERROR', error: error.message });
    }
  }

  return { ok: false, totalRowsDetected: 0, matchedRows: [], text: '', rawPreview: '' };
}

async function searchStatgesconTable(query, options = {}) {
  const baseUrl = cleanBaseUrl(options.baseUrl || process.env.STATGESCON_BASE_URL);
  const attempts = [];

  const csvResult = await searchCsvFiles(baseUrl, query, attempts);
  if (csvResult.ok) {
    return {
      ...csvResult,
      ok: true,
      baseUrl,
      query,
      attempts,
    };
  }

  const htmlResult = await searchHtmlFallback(baseUrl, query, attempts);

  return {
    ...htmlResult,
    ok: htmlResult.ok || csvResult.totalRowsDetected > 0,
    baseUrl,
    query,
    attempts,
    totalRowsDetected: csvResult.totalRowsDetected + (htmlResult.totalRowsDetected || 0),
    matchedRows: htmlResult.matchedRows || [],
    text: htmlResult.text || '',
    rawPreview: htmlResult.rawPreview || '',
    message: htmlResult.ok
      ? undefined
      : 'Les CSV StatGescon ont ete recuperes mais aucune ligne ne correspond au terme recherche. Essaie un terme plus court : affixe, mot cle, conducteur ou nom partiel.',
  };
}

module.exports = {
  searchStatgesconTable,
  searchStatgesconDog: searchStatgesconTable,
  buildCandidateUrls,
};
