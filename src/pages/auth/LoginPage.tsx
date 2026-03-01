import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Leaf, Loader2 } from 'lucide-react';

export function LoginPage() {
    const { login, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirect if already logged in
    if (isAuthenticated && !isLoading) {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await login(email, password);
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
        } catch (err: unknown) {
            console.error('Login error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ошибка входа. Проверьте email и пароль.';
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen grid place-items-center bg-slate-950">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen grid place-items-center bg-slate-950 p-4">
            <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                        <Leaf className="w-6 h-6 text-emerald-500" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-100">Tea ERP</CardTitle>
                    <p className="text-slate-400 text-sm mt-2">Система управления производством чая</p>
                </CardHeader>
                <CardContent className="pt-6 pb-8 px-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="your@email.com"
                            disabled={isSubmitting}
                            autoComplete="email"
                        />

                        <Input
                            label="Пароль"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Введите пароль"
                            disabled={isSubmitting}
                            autoComplete="current-password"
                        />

                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-12 text-base font-medium bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Вход...
                                </>
                            ) : (
                                'Войти'
                            )}
                        </Button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-700"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-slate-900 px-2 text-slate-500">Или</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                                setError(null);
                                setIsSubmitting(true);
                                try {
                                    await login('guest@tea.com', '123456');
                                    const from = location.state?.from?.pathname || '/';
                                    navigate(from, { replace: true });
                                } catch (err: unknown) {
                                    console.error('Guest login error:', err);
                                    setError('Гостевой аккаунт (guest@tea.com / 123456) не найден или пароль неверен. Убедитесь, что он создан в Supabase.');
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }}
                            disabled={isSubmitting}
                            className="w-full h-12 text-base font-medium border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                            Войти как Гость
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
