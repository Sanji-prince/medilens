const { getSupabaseForUser } = require('../supabaseClient');

async function assertOwnedMember(memberId, req) {
  const supabase = getSupabaseForUser(req.token);
  const { data, error } = await supabase
    .from('family_members')
    .select('id')
    .eq('id', memberId)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

module.exports = { assertOwnedMember };
