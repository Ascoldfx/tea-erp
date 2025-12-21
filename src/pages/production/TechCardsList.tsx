import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Plus, FileText, Download, Upload } from 'lucide-react';
import { MOCK_RECIPES } from '../../data/mockProduction';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../hooks/useInventory';
import { exportTechCardsToExcel } from '../../services/techCardsExportService';
import TechCardsImportModal from './TechCardsImportModal';
import type { Recipe } from '../../types/production';

export default function TechCardsList() {
    const [searchTerm, setSearchTerm] = useState('');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const navigate = useNavigate();
    const { items, plannedConsumption } = useInventory();

    // Инициализируем тех.карты из MOCK_RECIPES и localStorage
    useEffect(() => {
        const savedRecipes = localStorage.getItem('techCards');
        if (savedRecipes) {
            try {
                const parsed = JSON.parse(savedRecipes);
                setRecipes([...MOCK_RECIPES, ...parsed]);
            } catch (e) {
                console.error('Ошибка при загрузке тех.карт из localStorage:', e);
                setRecipes([...MOCK_RECIPES]);
            }
        } else {
            setRecipes([...MOCK_RECIPES]);
        }
    }, []);

    const filteredRecipes = recipes.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getItemName = (id: string) => items.find(i => i.id === id)?.name || id;
    const getItemUnit = (id: string) => {
        const unit = items.find(i => i.id === id)?.unit || '';
        return unit === 'pcs' ? 'шт' : unit;
    };

    // Парсинг количества пачек в ящике из названия (формат: название (число))
    const parsePacksPerBox = (name: string): number | null => {
        const match = name.match(/\((\d+)\)\s*$/);
        return match ? parseInt(match[1]) : null;
    };

    // Форматирование названия с выделением количества пачек в ящике
    const formatItemName = (name: string): { displayName: string; packsPerBox: number | null } => {
        const packsPerBox = parsePacksPerBox(name);
        if (packsPerBox) {
            // Убираем (число) из конца названия для отображения
            const baseName = name.replace(/\s*\(\d+\)\s*$/, '');
            return { displayName: baseName, packsPerBox };
        }
        return { displayName: name, packsPerBox: null };
    };

    const handleCardDoubleClick = (recipe: Recipe) => {
        navigate(`/production/recipes/${recipe.id}`);
    };

    const handleExport = async () => {
        try {
            await exportTechCardsToExcel(recipes, items, plannedConsumption);
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            alert('Ошибка при экспорте техкарт');
        }
    };

    const handleImport = (importedRecipes: Recipe[]) => {
        setRecipes(prev => {
            const updated = [...prev, ...importedRecipes];
            // Сохраняем в localStorage для сохранения между перезагрузками
            try {
                // Сохраняем только импортированные тех.карты (не MOCK_RECIPES)
                const savedRecipes = localStorage.getItem('techCards');
                const existing = savedRecipes ? JSON.parse(savedRecipes) : [];
                const allSaved = [...existing, ...importedRecipes];
                localStorage.setItem('techCards', JSON.stringify(allSaved));
                console.log('Тех.карты сохранены в localStorage:', allSaved.length);
            } catch (e) {
                console.error('Ошибка при сохранении тех.карт в localStorage:', e);
            }
            return updated;
        });
        console.log('Импортировано тех.карт:', importedRecipes.length);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Технологические Карты</h1>
                    <p className="text-slate-400 mt-1">Рецептуры и нормы расхода (на 1 ящик)</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        onClick={handleExport}
                        className="border-slate-600 hover:bg-slate-800"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Экспорт в Excel
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => setIsImportModalOpen(true)}
                        className="border-slate-600 hover:bg-slate-800"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Импорт из Excel
                    </Button>
                    <Button onClick={() => navigate('/production/recipes/new')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Создать карту
                    </Button>
                </div>
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

            {filteredRecipes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Нет техкарт. Создайте первую техкарту.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredRecipes.map(recipe => {
                        const { displayName, packsPerBox } = formatItemName(recipe.name);
                        
                        return (
                            <Card 
                                key={recipe.id} 
                                className="hover:border-emerald-500/50 transition-colors cursor-pointer"
                                onDoubleClick={() => handleCardDoubleClick(recipe)}
                            >
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-emerald-500" />
                                        <span>{displayName}</span>
                                        {packsPerBox && (
                                            <span className="text-emerald-400 font-normal text-base">
                                                ({packsPerBox})
                                            </span>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-400 mb-4">{recipe.description}</p>

                                    <div className="bg-slate-950/50 rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                            Ингредиенты ({recipe.ingredients.length}):
                                        </h4>
                                        <ul className="space-y-1 text-sm max-h-60 overflow-y-auto">
                                            {recipe.ingredients.map((ing, idx) => (
                                                <li key={idx} className="flex justify-between text-slate-300">
                                                    <span>{getItemName(ing.itemId)}</span>
                                                    <span className="text-slate-500">{ing.quantity} {getItemUnit(ing.itemId)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3 italic text-center">
                                        Двойной клик для просмотра деталей
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <TechCardsImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
            />
        </div>
    );
}
