require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();
const { getSupabaseForUser } = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { assertOwnedMember } = require('../middleware/ownership');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 10 MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

function isExtractableMime(mimetype, originalname) {
  if (mimetype.startsWith('image/')) return true;
  if (mimetype === 'application/pdf') return true;
  if (mimetype === 'text/plain') return true;
  const ext = originalname.split('.').pop()?.toLowerCase();
  return ['txt', 'png', 'jpg', 'jpeg', 'pdf'].includes(ext);
}

function buildGeminiParts(file) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  if (file.mimetype === 'text/plain' || ext === 'txt') {
    return [{ text: file.buffer.toString('utf-8') }];
  }

  const mime = file.mimetype || 'application/octet-stream';
  return [
    {
      inlineData: {
        mimeType: mime,
        data: file.buffer.toString('base64'),
      },
    },
  ];
}

const DRUG_KEYWORDS = [
  'tablet', 'capsule', 'mg', 'ml', 'injection', 'syrup', 'drops', 'cream', 'ointment',
  'prescribed', 'dose', 'dosage', 'twice', 'daily', 'morning', 'evening', 'night',
];

function isLikelyDrugLine(line) {
  const lower = line.toLowerCase();
  return DRUG_KEYWORDS.some(k => lower.includes(k));
}

function buildTextFallback(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Detect document type
  let document_type = 'medical document';
  const joined = text.toLowerCase();
  if (joined.includes('prescription') || joined.includes('rx')) document_type = 'prescription';
  else if (joined.includes('lab') || joined.includes('result') || joined.includes('report')) document_type = 'lab report';
  else if (joined.includes('discharge')) document_type = 'discharge summary';
  else if (joined.includes('scan') || joined.includes('x-ray') || joined.includes('mri')) document_type = 'scan report';

  // Extract date (DD/MM/YYYY, YYYY-MM-DD, Month DD YYYY variants)
  const dateMatch = text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i);
  const date = dateMatch ? dateMatch[0] : null;

  // Key findings: lines that look like medical observations (non-empty, not pure headers)
  const key_findings = lines
    .filter(l => l.length > 15 && l.length < 200 && /[a-zA-Z]/.test(l))
    .filter(l => !/^(name|patient|doctor|date|address|phone|email|hospital|clinic):/i.test(l))
    .slice(0, 6);

  const SKIP_WORDS = new Set(['Current', 'Medications', 'Prescribed', 'Notes', 'Follow', 'Instructions', 'Refills', 'Signature', 'Doctor', 'Patient']);

  // Drug names: lines mentioning dosage keywords, or capitalised words near mg/ml
  const drugCandidates = new Set();
  lines.forEach(line => {
    if (!isLikelyDrugLine(line)) return;
    // Grab word immediately before mg/ml — most reliable signal
    const doseMatch = line.match(/([A-Z][a-zA-Z]+)\s+\d+\s*(?:mg|ml)/gi);
    if (doseMatch) {
      doseMatch.forEach(m => {
        const name = m.match(/([A-Z][a-zA-Z]+)/)?.[1];
        if (name && !SKIP_WORDS.has(name)) drugCandidates.add(name);
      });
      return;
    }
    // For lines starting with "- DrugName" pattern
    const bulletMatch = line.match(/^[-*]\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
    if (bulletMatch) {
      const name = bulletMatch[1].split(/\s+/)[0];
      if (!SKIP_WORDS.has(name)) drugCandidates.add(name);
    }
  });

  // Vitals auto-extraction from text
  const bpMatch = text.match(/\b(\d{2,3}\s*\/\s*\d{2,3})\s*(?:mmHg|mm\s*Hg)?\b/i);
  const blood_pressure = bpMatch ? bpMatch[1].replace(/\s/g, '') : null;

  const bsMatch = text.match(/\b(\d{2,4}(?:\.\d+)?)\s*(mg\/dL|mmol\/L|mg\/dl)\b/i);
  const blood_sugar = bsMatch ? `${bsMatch[1]} ${bsMatch[2]}` : null;

  const wtMatch = text.match(/\b(\d{2,3}(?:\.\d+)?)\s*(kg|lbs|lb|pounds)\b/i);
  const weight = wtMatch ? `${wtMatch[1]} ${wtMatch[2]}` : null;

  return {
    document_type,
    date,
    key_findings: key_findings.length ? key_findings : null,
    mentioned_drug_names: drugCandidates.size ? [...drugCandidates] : null,
    blood_pressure,
    blood_sugar,
    weight,
  };
}

