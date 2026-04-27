import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingCart,
  Eye,
  AlertTriangle,
  History,
  Sparkles,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const displayName =
    user?.name?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    'User';
  const firstName = displayName.split(' ')[0] || 'User';

  const navigationItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/holdings', label: 'Holdings', icon: TrendingUp },
    { href: '/buy-sell', label: 'Buy/Sell', icon: ShoppingCart },
    { href: '/watchlist', label: 'Watchlist', icon: Eye },
    { href: '/risk-analysis', label: 'Risk Analysis', icon: AlertTriangle },
    { href: '/transactions', label: 'Transactions', icon: History },
    { href: '/ai-assistant', label: 'AI Assistant', icon: Sparkles },
  ];

  const isActive = (href: string) => location === href;

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border transition-all duration-300 ease-in-out transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:relative lg:translate-x-0 lg:w-72 flex flex-col bg-sidebar`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center animate-pulse-glow">
              <TrendingUp className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">Portfolio</h1>
              <p className="text-[10px] font-semibold text-sidebar-primary uppercase tracking-widest">Pro</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent/20 rounded-lg p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => {
                  window.location.href = item.href;
                  setSidebarOpen(false);
                }}
                className={`animate-slide-in-left stagger-${index + 1} w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10'
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-sidebar-primary-foreground rounded-r-full" />
                )}
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`} />
                <span className="font-medium text-[13px]">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-sidebar-border/50 p-4 space-y-3">
          <div className="px-3 py-3 rounded-xl bg-sidebar-accent/10">
            <p className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest">Account</p>
            <p className="text-sm font-semibold text-sidebar-foreground mt-1 truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 border-sidebar-border/50 rounded-xl"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="glass border-b border-border/50 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-foreground hover:bg-muted rounded-xl p-2 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{firstName}</span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
