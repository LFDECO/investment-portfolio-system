import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Radio } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  fetchMarketDaily,
  fetchTrendingStocks,
  fetchMarketStatus,
  type MarketStockDto,
  type MarketStatusDto,
} from '@/lib/api';

interface Asset {
  id: number;
  ticker: string;
  name: string;
  currentPrice: number | null;
  change: number;
  changePercent: number;
  volume: number | null;
}

type TrendType = 'gainers' | 'losers' | 'active';

export default function BuySell() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [trendType, setTrendType] = useState<TrendType>('gainers');
  const [loading, setLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatusDto | null>(null);

  const toAsset = (asset: MarketStockDto): Asset => ({
    id: asset.asset_id,
    ticker: asset.ticker_symbol,
    name: asset.asset_name,
    currentPrice: typeof asset.current_price === 'number' ? asset.current_price : null,
    change: typeof asset.change === 'number' ? asset.change : 0,
    changePercent: typeof asset.change_percent === 'number' ? asset.change_percent : 0,
    volume: typeof asset.volume === 'number' ? asset.volume : null,
  });

  const formatInr = (value: number) => formatCurrency(value);

  const loadMarketData = async (nextTrendType: TrendType = trendType) => {
    setMarketLoading(true);
    try {
      const [trendingRows, status] = await Promise.all([
        fetchTrendingStocks({ type: nextTrendType, limit: 30 }),
        fetchMarketStatus().catch(() => null),
      ]);
      if (status) setMarketStatus(status);
      setAssets(trendingRows.map(toAsset));
      setError(null);
    } catch {
      try {
        const fallbackRows = await fetchMarketDaily({ limit: 100 });
        setAssets(fallbackRows.map(toAsset));
      } catch {
        setError('Market data temporarily unavailable. Please click Refresh.');
      }
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadMarketData('gainers');
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load assets');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    loadMarketData(trendType);
  }, [trendType]);

  // Live auto-refresh polling every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden && !searchTerm.trim()) {
        loadMarketData(trendType);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [trendType, searchTerm]);

  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let active = true;
    const handle = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const rows = await fetchMarketDaily({ q: term, limit: 100 });
        if (!active) return;
        setSearchResults(rows.map(toAsset));
      } catch {
        if (!active) return;
        setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [searchTerm]);

  // Strict sorting guarantee by chosen tab
  const visibleAssets = useMemo(() => {
    if (searchTerm.trim()) return searchResults;

    const list = [...assets];
    if (trendType === 'gainers') {
      return list.sort((a, b) => b.changePercent - a.changePercent);
    }
    if (trendType === 'losers') {
      return list.sort((a, b) => a.changePercent - b.changePercent);
    }
    if (trendType === 'active') {
      return list.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    }
    return list;
  }, [assets, searchResults, searchTerm, trendType]);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground mb-1">Buy/Sell Assets</h1>
        <p className="text-muted-foreground">Select a stock to open metrics, graph, and trading options.</p>
      </div>

      {loading && <Card className="p-4 text-sm text-muted-foreground">Loading assets...</Card>}
      {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}

      <Card className="p-6 space-y-4 animate-fade-in-up stagger-1 card-hover">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">
                {marketStatus?.isOpen ? 'Live Market Feed' : 'Market Summary'}
              </h2>
              {marketStatus?.isOpen ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  NSE LIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-400 border-amber-500/30 gap-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Market Closed
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {marketStatus?.message || 'Stock list with latest prices. Click a stock to open details.'}
              {marketStatus?.asOf ? ` • As of ${marketStatus.asOf}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'gainers', label: 'Top Gainers' },
              { key: 'losers', label: 'Top Losers' },
              { key: 'active', label: 'Most Active' },
            ] as const).map(item => (
              <Button
                key={item.key}
                size="sm"
                variant={trendType === item.key ? 'default' : 'outline'}
                onClick={() => setTrendType(item.key)}
                disabled={marketLoading}
              >
                {item.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => loadMarketData(trendType)} disabled={marketLoading}>
              {marketLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by ticker or company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-3 max-h-[32rem] overflow-y-auto">
          {visibleAssets.map(asset => (
            <button
              key={asset.id}
              onClick={() => setLocation(`/buy-sell/${asset.id}?ticker=${encodeURIComponent(asset.ticker)}&name=${encodeURIComponent(asset.name)}`)}
              className="w-full p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{asset.ticker}</p>
                  <p className="text-sm text-muted-foreground">{asset.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">
                    {asset.currentPrice !== null ? formatInr(asset.currentPrice) : '--'}
                  </p>
                  <div className="flex justify-end mt-1">
                    <Badge variant={asset.changePercent >= 0 ? 'default' : 'destructive'}>
                      {asset.changePercent >= 0 ? '+' : ''}
                      {asset.changePercent.toFixed(2)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </button>
          ))}
          {searchLoading && (
            <p className="text-sm text-muted-foreground py-2">Searching NSE stocks...</p>
          )}
          {!searchLoading && visibleAssets.length === 0 && (
            <div className="text-sm text-muted-foreground py-2 space-y-2">
              <p>{searchTerm.trim() ? 'No NSE stocks matched your search.' : 'No assets available right now.'}</p>
              <Button size="sm" variant="outline" onClick={() => setSearchTerm('')}>
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
