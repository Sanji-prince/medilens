const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSupabaseForUser } = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(prefix, query) {
  return `${prefix}:${query.toLowerCase().trim()}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value, ttlMs = CACHE_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function fetchRxNorm(term) {
  const key = cacheKey('rxnorm', term);
  const cached = getCached(key);
  if (cached) return cached;

  const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=5`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`RxNorm HTTP ${response.status}`);

  const data = await response.json();
  const candidates = data?.approximateGroup?.candidate || [];
  const name = candidates.find(c => c.name)?.name || null;

  if (name) setCached(key, name);
  return name;
}

function buildOpenFDASearchUrl(field, value) {
  const apiKeyParam = process.env.OPENFDA_API_KEY
    ? `&api_key=${encodeURIComponent(process.env.OPENFDA_API_KEY)}`
    : '';
  return `https://api.fda.gov/drug/label.json?search=openfda.${field}:"${encodeURIComponent(value)}"&limit=5${apiKeyParam}`;
}

async function fetchOpenFDA(genericName, brandName) {
  const key = cacheKey('openfda', `${genericName}|${brandName || ''}`);
  const cached = getCached(key);
  if (cached) return cached;

  let response = await fetch(buildOpenFDASearchUrl('generic_name', genericName));
  let data = response.ok ? await response.json() : null;

  if ((!data?.results?.length) && brandName) {
    response = await fetch(buildOpenFDASearchUrl('brand_name', brandName));
    data = response.ok ? await response.json() : null;
  }

  const results = data?.results || [];
  if (results.length) setCached(key, results);
  return results;
}

function scoreLabel(label) {
  let score = 0;
  if (label.warnings?.length) score += 3;
  if (label.contraindications?.length) score += 3;
  if (label.dosage_and_administration?.length) score += 2;
  if (label.indications_and_usage?.length) score += 1;
  if (label.adverse_reactions?.length) score += 1;
  return score;
}

function pickBestLabel(results) {
  return results.reduce((best, current) =>
    scoreLabel(current) > scoreLabel(best) ? current : best
  );
}

function cleanGeminiJSON(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : cleaned;
}

function firstText(field) {
  if (!field) return null;
  const val = Array.isArray(field) ? field[0] : field;
  return typeof val === 'string' ? val.trim() : null;
}

function truncate(str, max = 1000) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function buildFallbackSummary(label) {
  const bullets = [];

  const indications = firstText(label.indications_and_usage);
  if (indications) bullets.push(truncate(indications, 200));

  const dosage = firstText(label.dosage_and_administration);
  if (dosage) bullets.push('Dosage: ' + truncate(dosage, 180));

  const warnings = firstText(label.warnings) || firstText(label.warnings_and_cautions);
  if (warnings) bullets.push('Warning: ' + truncate(warnings, 200));

  const adverse = firstText(label.adverse_reactions);
  if (adverse) bullets.push('Side effects may include: ' + truncate(adverse, 180));

  const contraindications = firstText(label.contraindications);
  if (contraindications) bullets.push('Do not use if: ' + truncate(contraindications, 180));

  const brandName = label.openfda?.brand_name?.[0] || '';
  const genericName = label.openfda?.generic_name?.[0] || '';
  const name = brandName || genericName || 'This medication';

  const longParts = [
    indications ? `${name} is used for: ${truncate(indications, 300)}.` : null,
    warnings ? `Key warnings: ${truncate(warnings, 300)}.` : null,
    dosage ? `Dosage guidance: ${truncate(dosage, 200)}.` : null,
  ].filter(Boolean);

  const long_summary = longParts.length
    ? longParts.join(' ')
    : `See the full FDA label for details on ${name}.`;

  return {
    short_summary: bullets.length ? bullets : [`See full FDA label for ${name}.`],
    long_summary,
  };
}

