import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, TrendingUp, ChevronDown } from 'lucide-react';
import { fetchTransactions, type TransactionDto } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Transaction {
  id: number;
  type: 'BUY' | 'SELL';
  ticker: string;
  name: string;
  quantity: number;
  price: number;
  totalValue: number;
  date: string;
  status: 'completed' | 'pending';
}

export default function Transactions() {
  const [filterType, setFilterType] = useState<'all' | 'BUY' | 'SELL'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'value'>('date');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await fetchTransactions();
        if (!mounted) return;
        const mapped: Transaction[] = rows.map((row: TransactionDto) => ({
          id: row.transaction_id,
          type: row.transaction_type,
          ticker: row.ticker_symbol,
          name: row.asset_name,
          quantity: row.quantity,
          price: row.price,
          totalValue: row.total_value,
          date: row.transaction_date,
          status: 'completed',
        }));
        setTransactions(mapped);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredTransactions = transactions.filter(
    (t) => filterType === 'all' || t.type === filterType
  );

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      return b.totalValue - a.totalValue;
    }
  });

  const totalBuys = transactions
    .filter((t) => t.type === 'BUY')
    .reduce((sum, t) => sum + t.totalValue, 0);
  const totalSells = transactions
    .filter((t) => t.type === 'SELL')
    .reduce((sum, t) => sum + t.totalValue, 0);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground mb-1">Transaction History</h1>
        <p className="text-muted-foreground">View all your buy and sell transactions</p>
      </div>

      {loading && <Card className="p-4 text-sm text-muted-foreground">Loading transactions...</Card>}
      {error && <Card className="p-4 text-sm text-red-600">{error}</Card>}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 animate-fade-in-up stagger-1 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Transactions</p>
          <p className="text-3xl font-bold text-foreground">{transactions.length}</p>
        </Card>
        <Card className="p-6 animate-fade-in-up stagger-2 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Bought</p>
          <p className="text-3xl font-bold text-emerald-600">
            {formatCurrency(totalBuys)}
          </p>
        </Card>
        <Card className="p-6 animate-fade-in-up stagger-3 card-hover">
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Sold</p>
          <p className="text-3xl font-bold text-amber-600">
            {formatCurrency(totalSells)}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          <Button
            onClick={() => setFilterType('all')}
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
          >
            All
          </Button>
          <Button
            onClick={() => setFilterType('BUY')}
            variant={filterType === 'BUY' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Buy
          </Button>
          <Button
            onClick={() => setFilterType('SELL')}
            variant={filterType === 'SELL' ? 'default' : 'outline'}
            size="sm"
            className="flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Sell
          </Button>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button
            onClick={() => setSortBy('date')}
            variant={sortBy === 'date' ? 'default' : 'outline'}
            size="sm"
          >
            Sort by Date
          </Button>
          <Button
            onClick={() => setSortBy('value')}
            variant={sortBy === 'value' ? 'default' : 'outline'}
            size="sm"
          >
            Sort by Value
          </Button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {sortedTransactions.length > 0 ? (
          sortedTransactions.map((transaction) => (
            <Card
              key={transaction.id}
              className="p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === transaction.id ? null : transaction.id)
                }
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`p-3 rounded-lg ${transaction.type === 'BUY'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-amber-100 dark:bg-amber-900/30'
                        }`}
                    >
                      {transaction.type === 'BUY' ? (
                        <ShoppingCart className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <TrendingUp className="w-6 h-6 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-foreground">{transaction.ticker}</p>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${transaction.type === 'BUY'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}
                        >
                          {transaction.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{transaction.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        {formatCurrency(transaction.totalValue)}
                      </p>
                      <p className="text-sm text-muted-foreground">{transaction.date}</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform ${expandedId === transaction.id ? 'rotate-180' : ''
                        }`}
                    />
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedId === transaction.id && (
                <div className="mt-6 pt-6 border-t border-border space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                      <p className="font-semibold text-foreground">{transaction.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Price per Unit</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(transaction.price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(transaction.totalValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <span className="inline-block text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No transactions found</p>
          </Card>
        )}
      </div>
    </div>
  );
}
