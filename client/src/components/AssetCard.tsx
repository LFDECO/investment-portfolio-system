import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface AssetCardProps {
  ticker: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  onClick?: () => void;
  selected?: boolean;
}

export default function AssetCard({
  ticker,
  name,
  currentPrice,
  change,
  changePercent,
  onClick,
  selected = false,
}: AssetCardProps) {
  const isPositive = change >= 0;

  return (
    <Card
      onClick={onClick}
      className={`p-4 cursor-pointer card-hover transition-all duration-200 border-2 ${selected
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
          : 'border-border hover:border-primary/40'
        }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-foreground text-sm">{ticker}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
        </div>
        <div className={`p-2 rounded-lg ${isPositive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-600" />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-lg font-bold text-foreground">
          {formatCurrency(currentPrice)}
        </p>
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{formatCurrency(Math.abs(change))}
          </p>
          <p className={`text-xs font-medium px-1.5 py-0.5 rounded ${isPositive ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </p>
        </div>
      </div>
    </Card>
  );
}
