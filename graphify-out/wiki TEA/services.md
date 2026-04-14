# Services — API Layer

> Все используют `supabase` из `src/lib/supabase.ts`

## `inventoryService` (~918 lines) — items, warehouses, stock_levels, stock_movements, planned_consumption
- getItems, createItem, updateItem, deleteItem
- getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse
- getStockLevels, updateStockLevel, transferStock
- getStockMovements, addStockMovement
- getOrders, createOrder, updateOrder, deleteOrder
- get/create/update/deletePlannedConsumption

## `recipesService` (~604 lines) — recipes, recipe_ingredients
- getRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe
- getIngredients, upsertIngredients (monthlyNorms json)

## `productionService` (~219 lines) — production_batches
- getBatches, getBatchById, createBatch, updateBatch, deleteBatch

## `ordersService` (~233 lines) — orders, order_items
- getOrders, createOrder, updateOrder, deleteOrder, getOrderItems

## `contractorsService` (~99 lines) — contractors, contractor_jobs, contractor_job_items

## `usersService` (~185 lines, class) — profiles
- getUsers, createUser, updateUser, deleteUser, getUserById

## `recipesBackupService` (~284 lines) — recipes_backup
## `techCardsExportService` (~665 lines) — read-only xlsx export
