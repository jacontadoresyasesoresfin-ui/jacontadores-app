const SUPABASE_URL = 'https://zxpookuhrwcohhryyxyv.supabase.co'
const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cG9va3Vocndjb2hocnl5eHl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI2NTEzNCwiZXhwIjoyMDkxODQxMTM0fQ.JtYLQB7gOaCxBafZnGock1ZTuuMRlyvB2wJ1Xh-q0fQ'
const ADMIN_EMAIL = 'admin@jacontadores.com'
const ADMIN_PASSWORD = 'JaAdmin2025!'

async function createAdmin() {
    console.log('Conectando a Supabase:', SUPABASE_URL.substring(0, 45) + '...')
    
    const authUrl = SUPABASE_URL + '/auth/v1/admin/users'
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SRK,
        'Authorization': 'Bearer ' + SRK
    }

    // Paso 1: Crear usuario
    const createRes = await fetch(authUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: 'Administrador J&A' }
        })
    })

    const cu = await createRes.json()
    let userId = cu.id

    if (createRes.ok) {
        console.log('✅ Usuario creado:', cu.email, '| ID:', cu.id)
    } else if (cu.msg && cu.msg.toLowerCase().includes('already')) {
        console.log('⚠️  Usuario ya existe. Buscando ID...')
    } else {
        console.error('❌ Error:', createRes.status, JSON.stringify(cu))
    }

    // Paso 2: Buscar ID si aún no lo tenemos
    if (!userId) {
        const listRes = await fetch(authUrl, { headers })
        const listData = await listRes.json()
        const found = (listData.users || []).find(u => u.email === ADMIN_EMAIL)
        if (found) {
            userId = found.id
            console.log('✅ ID encontrado:', userId)
        }
    }

    if (!userId) {
        console.error('❌ No se pudo obtener el user ID del administrador')
        return
    }

    // Paso 3: Upsert en tabla profiles
    const profileRes = await fetch(SUPABASE_URL + '/rest/v1/profiles', {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
            id: userId,
            full_name: 'Administrador J&A',
            role: 'superadmin',
            email: ADMIN_EMAIL
        })
    })

    if (profileRes.ok) {
        console.log('✅ Perfil superadmin creado/actualizado correctamente')
    } else {
        const err = await profileRes.text()
        console.error('⚠️  Error perfil:', profileRes.status, err)
        console.log('\n📋 SQL alternativo (ejecutar en Supabase SQL Editor):')
        console.log("INSERT INTO public.profiles (id, full_name, role, email)")
        console.log("VALUES ('" + userId + "', 'Administrador J&A', 'superadmin', '" + ADMIN_EMAIL + "')")
        console.log("ON CONFLICT (id) DO UPDATE SET role = 'superadmin', full_name = 'Administrador J&A', updated_at = NOW();")
    }

    console.log('')
    console.log('='.repeat(50))
    console.log('🎉 CREDENCIALES ADMINISTRADOR J&A CONTADORES')
    console.log('='.repeat(50))
    console.log('📧 Email:    admin@jacontadores.com')
    console.log('🔒 Password: JaAdmin2025!')
    console.log('🔗 Login:    http://localhost:3000/login')
    console.log('👑 Panel:    http://localhost:3000/admin')
    console.log('='.repeat(50))
}

createAdmin().catch(err => console.error('Error fatal:', err.message))
