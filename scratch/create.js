const SUPABASE_URL = 'https://zxpookuhrwcohhryyxyv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cG9va3Vocndjb2hocnl5eHl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI2NTEzNCwiZXhwIjoyMDkxODQxMTM0fQ.JtYLQB7gOaCxBafZnGock1ZTuuMRlyvB2wJ1Xh-q0fQ';

async function setSuperAdmin() {
    console.log('Creando usuario admin@jacontadores.com...');
    
    // 1. Crear en auth.users
    const createRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
            email: 'admin@jacontadores.com',
            password: 'JaAdmin2025!',
            email_confirm: true
        })
    });
    
    let userId;
    if (createRes.status === 422) { // Already exists
        console.log('Usuario ya existía en auth. Obteniendo ID...');
        const listRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
            method: 'GET',
            headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SERVICE_ROLE_KEY }
        });
        const listData = await listRes.json();
        const user = listData.users.find(u => u.email === 'admin@jacontadores.com');
        if (user) userId = user.id;
    } else if (createRes.ok) {
        const data = await createRes.json();
        userId = data.id;
        console.log('Auth user creado:', userId);
    } else {
        console.error('Error Auth:', await createRes.text());
        return;
    }
    
    if (!userId) return console.log('Sin ID de usuario');
    
    // 2. Insert en profiles
    console.log('Insertando perfil...');
    const upsertRes = await fetch(SUPABASE_URL + '/rest/v1/profiles', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
            id: userId,
            full_name: 'Administrador J&A',
            role: 'superadmin',
            email: 'admin@jacontadores.com',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
    });
    
    if (upsertRes.ok) {
        console.log('Perfil SUPERADMIN creado/actualizado!');
    } else {
        console.error('Error Perfil:', await upsertRes.text());
    }
}
setSuperAdmin();
