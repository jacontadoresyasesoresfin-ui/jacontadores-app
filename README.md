# J&A Contadores - Asesores · Portal de Gestión

> **Portal de gestión financiera y contable** para los clientes de J&A Contadores - Asesores.  
> Firma líder en Tunja, Boyacá — con cobertura nacional en Colombia.  
> Liderado por **María Alexandra Pérez Lagos** — Contadora Pública | Revisora Fiscal

---

## 🏢 Sobre el Proyecto

Este portal permite a los clientes de **J&A Contadores - Asesores** gestionar:

- 📊 **Dashboard financiero** — métricas en tiempo real
- 📄 **Facturas & Pagos** — seguimiento de cartera
- 📦 **Inventario** — control de movimientos
- 🛒 **Ecommerce** — integración con Mercado Libre
- 📈 **Analytics** — análisis financiero avanzado
- 🏛️ **Impuestos** — cumplimiento DIAN

---

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Estilos | TailwindCSS v4 + Shadcn UI |
| Base de Datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Despliegue | cPanel (app.jacontadores.com) |

---

## ⚙️ Configuración Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/ja-contadores-portal.git
cd ja-contadores-portal
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea `.env.local` con:
```env
NEXT_PUBLIC_SUPABASE_URL=https://sfmlrkyhyxgwrscflhxi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
```

Visita `http://localhost:3000`

---

## 🌐 Despliegue en cPanel

```bash
npm run build
git push origin main
```

El archivo `.cpanel.yml` automatiza el despliegue en `app.jacontadores.com`.

---

## 📊 Base de Datos (Supabase)

**Proyecto:** `ja-contadores-bi`  
**ID:** `sfmlrkyhyxgwrscflhxi`  
**Región:** `us-east-1`

### Tablas principales:
- `tenants` — Clientes de J&A
- `profiles` — Usuarios del sistema
- `customers` — Clientes de cada tenant
- `invoices` + `invoice_items` — Facturación
- `payments` — Registros de pagos
- `expenses` — Gastos y egresos
- `products` — Catálogo de productos
- `inventory_movements` — Movimientos de inventario
- `ml_connections` — Integración Mercado Libre

---

## 📞 Contacto

**J&A Contadores - Asesores**  
📍 Tunja, Boyacá — Cobertura Nacional Colombia  
📱 +57 313 8385201  
📧 info@jacontadores.com  
🌐 [jacontadores.com](https://jacontadores.com)

---

*© 2025 J&A Contadores - Asesores. Todos los derechos reservados.*
