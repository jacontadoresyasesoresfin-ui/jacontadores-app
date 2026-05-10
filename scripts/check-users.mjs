import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: users, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error('Auth Error:', authErr);
    return;
  }

  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  if (profErr) {
    console.error('Profile Error:', profErr);
    return;
  }

  console.log('--- AUTH USERS ---');
  users.users.forEach(u => console.log(`${u.id} | ${u.email}`));

  console.log('\n--- PROFILES ---');
  profiles.forEach(p => console.log(`${p.id} | ${p.role} | ${p.full_name}`));
}

check();
