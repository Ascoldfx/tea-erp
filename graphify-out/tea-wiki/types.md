# Types — Domain Model

## `src/types/inventory.ts`
- `Unit` = `'kg'|'g'|'l'|'ml'|'pcs'|'шт'`
- `WarehouseType` = `'internal'|'supplier'|'contractor'`
- `Warehouse`, `InventoryItem`, `StockLevel`, `StockTransfer`
- `MaterialOrder` — status `ordered|shipped|delivered|cancelled`
- `StockMovementLog` — type `in|out|transfer|adjustment`
- `PlannedConsumption` — plannedDate YYYY-MM-DD

## `src/types/production.ts`
- `RecipeIngredient` — itemId, quantity(per 1 box), tolerance?, monthlyNorms?
- `Recipe` — outputItemId, outputQuantity, ingredients[]
- `ProductionBatch` — status `planned|in_progress|completed|on_hold|cancelled`

## `src/types/contractors.ts`
- `Contractor` — balance(+we owe/-they owe), paymentTerms `prepayment|postpayment`
- `ContractorJob` — status `planned|in_progress|completed|cancelled`
- `ContractorJobItem` — recipeId, quantityKg
