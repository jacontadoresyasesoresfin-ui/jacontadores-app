/**
 * Script para asignar rol superadmin al usuario administrador de J&A Contadores
 * 
 * El usuario admin@jacontadores.com ya fue creado en Supabase.
 * Este script asigna el rol superadmin en la tabla profiles.
 * 
 * Ejecución: node scripts/set-superadmin.js
 */

const SUPABASE_URL = 'https://sfmlrkyhyxgwrscflhxi.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6eHBvb2t1aHJ3Y29oaHJ5eXl4diIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NDQ3Mzk2MzAsImV4cCI6MjA2MDMxNTYzMH0.84fF-ODQxMTM0fQ.JtYLQB7goAcXBafZnGock1ZTuuMRlyvB2wJ1Xh-q0fQ'

const ADMIN_EMAIL = 'admin@jacontadores.com'
const ADMIN_NAME = 'Administrador J&A'

async function setSuperadmin() {
    console.log('🔧 Asignando rol superadmin en Supabase...\n')

    // 1. Buscar el usuario por email en auth.users via admin endpoint
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'GET',
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        }
    })

    const usersData = await usersRes.json()
    const users = usersData.users || []
    const adminUser = users.find(u => u.email === ADMIN_EMAIL)

    if (!adminUser) {
        console.error('❌ Usuario no encontrado:', ADMIN_EMAIL)
        return
    }

    console.log(`✅ Usuario encontrado: ${adminUser.email} (${adminUser.id})`)

    // 2. Upsert en tabla profiles
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
            id: adminUser.id,
            full_name: ADMIN_NAME,
            role: 'superadmin',
            email: ADMIN_EMAIL,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
    })

    const profileData = await upsertRes.text()

    if (upsertRes.ok) {
        console.log('✅ Perfil superadmin creado/actualizado correctamente')
        console.log('\n' + '='.repeat(50))
        console.log('🎉 USUARIO ADMINISTRADOR LISTO')
        console.log('='.repeat(50))
        console.log(`📧 Email:    admin@jacontadores.com`)
        console.log(`🔒 Password: JaAdmin2025!`)
        console.log(`👑 Rol:      superadmin`)
        console.log('='.repeat(50))
    } else {
        console.error('❌ Error actualizando perfil:', upsertRes.status, profileData)

        console.log('\n📋 SQL alternativo para ejecutar en Supabase SQL Editor:')
        console.log(`INSERT INTO public.profiles (id, full_name, role, email)
VALUES (
  '${adminUser.id}',
  '${ADMIN_NAME}',
  'superadmin',
  '${ADMIN_EMAIL}'
)
ON CONFLICT (id) DO UPDATE 
  SET role = 'superadmin', 
      full_name = '${ADMIN_NAME}',
      updated_at = NOW();`)
    }
}

setSuperadmin().catch(console.error)
