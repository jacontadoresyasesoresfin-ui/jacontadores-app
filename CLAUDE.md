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
  login/                    — Public auth page
  auth/callback/            — Supabase OAuth callback
  dashboard/                — Protected main app (layout wraps AuthGuard + ClientProvider)
    page.tsx                — Dashboard home (metrics, DIAN deadlines, KPIs)
    ClientContext.tsx       — Central state: profile, tenant, modules, data, client switching
    components/             — Shared dashboard UI (TopBar, TabNavigation, ClientSwitcher)
    causacion/              — Accounting journal entry (asientos contables)
    causacion/automatizacion/ — Automated causacion workflow
    conciliaciones/         — Bank reconciliation (3-source matching)
    exogenas/               — DIAN tax filing (Formatos 1001–1010)
    siigo/                  — Siigo accounting BI
    nit/                    — NIT/cédula validator
    taxes/                  — Colombian tax calculator
    reconciliation/         — Invoice reconciliation
    ecommerce/              — Mercado Libre integration
    ml-*/                   — Mercado Libre sub-modules (pagos, comisiones, devoluciones, etc.)
    nomina/, sales/, inventory/, portfolio/, analytics/, reports/, team/
  admin/                    — Superadmin panel
  firma-admin/              — Firma admin panel
  api/
    sheets-proxy/           — CORS proxy for Google Sheets CSV
    nit-verify/             — NIT/DIAN lookup via datos.gov.co RUES API
    causacion/              — Journal entry engine + Drive sync + PDF extraction
    conciliaciones/         — Bank reconciliation processing and export
    exogenas/               — DIAN format generation (streaming NDJSON) + rules management
    admin/                  — User/tenant management (service-role protected)
    ecommerce/              — Mercado Libre integration
    drive-sync/             — Google Drive integration
    firma/                  — Firma signatures management
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
| `dashboard/conciliaciones` | Bank reconciliation: 4-stage matching of bank statements + DIAN invoices + Siigo |
| `dashboard/exogenas` | DIAN annual tax filing: Formatos 1001, 1005, 1006, 1007, 1010 (Res. 000227/2025) |
| `dashboard/nit` | NIT/cédula validator with RUES registry lookup |
| `dashboard/reconciliation` | DIAN invoice reconciliation |
| `dashboard/ecommerce` | Mercado Libre sales integration |
| `dashboard/taxes` | Colombian tax calculator (DIAN compliance) |
| `dashboard/siigo` | Siigo accounting software BI |
| `dashboard/nomina` | Payroll module |
| `dashboard/ml-*` | Mercado Libre sub-modules (pagos, comisiones, devoluciones, etc.) |

### Causación Engine (`lib/causacion/`)

- **`xml-parser.ts`** — Parses UBL 2.1 XML (Colombian DIAN e-invoice format) into `FacturaUBL` objects.
- **`motor.ts`** — 5-level cascade to assign PUC account codes and ReteFuente concepts:
  1. NIT matching → predefined account
  2. Keyword matching on first item description
  3. Document type (91/92 credit/debit notes)
  4. Claude AI suggestion (if `usar_ia: true` and no rule matched)
  5. Config defaults (account 519595, concept "servicios")
- **`pt-adapters.ts`** — Formats asientos for export to third-party accounting tools.
- **`encryption.ts`** — Encrypts sensitive rule configs stored in Supabase.

Output `AsientoContable` is a balanced journal entry: debit lines (expense account + IVA descontable 240810) and credit lines (vendor payable 220501+NIT, ReteFuente 236540–236518, ReteIVA 236701, ReteICA 236801). Vendor credit auto-adjusts to ensure debits = credits.

### Conciliaciones Engine (`lib/conciliaciones/`)

Matches three data sources: bank statements, DIAN XML invoices, and Siigo ledger exports.

**Parsers** (`lib/conciliaciones/parsers/`):
- `banco.ts` — Auto-detects bank format (Bancolombia, Davivienda, BBVA, Bogotá) from CSV headers.
- `banco-pdf.ts` — PDF table extraction with cell detection.
- `siigo.ts` — Siigo CSV/Excel export parser.
- `dian-xml.ts` — DIAN XML/ZIP invoice parser.

