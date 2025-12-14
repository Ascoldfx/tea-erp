import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Leaf } from 'lucide-react';

export function LoginPage() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Redirect if already logged in
    if (isAuthenticated) {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
        return null;
    }

    const handleLogin = () => {
        login();
        // Login happens synchronously in our mock, so we can navigate immediately
        // In a real app this would be in a .then() or useEffect
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
    };

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
                    <div className="space-y-4">
                        <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-200 text-center">
                                Требуется авторизация учетной записи Google
                            </p>
                        </div>

                        <Button
                            onClick={handleLogin}
                            className="w-full h-12 text-base font-medium flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-200 transition-colors"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Войти через Google
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
