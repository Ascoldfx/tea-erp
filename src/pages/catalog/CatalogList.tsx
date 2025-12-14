import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MOCK_PRODUCTS } from '../../data/mockCatalog';
import { MOCK_RECIPES } from '../../data/mockProduction';
import { Search, FileText, ArrowRight } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { useState } from 'react';

export default function CatalogList() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = MOCK_PRODUCTS.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Справочник товаров</h1>
                    <p className="text-slate-400 mt-1">Каталог готовой продукции и артикулов (SKU)</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/production/recipes')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Перейти к Тех. картам
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Поиск по названию или SKU..."
                                className="pl-9 bg-slate-800 border-slate-700"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/50">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">SKU</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Наименование</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredProducts.map(product => {
                                    const recipe = MOCK_RECIPES.find(r => r.id === product.defaultRecipeId);

                                    return (
                                        <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-emerald-400">
                                                {product.sku}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-200 font-medium">
                                                {product.name}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {recipe && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => navigate(`/production/recipes/${recipe.id}`)}
                                                        className="text-slate-400 hover:text-slate-200"
                                                    >
                                                        К рецепту
                                                        <ArrowRight className="w-4 h-4 ml-1" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
