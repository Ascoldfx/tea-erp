import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Trash2, Plus, Save, ArrowLeft } from 'lucide-react';
import { recipesService } from '../../services/recipesService';
import { useInventory } from '../../hooks/useInventory';
import type { Recipe, RecipeIngredient } from '../../types/production';

export default function RecipeEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isNew = !id || id === 'new';

    const [recipe, setRecipe] = useState<Recipe>({
        id: `rcp-${Date.now()}`,
        name: '',
        description: '',
        outputItemId: '',
        outputQuantity: 1, // 1 ящик
        ingredients: []
    });

    const { items } = useInventory();

    useEffect(() => {
        const loadRecipe = async () => {
            if (!isNew && id) {
                try {
                    const recipes = await recipesService.getRecipes();
                    const existing = recipes.find(r => r.id === id);
                    if (existing) {
                        setRecipe({ ...existing });
                    } else {
                        console.warn(`[RecipeEditor] Recipe ${id} not found`);
                        navigate('/production/recipes');
                    }
                } catch (error) {
                    console.error('[RecipeEditor] Error loading recipe:', error);
                    navigate('/production/recipes');
                }
            }
        };
        loadRecipe();
    }, [id, isNew, navigate]);

    const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string | number) => {
        const newIngredients = [...recipe.ingredients];
        newIngredients[index] = { ...newIngredients[index], [field]: value };
        setRecipe({ ...recipe, ingredients: newIngredients });
    };

    const addIngredient = () => {
        setRecipe({
            ...recipe,
            ingredients: [...recipe.ingredients, { itemId: '', quantity: 0 }]
        });
    };

    const removeIngredient = (index: number) => {
        const newIngredients = recipe.ingredients.filter((_, i) => i !== index);
        setRecipe({ ...recipe, ingredients: newIngredients });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!recipe.name.trim()) {
            alert('Пожалуйста, укажите название техкарты');
            return;
        }

        if (recipe.ingredients.length === 0) {
            alert('Пожалуйста, добавьте хотя бы один ингредиент');
            return;
        }

        try {
            console.log('[RecipeEditor] Saving recipe:', recipe);
            const success = await recipesService.saveRecipe(recipe);
            
            if (success) {
                alert('Технологическая карта успешно сохранена!');
                navigate('/production/recipes');
            } else {
                alert('Ошибка при сохранении техкарты. Проверьте консоль для деталей.');
            }
        } catch (error) {
            console.error('[RecipeEditor] Error saving recipe:', error);
            alert('Ошибка при сохранении техкарты');
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/production/recipes')}>
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Назад
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">{isNew ? 'Новая Тех. Карта' : 'Редактирование Тех. Карты'}</h1>
                </div>
            </div>

            <form onSubmit={handleSave}>
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Основная информация</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            label="Название рецепта"
                            value={recipe.name}
                            onChange={e => setRecipe({ ...recipe, name: e.target.value })}
                            required
                        />
                        <Input
                            label="Описание"
                            value={recipe.description || ''}
                            onChange={e => setRecipe({ ...recipe, description: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Выход продукта (кол-во)"
                                type="number"
                                value={recipe.outputQuantity}
                                onChange={e => setRecipe({ ...recipe, outputQuantity: parseInt(e.target.value) || 0 })}
                                required
                            />
                            <div className="pt-8 text-sm text-slate-500">
                                Базовая единица: ящик
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Состав и Материалы</CardTitle>
                        <Button type="button" size="sm" onClick={addIngredient}>
                            <Plus className="w-4 h-4 mr-2" />
                            Добавить компонент
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {recipe.ingredients.map((ing, index) => (
                            <div key={index} className="flex gap-4 items-end bg-slate-900/50 p-3 rounded-lg">
                                <div className="flex-1">
                                    <Select
                                        label={index === 0 ? "Материал" : undefined}
                                        value={ing.itemId}
                                        onChange={e => handleIngredientChange(index, 'itemId', e.target.value)}
                                        options={[
                                            { value: '', label: 'Выбрать...' },
                                            ...MOCK_ITEMS.map(i => ({ value: i.id, label: `${i.name} (${i.unit})` }))
                                        ]}
                                    />
                                </div>
                                <div className="w-32">
                                    <Input
                                        label={index === 0 ? "Кол-во" : undefined}
                                        type="number"
                                        step="0.001"
                                        value={ing.quantity}
                                        onChange={e => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="mb-0.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                    onClick={() => removeIngredient(index)}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </div>
                        ))}
                        {recipe.ingredients.length === 0 && (
                            <p className="text-center text-slate-500 py-4">Нет компонентов. Добавьте ингредиенты.</p>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-6">
                    <Button type="submit" size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Save className="w-5 h-5 mr-2" />
                        Сохранить карту
                    </Button>
                </div>
            </form>
        </div>
    );
}
