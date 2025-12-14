import { Outlet } from 'react-router-dom';
// Sidebar handles its own access to useAuth, no change needed in Layout props
import Sidebar from './Sidebar';

export default function Layout() {
    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8 ml-64">
                <Outlet />
            </main>
        </div>
    );
}
