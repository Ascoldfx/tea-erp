# Context & Hooks

## Context
- **AuthContext** — `supabase.auth`; hook `useAuth()` → user, session, signIn, signOut, loading
- **LanguageContext** — i18n; hook `useLanguage()`

## Hooks
- **useInventory** (~95 lines) — `{ items, stockLevels, warehouses, loading, error, refetch }`

## Utils
- **excelParser** + **excelParserLogic** — xlsx → InventoryItem + RecipeIngredient
- **unitDisplay** — human-readable unit labels

## Static Data
- **top25Skus** — hardcoded top-25 SKU list
