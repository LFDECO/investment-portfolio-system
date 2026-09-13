import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
  CrosshairMode,
} from 'lightweight-charts';
import { formatCurrency } from '@/lib/utils';
import type { MarketHistoryPointDto } from '@/lib/api';

interface CandlestickChartProps {
  data: MarketHistoryPointDto[];
  height?: number;
  loading?: boolean;
  currentLivePrice?: number | null;
  ticker?: string;
}

interface HoverLegendData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number | null;
}

export default function CandlestickChart({
  data,
  height = 360,
  loading = false,
  currentLivePrice = null,
  ticker,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [hoverData, setHoverData] = useState<HoverLegendData | null>(null);

  // Format data for lightweight-charts
  const formatDataForChart = (rawPoints: MarketHistoryPointDto[]) => {
    // Sort chronologically ascending
    const sorted = [...rawPoints].sort((a, b) => {
      const timeA = typeof a.time === 'number' ? a.time : new Date(a.date).getTime() / 1000;
      const timeB = typeof b.time === 'number' ? b.time : new Date(b.date).getTime() / 1000;
      return timeA - timeB;
    });

    // Remove duplicates on time
    const seenTimes = new Set<number | string>();
    const candles: CandlestickData<Time>[] = [];
    const volumes: HistogramData<Time>[] = [];

    for (const pt of sorted) {
      // Use unix timestamp in seconds (or date string if no time)
      const chartTime = (typeof pt.time === 'number' ? pt.time : pt.date) as Time;
      if (seenTimes.has(chartTime as any)) continue;
      seenTimes.add(chartTime as any);

      candles.push({
        time: chartTime,
        open: pt.open,
        high: pt.high,
        low: pt.low,
        close: pt.close,
      });

      const isBullish = pt.close >= pt.open;
      volumes.push({
        time: chartTime,
        value: pt.volume ?? 0,
        color: isBullish ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
      });
    }

    return { candles, volumes };
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up prior chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    // Initialize chart
    const chart = createChart(container, {
      width: container.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(148, 163, 184, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: 'rgba(148, 163, 184, 0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add Candlestick series (TradingView green/red style)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries as any;

    // Add Volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#64748b',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay scale
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Load data
    if (data.length > 0) {
      const { candles, volumes } = formatDataForChart(data);
      candleSeries.setData(candles);
      volumeSeries.setData(volumes);
      chart.timeScale().fitContent();

      // Set initial hover state to latest candle
      const latest = data[data.length - 1];
      if (latest) {
        const diff = latest.close - latest.open;
        const pct = latest.open > 0 ? (diff / latest.open) * 100 : 0;
        setHoverData({
          time: latest.date,
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
          change: diff,
          changePercent: pct,
          volume: latest.volume,
        });
      }
    }

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        !param.seriesData ||
        !candleSeriesRef.current ||
        !param.seriesData.get(candleSeriesRef.current)
      ) {
        // Fall back to latest point
        const latest = data[data.length - 1];
        if (latest) {
          const diff = latest.close - latest.open;
          const pct = latest.open > 0 ? (diff / latest.open) * 100 : 0;
          setHoverData({
            time: latest.date,
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close,
            change: diff,
            changePercent: pct,
            volume: latest.volume,
          });
        }
        return;
      }

      const candleData = param.seriesData.get(candleSeriesRef.current) as CandlestickData;
      const volData = volumeSeriesRef.current
        ? (param.seriesData.get(volumeSeriesRef.current) as HistogramData)
        : null;

      if (candleData) {
        const diff = candleData.close - candleData.open;
        const pct = candleData.open > 0 ? (diff / candleData.open) * 100 : 0;
        const timeString =
          typeof param.time === 'number'
            ? new Date(param.time * 1000).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
            : String(param.time);

        setHoverData({
          time: timeString,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          change: diff,
          changePercent: pct,
          volume: volData ? volData.value : null,
        });
      }
    });

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  // Update data when props change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    const { candles, volumes } = formatDataForChart(data);
    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  // Update latest candle on live quote tick
  useEffect(() => {
    if (
      !candleSeriesRef.current ||
      currentLivePrice === null ||
      !Number.isFinite(currentLivePrice) ||
      data.length === 0
    ) {
      return;
    }

    const last = data[data.length - 1];
    if (!last) return;

    const lastTime = (typeof last.time === 'number' ? last.time : last.date) as Time;
    const newHigh = Math.max(last.high, currentLivePrice);
    const newLow = Math.min(last.low, currentLivePrice);

    candleSeriesRef.current.update({
      time: lastTime,
      open: last.open,
      high: newHigh,
      low: newLow,
      close: currentLivePrice,
    });
  }, [currentLivePrice]);

  return (
    <div className="relative w-full rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
      {/* Live / Crosshair Metric Header (TradingView Style) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {ticker && (
            <span className="font-mono text-sm font-bold text-foreground">
              {ticker}
            </span>
          )}
          {hoverData && (
            <>
              <span className="text-muted-foreground">{hoverData.time}</span>
              <div className="flex items-center gap-2 font-mono">
                <span>
                  O: <strong className="text-foreground">{formatCurrency(hoverData.open)}</strong>
                </span>
                <span>
                  H: <strong className="text-emerald-500">{formatCurrency(hoverData.high)}</strong>
                </span>
                <span>
                  L: <strong className="text-red-500">{formatCurrency(hoverData.low)}</strong>
                </span>
                <span>
                  C: <strong className="text-foreground">{formatCurrency(hoverData.close)}</strong>
                </span>
              </div>
            </>
          )}
        </div>

        {hoverData && (
          <div className="flex items-center gap-2 font-mono">
            <span
              className={`font-semibold ${hoverData.change >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
            >
              {hoverData.change >= 0 ? '+' : ''}
              {formatCurrency(hoverData.change)} ({hoverData.changePercent >= 0 ? '+' : ''}
              {hoverData.changePercent.toFixed(2)}%)
            </span>
            {hoverData.volume !== null && hoverData.volume > 0 && (
              <span className="text-muted-foreground">
                Vol: {Math.round(hoverData.volume).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Candlestick Canvas Container */}
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading candlestick data...
          </div>
        </div>
      )}

      {data.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No historical candlestick data available for this range.
        </div>
      )}
    </div>
  );
}
