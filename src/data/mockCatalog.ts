export interface Product {
    id: string;
    sku: string;
    name: string;
    description?: string;
    defaultRecipeId?: string; // Link to production
    category: 'finished_good' | 'semi_finished';
}

export const MOCK_PRODUCTS: Product[] = [
    { id: 'prod-001', sku: 'TEA-BLK-CLS-25', name: 'Чай Черный "Классика" (25 пак)', defaultRecipeId: 'rcp-001', category: 'finished_good' },
    { id: 'prod-002', sku: 'TEA-GRN-SEN-25', name: 'Чай Зеленый "Сенча" (25 пак)', defaultRecipeId: 'rcp-002', category: 'finished_good' },
    { id: 'prod-003', sku: 'TEA-BLK-EARL-25', name: 'Эрл Грей (25 пак)', defaultRecipeId: 'rcp-003', category: 'finished_good' },
    { id: 'prod-004', sku: 'TEA-HRB-ALP-25', name: 'Альпийские Травы (25 пак)', defaultRecipeId: 'rcp-004', category: 'finished_good' },
    { id: 'prod-005', sku: 'TEA-FRT-BER-25', name: 'Лесные Ягоды (25 пак)', defaultRecipeId: 'rcp-005', category: 'finished_good' },
    { id: 'prod-006', sku: 'TEA-BLK-LEM-25', name: 'Черный с Лимоном (25 пак)', defaultRecipeId: 'rcp-006', category: 'finished_good' },
    { id: 'prod-007', sku: 'TEA-BLK-MNT-25', name: 'Черный с Мятой (25 пак)', defaultRecipeId: 'rcp-007', category: 'finished_good' },
    { id: 'prod-008', sku: 'TEA-BLK-THY-25', name: 'Черный с Чабрецом (25 пак)', defaultRecipeId: 'rcp-008', category: 'finished_good' },
    { id: 'prod-009', sku: 'TEA-GRN-JAS-25', name: 'Зеленый с Жасмином (25 пак)', defaultRecipeId: 'rcp-009', category: 'finished_good' },
    { id: 'prod-010', sku: 'TEA-GRN-LEM-25', name: 'Зеленый с Лимоном (25 пак)', defaultRecipeId: 'rcp-010', category: 'finished_good' },
    { id: 'prod-011', sku: 'TEA-GRN-MNT-25', name: 'Зеленый с Мятой (25 пак)', defaultRecipeId: 'rcp-011', category: 'finished_good' },
    { id: 'prod-012', sku: 'TEA-XMS-25', name: 'Чай "Рождественский" (25 пак)', defaultRecipeId: 'rcp-012', category: 'finished_good' },
    { id: 'prod-013', sku: 'TEA-GNG-25', name: 'Чай "Имбирный Пряник" (25 пак)', defaultRecipeId: 'rcp-013', category: 'finished_good' },
    { id: 'prod-014', sku: 'TEA-HNY-25', name: 'Чай "Медовый" (25 пак)', defaultRecipeId: 'rcp-014', category: 'finished_good' },
    { id: 'prod-015', sku: 'TEA-VAN-25', name: 'Чай "Ванильное Небо" (25 пак)', defaultRecipeId: 'rcp-015', category: 'finished_good' },
    { id: 'prod-016', sku: 'TEA-TRP-25', name: 'Чай "Тропик" (25 пак)', defaultRecipeId: 'rcp-016', category: 'finished_good' },
    { id: 'prod-017', sku: 'TEA-CIT-25', name: 'Чай "Цитрусовый Микс" (25 пак)', defaultRecipeId: 'rcp-017', category: 'finished_good' },
    { id: 'prod-018', sku: 'TEA-BER-DST-25', name: 'Чай "Ягодный Десерт" (25 пак)', defaultRecipeId: 'rcp-018', category: 'finished_good' },
    { id: 'prod-019', sku: 'TEA-PCH-GDN-25', name: 'Чай "Персиковый Сад" (25 пак)', defaultRecipeId: 'rcp-019', category: 'finished_good' },
    { id: 'prod-020', sku: 'TEA-CHC-TRF-25', name: 'Чай "Шоколадный Трюфель" (25 пак)', defaultRecipeId: 'rcp-020', category: 'finished_good' }
];
