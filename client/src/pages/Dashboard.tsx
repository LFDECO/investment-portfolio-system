import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, IndianRupee, Percent } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import PortfolioCard from '@/components/PortfolioCard';
import Breadcrumb from '@/components/Breadcrumb';
import { formatCurrency } from '@/lib/utils';
import { fetchDefaultPortfolio, type PortfolioDto } from '@/lib/api';

const COLORS = [
  'oklch(0.6 0.22 259)',
  'oklch(0.55 0.2 259)',
  'oklch(0.5 0.18 259)',
  'oklch(0.45 0.16 259)',
  'oklch(0.4 0.14 259)',
  'oklch(0.65 0.2 150)',
];

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await fetchDefaultPortfolio();
        if (!mounted) return;
        setPortfolio(payload);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const holdings = portfolio?.holdings ?? [];
  const portfolioValue = portfolio?.total_value ?? 0;
  const totalInvested = useMemo(
    () => holdings.reduce((sum, h) => sum + h.quantity * h.avg_buy_price, 0),
    [holdings]
  );
  const gainLoss = portfolioValue - totalInvested;
  const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

  const allocationData = holdings
    .map((holding, index) => ({
      name: holding.ticker_symbol,
      value: portfolioValue > 0 ? (holding.total_value / portfolioValue) * 100 : 0,
      color: COLORS[index % COLORS.length],
      total_value: holding.total_value,
    }))
    .sort((a, b) => b.total_value - a.total_value);

  const summaryCards = [
    {
      title: 'Portfolio Value',
      value: formatCurrency(portfolioValue),
      icon: IndianRupee,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Total Invested',
      value: formatCurrency(totalInvested),
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      iconBgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      title: 'Gain/Loss',
      value: formatCurrency(gainLoss),
      icon: gainLoss >= 0 ? TrendingUp : TrendingDown,
      iconColor: gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600',
      iconBgColor: gainLoss >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: 'Return %',
      value: `${gainLossPercent.toFixed(2)}%`,
      icon: Percent,
      iconColor: gainLossPercent >= 0 ? 'text-emerald-600' : 'text-red-600',
      iconBgColor: gainLossPercent >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]} />

      {/* Page Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your investment portfolio performance</p>
      </div>

      {loading && (
        <Card className="p-6 text-sm text-muted-foreground">Loading portfolio data...</Card>
      )}

      {error && (
        <Card className="p-6 text-sm text-red-600">{error}</Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, index) => (
          <div key={index} className={`animate-fade-in-up stagger-${index + 1}`}>
            <PortfolioCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              iconColor={card.iconColor}
              iconBgColor={card.iconBgColor}
            />
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Asset Allocation */}
        <Card className="p-8 animate-fade-in-up stagger-5 card-hover">
          <h2 className="text-xl font-bold text-foreground mb-6">Asset Allocation</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={allocationData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${Number(value).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {allocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Portfolio Breakdown */}
        <Card className="p-8 animate-fade-in-up stagger-6 card-hover">
          <h2 className="text-xl font-bold text-foreground mb-6">Top Holdings</h2>
          <div className="space-y-4">
            {allocationData.slice(0, 6).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 bg-muted rounded-full h-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.value}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-12 text-right">
                    {item.value.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
            {allocationData.length === 0 && (
              <p className="text-sm text-muted-foreground">No holdings yet. Buy assets to populate your portfolio.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card className="p-8 animate-fade-in-up stagger-7 card-hover">
        <h2 className="text-xl font-bold text-foreground mb-6">Portfolio Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Total Assets</p>
            <p className="text-2xl font-bold text-foreground">{holdings.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Diversification Score</p>
            <p className="text-2xl font-bold text-primary">
              {Math.min(10, holdings.length * 1.5).toFixed(1)}/10
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Risk Level</p>
            <p className="text-2xl font-bold text-amber-600">
              {holdings.length <= 2 ? 'High' : holdings.length <= 5 ? 'Medium' : 'Low'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">YTD Performance</p>
            <p className={`text-2xl font-bold ${gainLossPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
