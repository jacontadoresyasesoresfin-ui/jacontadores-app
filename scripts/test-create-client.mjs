import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function test() {
  console.log('--- Test: Crear cliente con nuevo flujo ---');
  const testEmail = `testclient_${Date.now()}@test.com`;
  
  // Step 1: Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'TestPass123!',
    email_confirm: true,
  });
  if (authError) { console.error('❌ Error Auth:', authError.message); return; }
  console.log('✅ Usuario Auth creado:', authData.user.id);

  // Step 2: Wait for trigger
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Step 3: Update (not upsert)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      company_name: 'Empresa Test ' + Date.now(),
      role: 'user',
    })
    .eq('id', authData.user.id);
    
  if (profileError) { 
    console.error('❌ Error perfil:', profileError.message);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return;
  }
  console.log('✅ Perfil actualizado correctamente');

  // Step 4: Cleanup
  await supabase.from('profiles').delete().eq('id', authData.user.id);
  const { error: delErr } = await supabase.auth.admin.deleteUser(authData.user.id);
  if (delErr) console.error('❌ Error al eliminar:', delErr.message);
  else console.log('✅ Usuario eliminado correctamente');
  
  console.log('\n✅ FLUJO COMPLETO FUNCIONA — Listo para desplegar');
}

test();
