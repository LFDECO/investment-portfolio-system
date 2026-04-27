import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  iconColor?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  iconColor = 'text-muted-foreground',
}: EmptyStateProps) {
  return (
    <Card className="p-12 text-center">
      <div className="flex flex-col items-center gap-4">
        {Icon && <Icon className={`w-12 h-12 ${iconColor}`} />}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {action && (
          <Button onClick={action.onClick} className="mt-4">
            {action.label}
          </Button>
        )}
      </div>
    </Card>
  );
}
