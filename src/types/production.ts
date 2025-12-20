export interface RecipeIngredient {
    itemId: string;
    quantity: number; // Amount required per 1 pack
    tolerance?: number; // +/- percent allowed variation (optional)
}

export interface Recipe {
    id: string;
    name: string;
    description?: string;
    outputItemId: string; // The finished good item ID (sku of the box) - In this MVP we might not have specific SKUs for every finished box mock, so we'll simulate it.
    outputQuantity: number; // Base batch size (e.g. 1 pack)
    actualQuantity?: number;
    materialsHandoverDate?: string; // ISO date string
    materialsAcceptedDate?: string; // ISO date string
    ingredients: RecipeIngredient[];
}

export interface ProductionBatch {
    id: string;
    recipeId: string;
    status: 'planned' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
    startDate?: string;
    endDate?: string;
    targetQuantity: number; // Planned amount
    producedQuantity?: number; // Actual amount
    materialsHandoverDate?: string; // ISO date string
    materialsAcceptedDate?: string; // ISO date string
    machineId?: string;
}
