function cleanText(value) {
  return String(value || '').trim();
}

function formatDateFr(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR');
}

function sexLabel(value) {
  if (value === 'M') return 'mâle';
  if (value === 'F') return 'femelle';
  return 'chiot';
}

function toneLabel(tone) {
  const allowed = {
    professional: 'professionnel, clair et factuel',
    warm: 'chaleureux, familial et rassurant',
    premium: 'premium, sélectif et orienté sérieux d’élevage',
  };

  return allowed[tone] || allowed.professional;
}

function buildMissingInformation(context) {
  const missing = [];

  if (!context.puppy?.name) missing.push('Nom ou collier du chiot');
  if (!context.puppy?.sex) missing.push('Sexe du chiot');
  if (!context.puppy?.color) missing.push('Robe / couleur');
  if (!context.birthDate) missing.push('Date de naissance');
  if (!context.parents?.motherName) missing.push('Nom de la mère');
  if (!context.breeder?.companyName && !context.breeder?.affixName) missing.push('Nom de l’élevage ou affixe');

  return missing;
}

function buildStructuredContext(data, options = {}) {
  const puppy = data.puppy || {};
  const breeder = data.breeder || {};
  const birthDate = puppy.birth_date || puppy.litter_birth_date || data.litter?.birth_date;

  return {
    tone: options.tone || 'professional',
    showChipNumber: options.showChipNumber === true || options.showChipNumber === 'true' || options.showChipNumber === 'on',
    birthDate,
    puppy: {
      name: cleanText(puppy.name),
      sex: cleanText(puppy.sex),
      color: cleanText(puppy.color),
      status: cleanText(puppy.status),
      salePrice: puppy.sale_price || null,
      notes: cleanText(puppy.notes),
      chipNumber: cleanText(puppy.chip_number),
    },
    litter: {
      birthDate: formatDateFr(data.litter?.birth_date || puppy.litter_birth_date),
      notes: cleanText(data.litter?.notes),
      puppiesCount: data.litter?.puppies_count_total || data.litter?.puppies_count || data.litter?.nb_puppies || null,
    },
    parents: {
      motherName: cleanText(puppy.mother_name || data.parents?.mother_name),
      fatherName: cleanText(puppy.father_name || data.parents?.father_name),
      breed: cleanText(data.parents?.breed || puppy.breed),
    },
    breeder: {
      companyName: cleanText(breeder.company_name || breeder.name),
      affixName: cleanText(breeder.affix_name),
      siret: cleanText(breeder.siret),
      producerNumber: cleanText(breeder.producer_number),
      publicEmail: cleanText(breeder.website_settings?.publicEmail),
      phone: cleanText(breeder.website_settings?.phone),
    },
  };
}

function buildFallbackAd(context, providerError = '') {
  const puppyName = context.puppy.name || 'ce chiot';
  const sex = sexLabel(context.puppy.sex);
  const color = context.puppy.color || 'robe à préciser';
  const birthDate = formatDateFr(context.birthDate);
  const breederName = context.breeder.affixName || context.breeder.companyName || 'notre élevage';
  const status = context.puppy.status || 'disponible';
  const price = context.puppy.salePrice ? `${context.puppy.salePrice} €` : '';
  const mother = context.parents.motherName ? `La mère est ${context.parents.motherName}.` : '';
  const father = context.parents.fatherName ? `Le père est ${context.parents.fatherName}.` : '';
  const notes = context.puppy.notes ? `Observations de l’éleveur : ${context.puppy.notes}` : 'Le tempérament sera précisé au fil de l’évolution du chiot.';
  const chip = context.showChipNumber && context.puppy.chipNumber ? `Numéro de puce : ${context.puppy.chipNumber}.` : '';
  const contact = [context.breeder.phone, context.breeder.publicEmail].filter(Boolean).join(' · ');

  const title = `${puppyName} — ${sex} ${color}`;
  const shortAd = [
    `${puppyName}, ${sex} ${color}${birthDate ? ` né(e) le ${birthDate}` : ''}, est actuellement ${status.toLowerCase()}.`,
    mother,
    father,
    price ? `Prix indiqué : ${price}.` : '',
    `Élevé au sein de ${breederName}, avec suivi sérieux et accompagnement des adoptants.`,
    contact ? `Contact : ${contact}.` : '',
  ].filter(Boolean).join(' ');

  const longAd = [
    `Nous proposons ${puppyName}, ${sex} ${color}${birthDate ? `, né(e) le ${birthDate}` : ''}.`,
    `${mother} ${father}`.trim(),
    notes,
    `Statut actuel : ${status}.`,
    price ? `Prix de vente attendu : ${price}.` : '',
    chip,
    `${breederName} privilégie une sélection cohérente, un suivi sanitaire structuré et un accompagnement durable des familles adoptantes.`,
    contact ? `Pour tout renseignement : ${contact}.` : '',
  ].filter(Boolean).join('\n\n');

  const socialPost = [
    `${puppyName} cherche sa future famille.`,
    `${sex.charAt(0).toUpperCase() + sex.slice(1)} ${color}${birthDate ? `, né(e) le ${birthDate}` : ''}.`,
    status ? `Statut : ${status}.` : '',
    contact ? `Infos : ${contact}` : '',
  ].filter(Boolean).join('\n');

  return {
    provider: 'local-fallback',
    provider_error: providerError,
    missing_information: buildMissingInformation(context),
    title,
    short_ad: shortAd,
    long_ad: longAd,
    social_post: socialPost,
    legal_caution: 'Annonce générée automatiquement à relire par l’éleveur. Ne pas ajouter de promesse sanitaire, génétique ou comportementale non vérifiée.',
  };
}

