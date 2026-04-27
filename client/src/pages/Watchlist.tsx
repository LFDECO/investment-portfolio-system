import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  addWatchlistItem,
  fetchAssets,
  fetchWatchlist,
  removeWatchlistItem,
  fetchMarketDaily,
  type AssetDto,
  type WatchlistItemDto,
  type MarketStockDto,
} from '@/lib/api';

interface WatchlistItem {
  id: number;
  assetId: number;
  ticker: string;
  name: string;
  currentPrice: number;
}

export default function Watchlist() {
  const [watchlistRows, setWatchlistRows] = useState<WatchlistItemDto[]>([]);
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState<AssetDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [watchlistData, assetRows] = await Promise.all([fetchWatchlist(), fetchAssets()]);
        if (!mounted) return;
        setWatchlistRows(watchlistData);
        setAssets(assetRows);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load watchlist');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const term = newTicker.trim();
    if (!term) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let active = true;
    const handle = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const rows = await fetchMarketDaily({ q: term, limit: 10 });
        if (!active) return;
        setSearchResults(rows.map(row => ({
          asset_id: row.asset_id,
          asset_name: row.asset_name,
          ticker_symbol: row.ticker_symbol,
          current_price: row.current_price
        })));
      } catch {
        if (!active) return;
        setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [newTicker]);

  const watchlist = useMemo<WatchlistItem[]>(() => {
    const assetMap = new Map(assets.map(asset => [asset.asset_id, asset]));
    return watchlistRows.map(row => {
      const asset = assetMap.get(row.asset_id);
      return {
        id: row.watchlist_id,
        assetId: row.asset_id,
        ticker: row.ticker_symbol,
        name: row.asset_name,
        currentPrice: asset?.current_price ?? 0,
      };
    });
  }, [watchlistRows, assets]);

  const filteredWatchlist = watchlist.filter(item =>
    item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemove = async (assetId: number) => {
    setSubmitting(true);
    setError(null);
    try {
      await removeWatchlistItem(assetId);
      const refreshed = await fetchWatchlist();
      setWatchlistRows(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToWatchlist = async (assetId?: number) => {
    let targetAssetId = assetId;

    if (!targetAssetId) {
      if (!newTicker.trim()) return;
      const targetAsset = assets.find(
        asset => asset.ticker_symbol.toLowerCase() === newTicker.trim().toLowerCase()
      );
      if (!targetAsset) {
        setError('Ticker not found. Please select from search results or enter a valid NSE ticker.');
        return;
      }
      targetAssetId = targetAsset.asset_id;
    }

    if (!targetAssetId) return;

    const targetResult = searchResults.find(r => r.asset_id === targetAssetId);

    setSubmitting(true);
    setError(null);
    try {
      await addWatchlistItem(targetAssetId, targetResult?.ticker_symbol, targetResult?.asset_name);
      const refreshed = await fetchWatchlist();
      setWatchlistRows(refreshed);
      setNewTicker('');
      setSearchResults([]);
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add watchlist item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground mb-1">Watchlist</h1>
        <p className="text-muted-foreground">Track assets without purchasing them</p>
      </div>

      {loading && <Card className="p-4 text-sm text-muted-foreground">Loading watchlist...</Card>}
      {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 animate-fade-in-up stagger-1 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Watched Assets</p>
          <p className="text-3xl font-bold text-foreground">{watchlist.length}</p>
        </Card>
        <Card className="p-6 animate-fade-in-up stagger-2 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Watchlist Value</p>
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(watchlist.reduce((sum, item) => sum + item.currentPrice, 0))}
          </p>
        </Card>
      </div>

      {/* Search and Add */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search watchlist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Asset
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="p-6 bg-accent/5 border-accent">
          <h3 className="font-semibold text-foreground mb-4">Add to Watchlist</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Search stocks to add (e.g., Reliance, GOOGL)"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddToWatchlist();
                }}
              />
              <Button onClick={() => handleAddToWatchlist()} disabled={!newTicker.trim() || submitting}>
                Add
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </div>

            {/* Search Results */}
            {newTicker.trim() && (
              <div className="bg-background rounded-lg border border-border overflow-hidden">
                {searchLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Searching NSE universe...</p>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.asset_id}
                        onClick={() => handleAddToWatchlist(result.asset_id)}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-foreground">{result.ticker_symbol}</p>
                          <p className="text-xs text-muted-foreground">{result.asset_name}</p>
                        </div>
                        <Plus className="w-4 h-4 text-primary" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">No matches found.</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Watchlist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWatchlist.length > 0 ? (
          filteredWatchlist.map((item) => (
            <Card key={item.id} className="p-6 hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{item.ticker}</h3>
                  <p className="text-sm text-muted-foreground">{item.name}</p>
                </div>
                <button
                  onClick={() => handleRemove(item.assetId)}
                  disabled={submitting}
                  className="text-muted-foreground hover:text-destructive transition-colors p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                  <p className="text-2xl font-bold text-foreground">
                    {item.currentPrice > 0 ? formatCurrency(item.currentPrice) : '--'}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  {item.currentPrice > 0 ? 'Live quote from assets API' : 'Price currently unavailable'}
                </p>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground mb-4">No assets in watchlist</p>
            <Button onClick={() => setShowAddForm(true)}>Add your first asset</Button>
          </div>
        )}
      </div>
    </div >
  );
}
