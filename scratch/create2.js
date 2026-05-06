const SUPABASE_URL = 'https://zxpookuhrwcohhryyxyv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cG9va3Vocndjb2hocnl5eHl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI2NTEzNCwiZXhwIjoyMDkxODQxMTM0fQ.JtYLQB7gOaCxBafZnGock1ZTuuMRlyvB2wJ1Xh-q0fQ';

async function setSuperAdmin() {
    const listRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
        method: 'GET',
        headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SERVICE_ROLE_KEY }
    });
    const listData = await listRes.json();
    const user = listData.users.find(u => u.email === 'admin@jacontadores.com');
    
    if (user) {
        console.log('ID:', user.id);
        const upsertRes = await fetch(SUPABASE_URL + '/rest/v1/profiles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                id: user.id,
                full_name: 'Administrador J&A',
                role: 'superadmin',
                email: 'admin@jacontadores.com'
            })
        });
        if (upsertRes.ok) {
            console.log('SUPERADMIN APLICADO OK!');
        } else {
            console.error(await upsertRes.text());
        }
    }
}
setSuperAdmin();