function buildPrompt(context) {
  return [
    'Tu es l’agent IA interne d’ElevagePro spécialisé dans la rédaction d’annonces de vente de chiots.',
    'Écris pour un éleveur canin professionnel.',
    'Priorités : clarté, conformité, sobriété commerciale, confiance.',
    'N’invente aucune information absente des données.',
    'Ne promets aucun comportement futur garanti.',
    'Ne mentionne pas LOF, tests, titres, cotations ou garanties si ce n’est pas explicitement présent.',
    'Retourne uniquement un JSON valide avec les clés : missing_information, title, short_ad, long_ad, social_post, legal_caution.',
    `Ton demandé : ${toneLabel(context.tone)}.`,
    `Afficher le numéro de puce : ${context.showChipNumber ? 'oui' : 'non'}.`,
    '',
    'Données structurées :',
    JSON.stringify(context, null, 2),
  ].join('\n');
}

function parseJsonFromText(text) {
  const raw = cleanText(text);
  if (!raw) throw new Error('AI_EMPTY_RESPONSE');

  try {
    return JSON.parse(raw);
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI_INVALID_JSON');
    return JSON.parse(match[0]);
  }
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Tu retournes uniquement du JSON valide.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('OpenAI response body:', body.slice(0, 500));
    throw new Error(`OPENAI_ERROR_${response.status}`);
  }

  const payload = await response.json();
  return parseJsonFromText(payload.choices?.[0]?.message?.content || '');
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json',
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('Gemini response body:', body.slice(0, 500));
    throw new Error(`GEMINI_ERROR_${response.status}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
  return parseJsonFromText(text);
}

function normalizeAiResult(result, fallback, provider) {
  return {
    provider,
    provider_error: '',
    missing_information: Array.isArray(result?.missing_information) ? result.missing_information : fallback.missing_information,
    title: cleanText(result?.title) || fallback.title,
    short_ad: cleanText(result?.short_ad) || fallback.short_ad,
    long_ad: cleanText(result?.long_ad) || fallback.long_ad,
    social_post: cleanText(result?.social_post) || fallback.social_post,
    legal_caution: cleanText(result?.legal_caution) || fallback.legal_caution,
  };
}

async function generatePuppyAd(data, options = {}) {
  const context = buildStructuredContext(data, options);
  const prompt = buildPrompt(context);
  const provider = cleanText(process.env.AI_PROVIDER).toLowerCase();
  let providerError = '';

  try {
    if (provider === 'openai') {
      const result = await callOpenAI(prompt);
      if (result) return normalizeAiResult(result, buildFallbackAd(context), 'openai');
    }

    if (provider === 'gemini') {
      const result = await callGemini(prompt);
      if (result) return normalizeAiResult(result, buildFallbackAd(context), 'gemini');
    }

    const geminiResult = await callGemini(prompt);
    if (geminiResult) return normalizeAiResult(geminiResult, buildFallbackAd(context), 'gemini');

    const openAiResult = await callOpenAI(prompt);
    if (openAiResult) return normalizeAiResult(openAiResult, buildFallbackAd(context), 'openai');
  } catch (error) {
    providerError = error.message;
    console.error('Erreur agent IA annonce chiot:', error.message);
  }

  return buildFallbackAd(context, providerError || 'Aucun fournisseur IA disponible côté serveur');
}

module.exports = {
  generatePuppyAd,
};
