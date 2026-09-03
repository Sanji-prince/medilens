const express = require('express');
const router = express.Router();
const { getSupabaseForUser } = require('../supabaseClient');
const { requireAuth } = require('../middleware/auth');
const { assertOwnedMember } = require('../middleware/ownership');

const VALID_TYPES = ['blood_pressure', 'blood_sugar', 'weight'];

router.post('/', requireAuth, async (req, res) => {
  try {
    const { family_member_id, type, value, date } = req.body;

    if (!family_member_id) {
      return res.status(400).json({ error: 'family_member_id is required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (!value || !value.toString().trim()) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const owned = await assertOwnedMember(family_member_id, req);
    if (!owned) return res.status(404).json({ error: 'Not found' });

    const supabase = getSupabaseForUser(req.token);
    const { data, error } = await supabase
      .from('vitals_log')
      .insert({
        family_member_id,
        type,
        value: value.toString().trim(),
        date: date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const vitalId = req.params.id;
    const { value, date } = req.body;

    if (value == null && date == null) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    if (value != null && !value.toString().trim()) {
      return res.status(400).json({ error: 'Value cannot be empty' });
    }

    const supabase = getSupabaseForUser(req.token);
    const { data: vital, error: fetchError } = await supabase
      .from('vitals_log')
      .select('id, family_member_id')
      .eq('id', vitalId)
      .single();

    if (fetchError || !vital) {
      return res.status(404).json({ error: 'Not found' });
    }

    const owned = await assertOwnedMember(vital.family_member_id, req);
    if (!owned) return res.status(404).json({ error: 'Not found' });

    const updates = {};
    if (value != null) updates.value = value.toString().trim();
    if (date != null) updates.date = date;

    const { data, error } = await supabase
      .from('vitals_log')
      .update(updates)
      .eq('id', vitalId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const vitalId = req.params.id;

    const supabase = getSupabaseForUser(req.token);
    const { data: vital, error: fetchError } = await supabase
      .from('vitals_log')
      .select('id, family_member_id')
      .eq('id', vitalId)
      .single();

    if (fetchError || !vital) {
      return res.status(404).json({ error: 'Not found' });
    }

    const owned = await assertOwnedMember(vital.family_member_id, req);
    if (!owned) return res.status(404).json({ error: 'Not found' });

    const { error } = await supabase
      .from('vitals_log')
      .delete()
      .eq('id', vitalId);

    if (error) {
      console.error('[Vitals Delete Error]:', error);
      return res.status(500).json({ error: 'Failed to delete vital' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('[Vitals Delete Exception]:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
