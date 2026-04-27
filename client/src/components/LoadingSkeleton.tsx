import { Card } from '@/components/ui/card';

interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'table' | 'chart';
  height?: string;
}

export default function LoadingSkeleton({
  count = 1,
  type = 'card',
  height = 'h-12',
}: LoadingSkeletonProps) {
  if (type === 'card') {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="p-6 animate-fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="space-y-3">
              <div className="h-3 animate-shimmer rounded-lg w-1/3" />
              <div className="h-7 animate-shimmer rounded-lg w-1/2" />
              <div className="h-3 animate-shimmer rounded-lg w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <Card className="overflow-hidden">
        <div className="space-y-3 p-6">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex gap-4 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="h-4 animate-shimmer rounded-lg flex-1" />
              <div className="h-4 animate-shimmer rounded-lg flex-1" />
              <div className="h-4 animate-shimmer rounded-lg flex-1" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (type === 'chart') {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className={`${height} animate-shimmer rounded-full w-full max-w-xs`} />
          <div className="h-3 animate-shimmer rounded-lg w-1/3" />
        </div>
      </Card>
    );
  }

  return null;
}
