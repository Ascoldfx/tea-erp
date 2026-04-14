# DB Schema — Supabase Tables

> Client: `src/lib/supabase.ts` — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

## inventory
- `items` — id, name, sku, category, unit, min_stock_level, storage_location
- `warehouses` — id, name, location, type(internal/supplier/contractor), contractor_id
- `stock_levels` — warehouse_id, item_id, quantity, last_updated
- `stock_movements` — item_id, quantity, type(in/out/transfer/adjustment), date
- `planned_consumption` — item_id, planned_date, quantity, notes

## orders
- `orders` — MaterialOrder
- `order_items` — order_id, item_id, quantity

## production
- `recipes` — id, name, output_item_id, output_quantity, materials_handover_date
- `recipe_ingredients` — recipe_id, item_id, quantity, tolerance, monthly_norms(json)
- `production_batches` — recipe_id, status, target_quantity, produced_quantity, machine_id
- `recipes_backup` — snapshots

## contractors
- `contractors` — name, balance, payment_terms, payment_delay_days
- `contractor_jobs` — contractor_id, date, status, total_amount
- `contractor_job_items` — job_id, recipe_id, quantity_kg

## profiles
- `profiles` — id(=auth.uid), email, role, full_name
