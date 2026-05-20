# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server at http://localhost:3000
npm run build      # Production build (standalone output)
npm run start      # Run the standalone build
npm run lint       # Run ESLint
```

There are no automated tests in this project.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Architecture

**Next.js 16 App Router** with `output: 'standalone'` for cPanel deployment at `app.jacontadores.com`.

### Route Structure

```
app/
  login/                  — Public auth page
  auth/callback/          — Supabase OAuth callback
  dashboard/              — Protected main app (layout wraps AuthGuard + ClientProvider)
    page.tsx              — Dashboard home
    ClientContext.tsx     — Central state: profile, tenant, modules, data, client switching
    components/           — Shared dashboard UI (TopBar, TabNavigation, ClientSwitcher)
    [module]/page.tsx     — One page per feature module
  admin/                  — Superadmin panel
  firma-admin/            — Firma admin panel
  api/
    sheets-proxy/         — CORS proxy for Google Sheets CSV
    nit-verify/           — NIT/DIAN lookup via datos.gov.co RUES API
    causacion/            — Accounting journal entry engine
    admin/                — User/tenant management (service-role protected)
    ecommerce/            — Mercado Libre integration
    drive-sync/           — Google Drive integration
```

### Auth & Multi-tenancy

- **`middleware.ts`** redirects unauthenticated users to `/login`. Public paths: `/login`, `/auth`, `/auth/callback`.
- **`AuthGuard`** (`components/AuthGuard.tsx`) provides a client-side session check on top of middleware.
- **`ClientContext`** (`app/dashboard/ClientContext.tsx`) is the single source of truth for the logged-in session. It exposes: `profile` (own profile), `activeProfile` (simulated or own), `tenant`, `allProfiles`, `modules`, and `switchClient()`.
- **Roles**: `superadmin` → `firma_admin` → `admin` → `user`. Superadmin and firma_admin can simulate any client via `?clientId=` query param, which triggers `switchClient()`.
- Module access is computed by `getModules(profile, tenant)` — tenant restricts available modules, profile's `app_modules` array further filters them.
- Supabase clients: `utils/supabase/client.ts` (browser), `utils/supabase/server.ts` (RSC/Route Handlers), `utils/supabase/middleware.ts` (middleware), `utils/supabase/admin.ts` (service role for admin APIs).

### Data Flow: Google Sheets → Dashboard

Most financial data comes from a client-configured Google Sheets URL stored in `profiles.google_sheet_url`.

1. `ClientContext` calls `fetchClientData()` from `lib/data-service.ts` after loading the profile.
2. `fetchClientData()` converts the sheet URL to CSV export format, fetches it via `/api/sheets-proxy` (CORS proxy), then parses it with PapaParse.
3. The parsed rows are aggregated into `ClientData` — sales totals, top clients, portfolio estimates, and `TaxData` (Colombian tax calculations: IVA, ReteFuente, ReteICA, Renta).
4. Tax rates (UVT, SMMLV, IVA 19%, etc.) are sourced from `DEFAULT_TAX_RATES` in `lib/data-service.ts`, configurable per user via `localStorage` key `ja_tax_config`.

### Feature Modules

| Route | Description |
|---|---|
| `dashboard/causacion` | Accounting journal entry (asientos contables) with PUC classification |
| `dashboard/nit` | NIT/cédula validator with RUES registry lookup |
| `dashboard/reconciliation` | DIAN invoice reconciliation |
| `dashboard/ecommerce` | Mercado Libre sales integration |
| `dashboard/taxes` | Colombian tax calculator (DIAN compliance) |
| `dashboard/siigo` | Siigo accounting software BI |
| `dashboard/nomina` | Payroll module |
| `dashboard/ml-*` | Mercado Libre sub-modules (pagos, comisiones, devoluciones, etc.) |

### Causación Engine (`lib/causacion/`)

- **`xml-parser.ts`** — Parses UBL 2.1 XML (Colombian DIAN e-invoice format) into `FacturaUBL` objects.
- **`motor.ts`** — Applies user-configured rules (by keyword, NIT, or document type) to assign PUC account codes and ReteFuente concepts. Falls back to Claude AI if `usar_ia: true` and no rule matches.
- **`pt-adapters.ts`** — Formats asientos for export to third-party accounting tools.
- **`encryption.ts`** — Encrypts sensitive rule configs stored in Supabase.

### NIT Verification (`app/api/nit-verify/`)

Queries the public RUES dataset at `datos.gov.co` using a 3-attempt strategy (full number → strip last digit → strip last 2 digits) to handle NITs with/without the check digit. Returns entity type, mercantile registry data, CIIU activity codes, and legal representative.

## UI Conventions

All dashboard components use **inline styles** with the J&A corporate palette — not Tailwind utility classes. Each component defines:

```tsx
const JA = {
    NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#D4A843',
    TEXT: '#1C2B45', GREY: '#4B5563', BORDER: '#E5E7EB', BG: '#F8FAFC',
    // ...
}
```

Key style rules:
- `borderRadius: '2px'` — never larger values
- `boxShadow: '0 1px 3px rgba(0,0,0,0.06)'`
- Font: `Inter, sans-serif`, sizes 11–14px
- Section headers: `fontSize: '11px'`, `textTransform: 'uppercase'`, `letterSpacing: '0.05em'`
- Primary buttons: `background: JA.NAVY`, white text
- Do **not** use `px`/`py` as CSS properties — those are Tailwind shorthand, invalid in style objects

## Database

Supabase (PostgreSQL) project `sfmlrkyhyxgwrscflhxi` (`us-east-1`). Schema migrations live in `database/`. Key tables:

- `tenants` — Accounting firm clients (multi-tenant root)
- `profiles` — Users; links to `tenants` via `tenant_id`; stores `app_modules[]`, `google_sheet_url`, `ecommerce_integrations`, `siigo_url`, `drive_invoices_url`
- `invoices` / `invoice_items` — DIAN e-invoices with CUFE
- `payments`, `expenses`, `products`, `inventory_movements`
- `ml_connections` — Mercado Libre OAuth tokens per tenant

RLS is active — admin API routes use `utils/supabase/admin.ts` (service role key) to bypass RLS for cross-tenant operations.