function buildFallbackSafety(label, patientContext) {
  const parts = [
    'Automated personalized safety analysis is currently unavailable, so this precautionary CAUTION assessment requires review by a physician or pharmacist.',
  ];
  const currentMedications = patientContext.current_medications || [];
  const conditions = patientContext.chronic_conditions || [];
  const allergies = patientContext.allergies || [];

  if (patientContext.isEmpty) {
    parts.push('The patient profile is incomplete, which limits this assessment.');
  }
  if (currentMedications.length) {
    parts.push(`Current medications on file: ${currentMedications.join(', ')}.`);
  } else {
    parts.push('No other current medications are on file.');
  }
  if (conditions.length) {
    parts.push(`Conditions requiring review: ${conditions.join(', ')}.`);
  }
  if (allergies.length) {
    parts.push(`Allergies requiring review: ${allergies.join(', ')}.`);
  }

  const contraindications = firstText(label.contraindications);
  const warnings = firstText(label.warnings) || firstText(label.warnings_and_cautions);
  const interactions = firstText(label.drug_interactions);

  if (contraindications) {
    parts.push(`FDA label contraindications to review: ${truncate(contraindications, 300)}.`);
  }
  if (warnings) {
    parts.push(`FDA label warnings to review: ${truncate(warnings, 300)}.`);
  }
  if (interactions) {
    parts.push('The available FDA label excerpt includes drug-interaction information that should be reviewed against the medication list.');
  } else {
    parts.push('The available FDA label excerpt does not provide drug-interaction details.');
  }

  return {
    verdict: 'CAUTION',
    reasoning: parts.join(' '),
    interaction_flagged: false,
  };
}

function truncateLabel(label) {
  const FIELDS = [
    'indications_and_usage', 'dosage_and_administration', 'warnings',
    'warnings_and_cautions', 'contraindications', 'adverse_reactions',
    'drug_interactions', 'description',
  ];
  const slim = { openfda: label.openfda };
  for (const f of FIELDS) {
    if (!label[f]) continue;
    const val = Array.isArray(label[f]) ? label[f][0] : label[f];
    if (typeof val === 'string') slim[f] = truncate(val, 1000);
  }
  return slim;
}

