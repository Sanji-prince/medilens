const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const DEMO_EMAIL = 'demo@medilens.app';
const DEMO_PASSWORD = 'demo123456';

router.post('/login', async (req, res) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (error) {
      console.error('[Demo Login] Failed:', error.message);
      return res.status(401).json({ error: error.message });
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: data.user,
    });
  } catch (err) {
    console.error('[Demo Login] Server error:', err.message);
    res.status(500).json({ error: 'Demo login failed' });
  }
});

module.exports = router;
