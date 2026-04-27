import { Card } from '@/components/ui/card';
import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AlertCircle, TrendingUp, Shield } from 'lucide-react';
import { fetchDefaultPortfolio, type PortfolioDto } from '@/lib/api';

const COLORS = [
  'oklch(0.6 0.22 259)',
  'oklch(0.55 0.2 259)',
  'oklch(0.5 0.18 259)',
  'oklch(0.45 0.16 259)',
  'oklch(0.4 0.14 259)',
];

export default function RiskAnalysis() {
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
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load risk data');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const diversificationData = useMemo(() => {
    const holdings = portfolio?.holdings ?? [];
    const totalValue = portfolio?.total_value ?? 0;
    return holdings
      .map(holding => ({
        name: holding.ticker_symbol,
        value: totalValue > 0 ? (holding.total_value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [portfolio]);

  const volatilityData = [
    { month: 'Jan', volatility: 12.5 },
    { month: 'Feb', volatility: 14.2 },
    { month: 'Mar', volatility: 11.8 },
    { month: 'Apr', volatility: 13.5 },
    { month: 'May', volatility: 10.2 },
    { month: 'Jun', volatility: 15.1 },
  ];

  const riskMetrics = [
    { label: 'Portfolio Volatility', value: '13.2%', icon: TrendingUp, color: 'text-amber-600' },
    { label: 'Beta', value: '0.95', icon: Shield, color: 'text-blue-600' },
    { label: 'Sharpe Ratio', value: '1.45', icon: AlertCircle, color: 'text-emerald-600' },
    { label: 'Max Drawdown', value: '-18.5%', icon: TrendingUp, color: 'text-red-600' },
  ];

  const concentration = diversificationData.length ? Math.max(...diversificationData.map(item => item.value)) : 0;
  const riskScore = Math.max(1, Math.min(10, Number((3 + concentration / 20).toFixed(1))));
  const riskLevel = riskScore < 4 ? 'Low' : riskScore < 7 ? 'Medium' : 'High';
  const riskColor = riskScore < 4 ? 'text-emerald-600' : riskScore < 7 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground mb-1">Risk Analysis</h1>
        <p className="text-muted-foreground">Comprehensive portfolio risk assessment and metrics</p>
      </div>

      {loading && <Card className="p-4 text-sm text-muted-foreground">Loading risk analysis...</Card>}
      {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}

      {/* Risk Score Card */}
      <Card className="p-8 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 animate-fade-in-up stagger-1 card-hover">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground mb-2">Overall Risk Score</p>
            <div className="flex items-baseline gap-3">
              <p className={`text-6xl font-bold ${riskColor}`}>{riskScore}</p>
              <p className="text-2xl text-muted-foreground">/10</p>
            </div>
            <p className={`text-lg font-semibold mt-4 ${riskColor}`}>{riskLevel} Risk</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your portfolio has a {riskLevel.toLowerCase()} risk profile based on asset allocation and volatility metrics.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(riskScore / 10) * 251.2} 251.2`}
                  className={riskColor}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-center">
                  <span className={`text-3xl font-bold ${riskColor}`}>{riskScore}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {riskMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{metric.label}</p>
                  <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                </div>
                <Icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Diversification */}
        <Card className="p-8 animate-fade-in-up stagger-5 card-hover">
          <h2 className="text-xl font-bold text-foreground mb-6">Asset Diversification</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={diversificationData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${Number(value).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {diversificationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Volatility Trend */}
        <Card className="p-8 animate-fade-in-up stagger-6 card-hover">
          <h2 className="text-xl font-bold text-foreground mb-6">Volatility Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volatilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
              <XAxis dataKey="month" stroke="currentColor" className="text-muted-foreground" />
              <YAxis stroke="currentColor" className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                }}
              />
              <Bar dataKey="volatility" fill="oklch(0.55 0.2 259)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Allocation Breakdown */}
      <Card className="p-8 animate-fade-in-up stagger-7 card-hover">
        <h2 className="text-xl font-bold text-foreground mb-6">Asset Class Breakdown</h2>
        <div className="space-y-4">
          {diversificationData.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium text-foreground">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.value}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
                <span className="font-semibold text-foreground w-12 text-right">{item.value.toFixed(1)}%</span>
              </div>
            </div>
          ))}
          {diversificationData.length === 0 && (
            <p className="text-sm text-muted-foreground">No holdings available for risk analysis yet.</p>
          )}
        </div>
      </Card>

      {/* Risk Recommendations */}
      <Card className="p-8 border-l-4 border-l-amber-600 animate-fade-in-up stagger-8 card-hover">
        <h2 className="text-xl font-bold text-foreground mb-4">Recommendations</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex gap-3">
            <span className="text-amber-600 font-bold">•</span>
            <span>Consider increasing allocation to Healthcare and Energy sectors for better diversification</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-600 font-bold">•</span>
            <span>Your portfolio volatility is within acceptable range for medium-risk investors</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-600 font-bold">•</span>
            <span>Monitor Technology sector exposure as it represents 35% of your portfolio</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-600 font-bold">•</span>
            <span>Consider adding defensive assets to reduce portfolio drawdown risk</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
