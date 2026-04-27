import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  bgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  bgColor = 'bg-primary/10',
  trend,
  size = 'md',
}: StatCardProps) {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <Card className={`${sizeClasses[size]} hover:shadow-lg transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
      </div>
      <p className={`${textSizeClasses[size]} font-bold text-foreground mb-2`}>
        {value}
      </p>
      {trend && (
        <p
          className={`text-xs font-semibold ${
            trend.isPositive ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {trend.isPositive ? '+' : ''}{trend.value}%
        </p>
      )}
    </Card>
  );
}
