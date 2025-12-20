export interface Product {
    id: string;
    sku: string;
    name: string;
    description?: string;
    defaultRecipeId?: string; // Link to production
    category: 'finished_good' | 'semi_finished';
}

// Каталог готовой продукции очищен - используйте базу данных для хранения готовой продукции
export const MOCK_PRODUCTS: Product[] = [];
