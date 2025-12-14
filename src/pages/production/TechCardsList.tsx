import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Plus, FileText, Edit } from 'lucide-react';
import { MOCK_RECIPES } from '../../data/mockProduction';
import { MOCK_ITEMS } from '../../data/mockInventory';
import { useNavigate } from 'react-router-dom';

export default function TechCardsList() {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const filteredRecipes = MOCK_RECIPES.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getItemName = (id: string) => MOCK_ITEMS.find(i => i.id === id)?.name || id;
    const getItemUnit = (id: string) => MOCK_ITEMS.find(i => i.id === id)?.unit || '';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Технологические Карты</h1>
                    <p className="text-slate-400 mt-1">Рецептуры и нормы расхода (на 1000 пакетиков)</p>
                </div>
                <Button onClick={() => navigate('/production/recipes/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать карту
                </Button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                <Input
                    placeholder="Поиск рецепта..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredRecipes.map(recipe => (
                    <Card key={recipe.id} className="hover:border-emerald-500/50 transition-colors">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-500" />
                                {recipe.name}
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/production/recipes/${recipe.id}`)}>
                                <Edit className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-400 mb-4">{recipe.description}</p>

                            <div className="bg-slate-950/50 rounded-lg p-3">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Основные ингредиенты:</h4>
                                <ul className="space-y-1 text-sm">
                                    {recipe.ingredients.slice(0, 5).map((ing, idx) => (
                                        <li key={idx} className="flex justify-between text-slate-300">
                                            <span>{getItemName(ing.itemId)}</span>
                                            <span className="text-slate-500">{ing.quantity} {getItemUnit(ing.itemId)}</span>
                                        </li>
                                    ))}
                                    {recipe.ingredients.length > 5 && (
                                        <li className="text-xs text-center text-slate-500 pt-1">
                                            + еще {recipe.ingredients.length - 5}
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