**4-Stage Matching** (`lib/conciliaciones/conciliador.ts`):
1. **Exact** — Amount + date within tolerance window.
2. **Fuzzy** — Weighted score: 50% amount + 30% date proximity + 20% text similarity (Levenshtein).
3. **Grouped** — Many-to-one / one-to-many subset search for split/consolidated payments.
4. **Siigo cross-match** — Siigo movements matched against bank movements.

Tax summaries are computed after matching: `lib/conciliaciones/tax/iva.ts`, `retefuente.ts`, `ica.ts` — rates per Decreto 1625/2016 and Comunicado DIAN 070/2026.

API: `POST /api/conciliaciones/procesar` runs the full pipeline. `GET /api/conciliaciones/exportar` returns the multi-sheet Excel report.

### Exogenas Engine (`lib/exogenas/`)

Transforms a Siigo Libro Auxiliar (CSV or xlsx) into official DIAN informative return formats.

**Input parsing** (`lib/exogenas/parsers/`):
- `siigo-csv-parser.ts` / `siigo-xlsx-parser.ts` — Siigo Libro Auxiliar → `AsientoContable[]`.
- `xlsx-formato-parser.ts` — Detects and parses a DIAN Prevalidador xlsx directly (bypasses RulesEngine).

**RulesEngine** (`lib/exogenas/engine/rules-engine.ts`):
- Matches each `AsientoContable` by PUC account pattern (exact, `%` wildcard, range) + conditions (naturaleza, montos, tercero type).
- Priority order: tenant-specific rules → system defaults (`lib/exogenas/config/reglas-default-2025.ts`).
- Output: assigns `formato` (1001/1005/etc.) + `concepto` + `deducible` flag.

**Format implementations** (`lib/exogenas/formatos/`): `formato-1001.ts` through `formato-1010.ts`, each implementing the Resolución 000227/2025 + 000233/2025 v11 schema. Format 1001 splits deducible/no-deducible per the 2025 revision.

**Streaming API**: `POST /api/exogenas/generar` returns a `ReadableStream` of NDJSON events (`etapa_inicio`, `etapa_ok`, `formato_inicio`, `formato_ok`, `fin`, `error`). The UI subscribes to this stream for real-time progress.

### NIT Verification (`app/api/nit-verify/`)

Queries the public RUES dataset at `datos.gov.co` using a 3-attempt strategy (full number → strip last digit → strip last 2 digits) to handle NITs with/without the check digit. Returns entity type, mercantile registry data, CIIU activity codes, and legal representative.

### Python/Streamlit Module (`modulo_conciliaciones/`)

A parallel standalone implementation of the reconciliation engine using Python + Streamlit + rapidfuzz. Mirrors the TypeScript logic (`models.py` ↔ `lib/conciliaciones/models.ts`, `conciliador.py` ↔ `conciliador.ts`). Runs locally; Excel report is the deliverable. Not deployed — currently untracked and experimental.

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
- `facturas_recibidas` — Received invoices queue with estado state machine (ingresada → causada → contabilizada)
- `user_dian_config` — Per-user DIAN credentials and causacion rules (encrypted via `lib/causacion/encryption.ts`)
- `payments`, `expenses`, `products`, `inventory_movements`
- `ml_connections` — Mercado Libre OAuth tokens per tenant
- `exogenas_config` — Tenant declarant config per fiscal year (NIT, razón social, municipio, tipo declarante)
- `exogenas_reglas_mapeo` — Mapping rules (PUC pattern → formato + concepto, prioridad, condiciones)
- `exogenas_procesos` — Process state machine (borrador → procesando → revision → aprobado → exportado → anulado)
- `exogenas_filas` — Generated rows per formato with traceability (cuentas_origen, documentos_ids, regla_id)
- `exogenas_excepciones` — Pending exceptions (tipo, severidad, estado: pendiente → resuelto → ignorado)

RLS is active — admin API routes use `utils/supabase/admin.ts` (service role key) to bypass RLS for cross-tenant operations.

## Colombian Tax Normative (2026)

- **UVT 2026**: $52,374 (Resolución DIAN 000238/2025)
- **ReteFuente rates**: Decreto 1625/2016 (Comunicado DIAN 070/2026 reverts Decreto 572/2025)
- **DIAN informative formats**: Resolución 000227/2025 + 000233/2025 (v11) — Format 1001 splits deducible/no-deducible
- **ICA**: Municipal tariffs (e.g., Bogotá 4.14‰); codes per DIVIPOLA (`lib/exogenas/config/divipola.ts`)
