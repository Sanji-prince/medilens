const express = require('express');
const router = express.Router();
const { getSupabaseForUser } = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { assertOwnedMember } = require('../middleware/ownership');

function toArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const { name, age, chronic_conditions, allergies } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const supabase = getSupabaseForUser(req.token);
    const { data, error } = await supabase
      .from('family_members')
      .insert({
        user_id: req.user.id,
        name: name.trim(),
        age: age != null ? parseInt(age, 10) : null,
        chronic_conditions: toArray(chronic_conditions),
        allergies: toArray(allergies),
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const memberId = req.params.id;

    const owned = await assertOwnedMember(memberId, req);
    if (!owned) return res.status(404).json({ error: 'Not found' });

    const supabase = getSupabaseForUser(req.token);

    const { data: docs } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('family_member_id', memberId);

    const storagePaths = (docs || []).map(d => d.storage_path).filter(Boolean);
    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove(storagePaths);
      if (storageError) {
        console.error('[Family Member Delete Storage Error]:', storageError);
      }
    }

    const { error: docsError } = await supabase
      .from('documents')
      .delete()
      .eq('family_member_id', memberId);
    if (docsError) {
      console.error('[Family Member Delete Documents Error]:', docsError);
    }

    const { error: vitalsError } = await supabase
      .from('vitals_log')
      .delete()
      .eq('family_member_id', memberId);
    if (vitalsError) {
      console.error('[Family Member Delete Vitals Error]:', vitalsError);
    }

    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      console.error('[Family Member Delete Error]:', error);
      return res.status(500).json({ error: 'Failed to delete family member' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('[Delete Family Member Exception]:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const memberId = req.params.id;
    const supabase = getSupabaseForUser(req.token);

    const owned = await assertOwnedMember(memberId, req);
    if (!owned) return res.status(404).json({ error: 'Not found' });

    const { data: member } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('family_member_id', memberId);

    const { data: vitals } = await supabase
      .from('vitals_log')
      .select('*')
      .eq('family_member_id', memberId);

    let signedDocItems = [];
    if (docs?.length) {
      const pathsWithIds = docs.filter(d => d.storage_path).map(d => ({ path: d.storage_path, id: d.id }));
      if (pathsWithIds.length) {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrls(pathsWithIds.map(p => p.path), 3600);
        const urlMap = {};
        if (signed) {
          signed.forEach((s, i) => { urlMap[pathsWithIds[i].id] = s.signedUrl; });
        }
        signedDocItems = docs.map(d => ({
          kind: 'document',
          id: d.id,
          occurred_at: d.created_at,
          file_name: d.file_name,
          file_url: urlMap[d.id] || d.file_url,
          extracted_summary: d.extracted_summary,
        }));
      }
    }

    const vitalItems = (vitals || []).map(v => ({
      kind: 'vital',
      id: v.id,
      occurred_at: new Date(`${v.date}T00:00:00Z`).toISOString(),
      type: v.type,
      value: v.value,
      source: v.source || 'manual',
    }));

    const items = [...signedDocItems, ...vitalItems].sort(
      (a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)
    );

    const current_medications = [
      ...new Set(
        (docs || [])
          .flatMap(d => d.extracted_summary?.mentioned_drug_names || [])
          .map(n => n.trim())
          .filter(Boolean)
      ),
    ];

    res.json({ member, items, current_medications });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