function isQuotaError(err) {
  return (
    err?.status === 429 ||
    (typeof err?.message === 'string' && err.message.includes('429')) ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'))
  );
}

async function extractDocumentSummary(file) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  const isText = file.mimetype === 'text/plain' || ext === 'txt';

  if (!isExtractableMime(file.mimetype, file.originalname)) {
    console.warn('[Gemini] Skipping extraction for unsupported file:', file.mimetype);
    return null;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Gemini] GEMINI_API_KEY not set — using text fallback');
    return isText ? buildTextFallback(file.buffer.toString('utf-8')) : null;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const promptText =
    'Extract the following from this medical document and return ONLY valid JSON with these fields: document_type (e.g. lab report, prescription, scan), date (if visible), key_findings (short array of strings), mentioned_drug_names (array of strings), blood_pressure (string like "128/82" if found, else null), blood_sugar (string with units like "95 mg/dL" if found, else null), weight (string with units like "72 kg" if found, else null). If a field is not found, use null.';
  const fileParts = buildGeminiParts(file);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent([promptText, ...fileParts]);
      const responseText = result.response.text();
      console.log('[Gemini Raw Response]:', responseText);

      const cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Gemini] No valid JSON object parsed from response');
        break;
      }
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn(`[Gemini] 429 quota on attempt ${attempt + 1}`);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.warn('[Gemini] Quota exhausted — using text fallback');
        return isText ? buildTextFallback(file.buffer.toString('utf-8')) : null;
      }
      console.error('[Gemini] Extraction Failed with Error:', err);
      break;
    }
  }

  return isText ? buildTextFallback(file.buffer.toString('utf-8')) : null;
}

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const docId = req.params.id;
    const supabase = getSupabaseForUser(req.token);

    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('id', docId)
      .single();

    if (fetchError || !doc) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (doc.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);
      if (storageError) {
        console.error('[Storage Delete Error]:', storageError);
      }
    }

    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (deleteError) {
      console.error('[Document Delete Error]:', deleteError);
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('[Delete Document Exception]:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upload', requireAuth, upload.single('file'), multerErrorHandler, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { family_member_id } = req.body;
    if (!family_member_id) {
      return res.status(400).json({ error: 'family_member_id is required' });
    }

    const owned = await assertOwnedMember(family_member_id, req);
    if (!owned) return res.status(404).json({ error: 'Not found' });

    const supabase = getSupabaseForUser(req.token);
    const sanitized = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${req.user.id}/${family_member_id}/${Date.now()}-${sanitized}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Storage Error]:', uploadError);
      return res.status(500).json({ error: 'File upload failed' });
    }

    const { data: signedData } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);

    const extractedSummary = await extractDocumentSummary(req.file);
    console.log('[Gemini Final Extracted Result]:', extractedSummary);

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        family_member_id,
        file_url: signedData?.signedUrl || '',
        file_name: req.file.originalname,
        storage_path: storagePath,
        extracted_summary: extractedSummary,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Database Insert Error]:', dbError);
      await supabase.storage.from('documents').remove([storagePath]);
      return res.status(500).json({ error: 'Database insert failed' });
    }

    // Auto-create vitals_log entries from extracted summary
    const VITAL_TYPES = ['blood_pressure', 'blood_sugar', 'weight'];
    const autoVitals = [];
    if (extractedSummary) {
      const vitalDate = extractedSummary.date || new Date().toISOString().split('T')[0];
      for (const vtype of VITAL_TYPES) {
        const val = extractedSummary[vtype];
        if (val == null || !val.toString().trim()) continue;

        // Dedup: skip if an identical vital (type+value+date) already exists for this member
        const { data: existing } = await supabase
          .from('vitals_log')
          .select('id')
          .eq('family_member_id', family_member_id)
          .eq('type', vtype)
          .eq('value', val.toString().trim())
          .eq('date', vitalDate)
          .maybeSingle();

        if (existing) continue;

        const { data: vitalRow, error: vitalErr } = await supabase
          .from('vitals_log')
          .insert({
            family_member_id,
            type: vtype,
            value: val.toString().trim(),
            date: vitalDate,
            source: 'document',
            document_id: doc.id,
          })
          .select()
          .single();

        if (vitalErr) {
          console.warn(`[Auto Vitals] Failed to insert ${vtype} for doc ${doc.id}:`, vitalErr.message);
        } else {
          autoVitals.push(vitalRow);
        }
      }
    }

    res.status(201).json({ ...doc, auto_vitals: autoVitals });
  } catch (err) {
    console.error('[Upload Route Exception]:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;