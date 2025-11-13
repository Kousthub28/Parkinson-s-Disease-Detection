import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FilePlus, History, Bot, Stethoscope, ShoppingCart, LogOut, BrainCircuit, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/new-test', label: 'New Test', icon: FilePlus },
  { href: '/history', label: 'History & Reports', icon: History },
  { href: '/chatbot', label: 'AI Assistant', icon: Bot },
  { href: '/consult', label: 'Consult Doctor', icon: Stethoscope },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
];

const Sidebar = () => {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 flex items-center space-x-2 border-b border-border">
        <BrainCircuit className="text-primary-foreground h-8 w-8" />
        <h1 className="text-xl font-bold text-primary-foreground">NeuroCare</h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
              location.pathname.startsWith(item.href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border space-y-2">
         <Link
            to="/profile"
            className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
              location.pathname.startsWith('/profile')
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Settings size={20} />
            <span className="font-medium">Profile</span>
        </Link>
         <button
            onClick={logout}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
