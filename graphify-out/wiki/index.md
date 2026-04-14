# Tea ERP — Knowledge Graph Index

> Stack: React 18 + TypeScript + Vite + TailwindCSS + Supabase + react-router-dom v6

## Navigation Map
| Area | Wiki Node | Raw Path |
|---|---|---|
| Types | [[types]] | `src/types/` |
| DB Schema | [[db-schema]] | `src/lib/supabase.ts` + `supabase/` |
| Services | [[services]] | `src/services/` |
| Pages | [[pages]] | `src/pages/` |
| Context | [[context]] | `src/context/` |

## Route Map
- `/` | `/inventory` → InventoryList
- `/orders` → OrdersList
- `/suppliers` → SuppliersPage
- `/production` → ProductionPlanning
- `/production/schedule` → ProductionSchedule
- `/production/recipes[/:id]` → TechCardsList / RecipeEditor
- `/logistics` → LogisticsCalendar
- `/calculator` → ProductionCalculator
- `/crm/contractors` → ContractorsList
- `/contractors` → ContractorsPage
- `/users` → UsersPage
- `/settings` → SettingsPage

Providers: `LanguageProvider > AuthProvider > Router`

## Blast-Radius Reference
| Change target | Files to check |
|---|---|
| Inventory item | `types/inventory.ts` → `services/inventoryService.ts` → `pages/inventory/*` |
| Recipe/TechCard | `types/production.ts` → `services/recipesService.ts` → `pages/production/RecipeEditor` |
| Production batch | `types/production.ts:ProductionBatch` → `services/productionService.ts` → `pages/production/*` |
| Orders | `types/inventory.ts:MaterialOrder` → `services/ordersService.ts` → `pages/orders/*` |
| Contractors | `types/contractors.ts` → `services/contractorsService.ts` → `pages/contractors/*` |
| Auth/Users | `context/AuthContext.tsx` → `services/usersService.ts` → `pages/users/*` |
| DB migration | `supabase/migrations/` → [[db-schema]] |
