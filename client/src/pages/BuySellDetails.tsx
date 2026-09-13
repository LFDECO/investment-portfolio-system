import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Radio } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import CandlestickChart from '@/components/CandlestickChart';
import {
  buyAsset,
  fetchDefaultPortfolio,
  fetchMarketAsset,
  fetchMarketHistory,
  sellAsset,
  type MarketHistoryPointDto,
  type MarketStockDto,
  type PortfolioDto,
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

export default function BuySellDetails() {
  const [location, setLocation] = useLocation();
  const assetId = Number(location.split('/').pop());
  const searchParams = new URLSearchParams(window.location.search);
  const tickerFromQuery = searchParams.get('ticker') ?? undefined;
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [historyDays, setHistoryDays] = useState(30);
  const [historyPoints, setHistoryPoints] = useState<MarketHistoryPointDto[]>([]);
  const [quantity, setQuantity] = useState('');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const defaultPortfolio = await fetchDefaultPortfolio();
        if (!mounted) return;
        setPortfolio(defaultPortfolio);

        const snapshot = await fetchMarketAsset(assetId, tickerFromQuery);
        if (!mounted) return;
        setSelectedAsset(toAsset(snapshot));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load stock details');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [assetId]);

  useEffect(() => {
    if (!selectedAsset?.id) return;
    let active = true;
    (async () => {
      setHistoryLoading(true);
      try {
        const payload = await fetchMarketHistory(selectedAsset.id, historyDays, selectedAsset.ticker);
        if (!active) return;
        setHistoryPoints(payload.history);
      } catch {
        if (!active) return;
        setHistoryPoints([]);
      } finally {
        if (active) setHistoryLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedAsset?.id, selectedAsset?.ticker, historyDays]);

  // Live polling for price tick updates (every 10 seconds)
  useEffect(() => {
    if (!selectedAsset?.id) return;
    const interval = setInterval(async () => {
      try {
        const snapshot = await fetchMarketAsset(selectedAsset.id, selectedAsset.ticker);
        if (typeof snapshot.current_price === 'number') {
          const newPrice = snapshot.current_price;
          setSelectedAsset(prev => {
            if (!prev) return null;
            if (prev.currentPrice !== null && Math.abs(newPrice - prev.currentPrice) > 0.01) {
              setPriceFlash(newPrice > prev.currentPrice ? 'up' : 'down');
              setTimeout(() => setPriceFlash(null), 800);
            }
            return {
              ...prev,
              currentPrice: newPrice,
              change: snapshot.change,
              changePercent: snapshot.change_percent,
              volume: snapshot.volume,
            };
          });
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedAsset?.id, selectedAsset?.ticker]);

  const holdingQuantity = useMemo(() => {
    if (!portfolio || !selectedAsset) return 0;
    const found = portfolio.holdings.find(h => h.ticker_symbol === selectedAsset.ticker);
    return found?.quantity ?? 0;
  }, [portfolio, selectedAsset]);

  const latestHistoryPoint = historyPoints.length > 0 ? historyPoints[historyPoints.length - 1] : null;
  const previousHistoryPoint = historyPoints.length > 1 ? historyPoints[historyPoints.length - 2] : null;
  const selectedDailyChange =
    latestHistoryPoint && previousHistoryPoint
      ? latestHistoryPoint.close - previousHistoryPoint.close
      : null;
  const selectedDailyChangePercent =
    selectedDailyChange !== null && previousHistoryPoint && previousHistoryPoint.close > 0
      ? (selectedDailyChange / previousHistoryPoint.close) * 100
      : null;
  const historyHigh = historyPoints.length ? Math.max(...historyPoints.map(point => point.high)) : null;
  const historyLow = historyPoints.length ? Math.min(...historyPoints.map(point => point.low)) : null;
  const averageVolume = historyPoints.length
    ? historyPoints.reduce((sum, point) => sum + (point.volume ?? 0), 0) / historyPoints.length
    : null;
  const displayPrice = selectedAsset?.currentPrice ?? latestHistoryPoint?.close ?? null;
  const totalValue =
    quantity && displayPrice !== null && Number.isFinite(displayPrice)
      ? parseFloat(quantity) * displayPrice
      : null;

  const handleConfirmTransaction = async () => {
    if (!selectedAsset || !portfolio) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    if (orderSide === 'sell' && parsedQuantity > holdingQuantity) {
      setError('Insufficient quantity in holdings');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const updatedPortfolio =
        orderSide === 'buy'
          ? await buyAsset(
            portfolio.portfolio_id,
            selectedAsset.id,
            parsedQuantity,
            selectedAsset.ticker,
            selectedAsset.name
          )
          : await sellAsset(
            portfolio.portfolio_id,
            selectedAsset.id,
            parsedQuantity,
            selectedAsset.ticker,
            selectedAsset.name
          );

      setPortfolio(updatedPortfolio);
      setMessage(`${orderSide === 'buy' ? 'Bought' : 'Sold'} ${parsedQuantity} ${selectedAsset.ticker}`);
      setShowConfirm(false);
      setQuantity('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setLocation('/buy-sell')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to list
        </Button>
      </div>

      {loading && <Card className="p-4 text-sm text-muted-foreground">Loading stock details...</Card>}
      {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}
      {message && <Card className="p-4 text-sm text-emerald-600">{message}</Card>}

      {selectedAsset && (
        <>
          <Card className="p-6 space-y-4 animate-fade-in-up card-hover">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{selectedAsset.ticker}</h1>
                <p className="text-muted-foreground">{selectedAsset.name}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Live Market Feed" />
                  <p
                    className={`text-2xl font-bold font-mono transition-colors duration-500 ${
                      priceFlash === 'up'
                        ? 'text-emerald-400 bg-emerald-500/10 px-2 rounded'
                        : priceFlash === 'down'
                          ? 'text-red-400 bg-red-500/10 px-2 rounded'
                          : 'text-foreground'
                    }`}
                  >
                    {displayPrice !== null ? formatInr(displayPrice) : '--'}
                  </p>
                </div>
                <p className={`text-sm font-semibold mt-1 ${selectedAsset.changePercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {selectedAsset.changePercent >= 0 ? '+' : ''}
                  {selectedAsset.changePercent.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Last Close</p>
                <p className="text-lg font-semibold text-foreground">
                  {latestHistoryPoint ? formatInr(latestHistoryPoint.close) : '--'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Daily Change</p>
                <p className={`text-lg font-semibold ${selectedDailyChange !== null && selectedDailyChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedDailyChange !== null ? `${selectedDailyChange >= 0 ? '+' : ''}${formatInr(Math.abs(selectedDailyChange))}` : '--'}
                </p>
                <p className={`text-xs ${selectedDailyChangePercent !== null && selectedDailyChangePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedDailyChangePercent !== null ? `${selectedDailyChangePercent >= 0 ? '+' : ''}${selectedDailyChangePercent.toFixed(2)}%` : ''}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{historyDays}D High</p>
                <p className="text-lg font-semibold text-foreground">{historyHigh !== null ? formatInr(historyHigh) : '--'}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{historyDays}D Low</p>
                <p className="text-lg font-semibold text-foreground">{historyLow !== null ? formatInr(historyLow) : '--'}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">You Hold</p>
                <p className="text-lg font-semibold text-foreground">{holdingQuantity.toFixed(2)} shares</p>
                <p className="text-xs text-muted-foreground">
                  {averageVolume !== null ? `Avg vol: ${Math.round(averageVolume).toLocaleString()}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap gap-1.5 bg-muted/60 p-1 rounded-lg">
                {[
                  { days: 1, label: '1D (5m)' },
                  { days: 7, label: '1W (15m)' },
                  { days: 30, label: '1M' },
                  { days: 90, label: '3M' },
                  { days: 365, label: '1Y' },
                ].map(item => (
                  <Button
                    key={item.days}
                    size="sm"
                    variant={historyDays === item.days ? 'default' : 'ghost'}
                    onClick={() => setHistoryDays(item.days)}
                    disabled={historyLoading}
                    className="h-8 text-xs font-medium"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Bullish Candle
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" /> Bearish Candle
                </span>
              </div>
            </div>

            <CandlestickChart
              data={historyPoints}
              height={380}
              loading={historyLoading}
              currentLivePrice={selectedAsset.currentPrice}
              ticker={selectedAsset.ticker}
            />
          </Card>

          <Card className="p-6 animate-fade-in-up stagger-2 card-hover">
            <h2 className="text-xl font-bold text-foreground mb-6">Trade Order</h2>
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Selected Asset</p>
                <p className="font-bold text-foreground">{selectedAsset.ticker}</p>
                <p className="text-sm text-muted-foreground">{selectedAsset.name}</p>
                <p className="text-lg font-bold text-primary mt-2">{displayPrice !== null ? formatInr(displayPrice) : '--'}</p>
                <p className="text-xs text-muted-foreground mt-1">Holding: {holdingQuantity.toFixed(2)} shares</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Quantity</label>
                <Input
                  type="number"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>

              {quantity && (
                <div className="p-4 bg-accent/10 rounded-lg border border-accent">
                  <p className="text-xs text-muted-foreground mb-1">Estimated Total</p>
                  <p className="text-2xl font-bold text-foreground">{totalValue !== null ? formatInr(totalValue) : 'Resolved at execution'}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    setOrderSide('buy');
                    setShowConfirm(true);
                  }}
                  disabled={submitting || !quantity || parseFloat(quantity) <= 0}
                  className="w-full"
                >
                  Buy Now
                </Button>
                <Button
                  onClick={() => {
                    setOrderSide('sell');
                    setShowConfirm(true);
                  }}
                  disabled={
                    submitting ||
                    !quantity ||
                    parseFloat(quantity) <= 0 ||
                    holdingQuantity <= 0 ||
                    parseFloat(quantity) > holdingQuantity
                  }
                  variant="secondary"
                  className="w-full"
                >
                  Sell Now
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {showConfirm && selectedAsset && quantity && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <Card className="max-w-md w-full p-8 animate-scale-in">
            <h3 className="text-2xl font-bold text-foreground mb-4">Confirm {orderSide === 'buy' ? 'Purchase' : 'Sale'}</h3>
            <div className="space-y-4 mb-6 p-4 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asset:</span>
                <span className="font-semibold text-foreground">{selectedAsset.ticker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity:</span>
                <span className="font-semibold text-foreground">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price:</span>
                <span className="font-semibold text-foreground">{displayPrice !== null ? formatInr(displayPrice) : 'Resolved at execution'}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleConfirmTransaction} disabled={submitting} className="flex-1">
                {submitting ? 'Processing...' : 'Confirm'}
              </Button>
              <Button onClick={() => setShowConfirm(false)} disabled={submitting} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
