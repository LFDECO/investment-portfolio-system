import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface PortfolioCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  children?: ReactNode;
  className?: string;
}

export default function PortfolioCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-primary/10',
  trend,
  children,
  className = '',
}: PortfolioCardProps) {
  return (
    <Card className={`p-6 card-hover card-accent-top ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`${iconBgColor} p-3 rounded-xl`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
      {trend && (
        <div className="pt-4 border-t border-border">
          <p
            className={`text-sm font-semibold ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'
              }`}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </p>
        </div>
      )}
      {children}
    </Card>
  );
}
