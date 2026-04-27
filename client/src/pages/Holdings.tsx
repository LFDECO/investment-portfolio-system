import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { ArrowUpRight, ArrowDownLeft, MoreVertical } from 'lucide-react';
import { fetchDefaultPortfolio } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Holding {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export default function Holdings() {
  const [sortBy, setSortBy] = useState<'value' | 'gain' | 'ticker'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const portfolio = await fetchDefaultPortfolio();
        if (!mounted) return;
        const mapped: Holding[] = portfolio.holdings.map((holding, index) => {
          const costBasis = holding.quantity * holding.avg_buy_price;
          const gainLoss = holding.total_value - costBasis;
          return {
            id: index + 1,
            ticker: holding.ticker_symbol,
            name: holding.asset_name,
            quantity: holding.quantity,
            avgPrice: holding.avg_buy_price,
            currentPrice: holding.current_price,
            totalValue: holding.total_value,
            gainLoss,
            gainLossPercent: costBasis > 0 ? (gainLoss / costBasis) * 100 : 0,
          };
        });
        setHoldings(mapped);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load holdings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const sortedHoldings = [...holdings].sort((a, b) => {
    let aVal: number | string, bVal: number | string;
    if (sortBy === 'value') {
      aVal = a.totalValue;
      bVal = b.totalValue;
    } else if (sortBy === 'gain') {
      aVal = a.gainLoss;
      bVal = b.gainLoss;
    } else {
      aVal = a.ticker;
      bVal = b.ticker;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const aNum = typeof aVal === 'number' ? aVal : 0;
    const bNum = typeof bVal === 'number' ? bVal : 0;
    return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
  });

  const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
  const totalGainLoss = holdings.reduce((sum, h) => sum + h.gainLoss, 0);
  const totalGainLossPercent = (totalGainLoss / (totalValue - totalGainLoss)) * 100;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground mb-1">Holdings</h1>
        <p className="text-muted-foreground">Your current investment positions</p>
      </div>

      {loading && <Card className="p-4 text-sm text-muted-foreground">Loading holdings...</Card>}
      {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 animate-fade-in-up stagger-1 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Value</p>
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(totalValue)}
          </p>
        </Card>
        <Card className="p-6 animate-fade-in-up stagger-2 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Gain/Loss</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${totalGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)}
            </p>
            <p className={`text-lg font-semibold ${totalGainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%
            </p>
          </div>
        </Card>
        <Card className="p-6 animate-fade-in-up stagger-3 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Assets</p>
          <p className="text-3xl font-bold text-foreground">{holdings.length}</p>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card className="overflow-hidden animate-fade-in-up stagger-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => {
                      setSortBy('ticker');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Asset
                  </button>
                </th>
                <th className="px-6 py-4 text-right">
                  <button
                    onClick={() => {
                      setSortBy('value');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Quantity
                  </button>
                </th>
                <th className="px-6 py-4 text-right">
                  <span className="text-sm font-semibold text-foreground">Avg Price</span>
                </th>
                <th className="px-6 py-4 text-right">
                  <span className="text-sm font-semibold text-foreground">Current Price</span>
                </th>
                <th className="px-6 py-4 text-right">
                  <button
                    onClick={() => {
                      setSortBy('value');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Total Value
                  </button>
                </th>
                <th className="px-6 py-4 text-right">
                  <button
                    onClick={() => {
                      setSortBy('gain');
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Gain/Loss
                  </button>
                </th>
                <th className="px-6 py-4 text-center">
                  <span className="text-sm font-semibold text-foreground">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((holding) => (
                <tr
                  key={holding.id}
                  className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/buy-sell/0?ticker=${holding.ticker}`)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-foreground">{holding.ticker}</p>
                      <p className="text-sm text-muted-foreground">{holding.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-medium text-foreground">{holding.quantity}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-medium text-foreground">
                      {formatCurrency(holding.avgPrice)}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-medium text-foreground">
                      {formatCurrency(holding.currentPrice)}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-bold text-foreground">
                      {formatCurrency(holding.totalValue)}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {holding.gainLoss >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-red-600" />
                      )}
                      <div>
                        <p className={`font-semibold ${holding.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(holding.gainLoss))}
                        </p>
                        <p className={`text-xs font-medium ${holding.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {holding.gainLossPercent >= 0 ? '+' : ''}{holding.gainLossPercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors p-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {sortedHoldings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                    No holdings found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
