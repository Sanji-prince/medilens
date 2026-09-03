-- ============================================================
-- MediLens — Demo Seed Data
-- Run this in the Supabase SQL Editor after creating/confirming
-- the demo user (demo@medilens.app).
-- ============================================================

-- Replace this UUID if you recreate the demo user.
-- Current demo user id from Supabase Auth:
declare
  demo_user_id uuid := 'ec40b949-6c27-4d8c-877f-68660bd2095f';
  member1_id uuid;
  member2_id uuid;
begin

  -- 1. Family members
  insert into public.family_members (user_id, name, age, chronic_conditions, allergies)
  values
    (demo_user_id, 'Asha Kapoor', 62, array['Type 2 diabetes', 'Hypertension'], array['Penicillin'])
    returning id into member1_id;

  insert into public.family_members (user_id, name, age, chronic_conditions, allergies)
  values
    (demo_user_id, 'Rohan Kapoor', 8, array[], array['Peanuts', 'Dust mites'])
    returning id into member2_id;

  -- 2. Vitals
  insert into public.vitals_log (family_member_id, type, value, date)
  values
    (member1_id, 'blood_pressure', '132/84', current_date - interval '2 days'),
    (member1_id, 'blood_sugar', '142 mg/dL', current_date - interval '1 day'),
    (member1_id, 'weight', '68 kg', current_date),
    (member2_id, 'weight', '26 kg', current_date - interval '5 days');

  -- 3. Documents (placeholder rows — upload real files via the UI to replace)
  insert into public.documents (family_member_id, file_url, file_name, storage_path)
  values
    (member1_id, '', 'Asha_Blood_Report_Placeholder.pdf', null),
    (member2_id, '', 'Rohan_Vaccination_Card_Placeholder.pdf', null);

end;
