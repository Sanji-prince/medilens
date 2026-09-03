const { createClient } = require('@supabase/supabase-js');

// Use the anon key for token verification. Verifying a user JWT only requires
// a valid project key; the service role key is reserved for DB/admin operations.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn('[Auth Middleware] Missing Authorization header');
    return res.status(401).json({ error: 'Missing token' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[Auth Middleware] Authorization header missing Bearer prefix');
    return res.status(401).json({ error: 'Invalid Authorization header format' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.warn('[Auth Middleware] Empty bearer token');
    return res.status(401).json({ error: 'Missing token' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    const msg = error.message?.toLowerCase() || '';
    const isExpired = msg.includes('expired');
    const isMalformed = msg.includes('invalid jwt') || msg.includes('malformed') || msg.includes('unable to parse');
    console.error('[Auth Middleware] Token verification failed:', error.message);
    return res.status(401).json({
      error: isExpired ? 'Token expired' : isMalformed ? 'Invalid token' : 'Invalid or expired token',
    });
  }

  if (!data?.user) {
    console.warn('[Auth Middleware] getUser returned no user');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  req.token = token;
  next();
}

module.exports = { requireAuth };
