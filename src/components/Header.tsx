import { Bell, UserCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Header = () => {
  const { profile } = useAuth();
  return (
    <header className="bg-card border-b border-border p-4 flex justify-end items-center space-x-4">
      <button className="relative text-muted-foreground hover:text-foreground">
        <Bell size={20} />
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      </button>
      <div className="flex items-center space-x-2">
        <UserCircle size={24} className="text-muted-foreground" />
        <span className="text-sm font-medium">{profile?.full_name || 'User'}</span>
      </div>
    </header>
  );
};

export default Header;