async function summarizeWithGemini(label) {
  const fallback = buildFallbackSummary(label);

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  const slimLabel = truncateLabel(label);

  const prompt =
    'You are a medical information assistant. Given the following FDA drug label excerpt, produce ONLY valid JSON (no markdown fences) with exactly two keys:\n' +
    '- "short_summary": array of 3-6 concise bullet point strings covering purpose, key warnings, and typical dosage.\n' +
    '- "long_summary": one plain-text paragraph summarising the medication for a layperson.\n\n' +
    `Drug label:\n${JSON.stringify(slimLabel)}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('[Gemini Summarize Raw]:', text.slice(0, 300));

    const jsonText = cleanGeminiJSON(text);
    const parsed = JSON.parse(jsonText);

    const short_summary = Array.isArray(parsed?.short_summary) && parsed.short_summary.length
      ? parsed.short_summary
      : fallback.short_summary;
    const long_summary = typeof parsed?.long_summary === 'string' && parsed.long_summary.trim()
      ? parsed.long_summary.trim()
      : fallback.long_summary;

    return { short_summary, long_summary };
  } catch (err) {
    console.error('[Gemini Summarize] Error — using FDA fallback:', err.message || err);
    return fallback;
  }
}

function validateVerdict(verdict) {
  const normalized = String(verdict || '').toUpperCase().trim();
  if (['SAFE', 'CAUTION', 'UNSAFE'].includes(normalized)) return normalized;
  return 'CAUTION';
}

function detectInteractionFlag(reasoning) {
  const lower = (reasoning || '').toLowerCase();
  return (
    lower.includes('interaction') ||
    lower.includes('interacts with') ||
    lower.includes('concurrent use') ||
    lower.includes('concomitant') ||
    lower.includes('co-administration') ||
    lower.includes('combined with') ||
    lower.includes('when taken with')
  );
}

async function safetyCheckWithGemini(label, patientContext) {
  const fallback = buildFallbackSafety(label, patientContext);

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  const meds = patientContext.current_medications || [];
  const medsLine = meds.length
    ? meds.join(', ')
    : 'no other current medications on file';

  const emptyNote = patientContext.isEmpty
    ? 'The patient profile is currently empty/incomplete. Evaluate general safety only and explicitly note this in your reasoning.'
    : '';

  const slimLabel = truncateLabel(label);

  const prompt =
    'You are a medical safety assistant. Respond with ONLY valid JSON (no markdown) containing:\n' +
    '- "verdict": one of "SAFE", "CAUTION", or "UNSAFE"\n' +
    '- "reasoning": a paragraph explaining the verdict\n\n' +
    `${emptyNote}\n\n` +
    `Given this patient's current medications: ${medsLine}.\n` +
    `Their conditions: ${(patientContext.chronic_conditions || []).join(', ') || 'none documented'}.\n` +
    `Their allergies: ${(patientContext.allergies || []).join(', ') || 'none documented'}.\n` +
    `And this new drug's label data:\n${JSON.stringify(slimLabel)}\n\n` +
    'Determine the safety verdict (SAFE, CAUTION, or UNSAFE). ' +
    'If there is a known interaction risk between the new drug and any current medication, explicitly mention it in the reasoning. ' +
    'Ground all reasoning only in the data provided — do not invent interactions not supported by the label data or general pharmacology.';

  let timeoutId;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Gemini safety request timed out')), 15000);
      }),
    ]);
    const text = result.response.text();
    const jsonText = cleanGeminiJSON(text);
    const parsed = JSON.parse(jsonText);

    const verdict = validateVerdict(parsed?.verdict);
    const baseReasoning = typeof parsed?.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : 'No reasoning provided.';
    const reasoning = `${baseReasoning} This is not medical advice. Consult a physician.`;
    const interaction_flagged = detectInteractionFlag(baseReasoning);

    return { verdict, reasoning, interaction_flagged };
  } catch (err) {
    console.error('[Gemini Safety] Error — using FDA fallback:', err.message || err);
    return fallback;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildPatientContext(supabase, memberId) {
  const { data: member, error } = await supabase
    .from('family_members')
    .select('id, name, chronic_conditions, allergies')
    .eq('id', memberId)
    .single();

  if (error || !member) return null;

  const { data: docs } = await supabase
    .from('documents')
    .select('extracted_summary')
    .eq('family_member_id', memberId);

  const documentSummaries = (docs || []).map(d => d.extracted_summary).filter(Boolean);

  const current_medications = [
    ...new Set(
      (docs || [])
        .flatMap(d => d.extracted_summary?.mentioned_drug_names || [])
        .map(n => n.trim())
        .filter(Boolean)
    ),
  ];

  return {
    name: member.name,
    chronic_conditions: member.chronic_conditions || [],
    allergies: member.allergies || [],
    current_medications,
    document_summaries: documentSummaries,
    isEmpty:
      !(member.chronic_conditions?.length) &&
      !(member.allergies?.length) &&
      !current_medications.length &&
      !documentSummaries.length,
  };
}

function toDrugResult(genericName, query, label) {
  return {
    genericName,
    brandName: label.openfda?.brand_name?.[0] || query,
    substanceName: label.openfda?.substance_name?.[0] || genericName,
    label,
  };
}

async function lookupDrug(query) {
  const genericName = await fetchRxNorm(query);
  if (!genericName) {
    return { status: 'NOT_FOUND', message: 'No matching medication label found.' };
  }

  const labels = await fetchOpenFDA(genericName, query);
  if (!labels.length) {
    return { status: 'NOT_FOUND', message: 'No matching medication label found.' };
  }

  const label = pickBestLabel(labels);
  const summary = await summarizeWithGemini(label);

  return {
    status: 'OK',
    drug: toDrugResult(genericName, query, label),
    summary,
  };
}

router.use(requireAuth);

router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query?.trim()) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const result = await lookupDrug(query.trim());
    res.status(result.status === 'NOT_FOUND' ? 200 : 200).json(result);
  } catch (err) {
    console.error('[Medicine Search] Error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/search-filtered', async (req, res) => {
  try {
    const { query, family_member_id } = req.query;
    if (!query?.trim()) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    if (!family_member_id) {
      return res.status(400).json({ error: 'family_member_id is required' });
    }

    const lookup = await lookupDrug(query.trim());
    if (lookup.status === 'NOT_FOUND') {
      return res.status(200).json(lookup);
    }

    const supabase = getSupabaseForUser(req.token);
    const patientContext = await buildPatientContext(supabase, family_member_id);
    if (!patientContext) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    const safety = await safetyCheckWithGemini(lookup.drug.label, patientContext);

    res.json({
      status: 'OK',
      drug: lookup.drug,
      summary: lookup.summary,
      safety,
    });
  } catch (err) {
    console.error('[Medicine Search Filtered] Error:', err);
    res.status(500).json({ error: 'Safety check failed' });
  }
});

module.exports = router;
