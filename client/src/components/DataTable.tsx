import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  onSort?: (key: string) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  hoverable?: boolean;
  striped?: boolean;
}

export default function DataTable({
  columns,
  data,
  onSort,
  sortBy,
  sortOrder = 'asc',
  hoverable = true,
  striped = true,
}: DataTableProps) {
  const getAlignClass = (align?: string) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 ${getAlignClass(column.align)}`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => onSort?.(column.key)}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {column.label}
                      {sortBy === column.key && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">
                      {column.label}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`border-b border-border ${
                  hoverable ? 'hover:bg-muted/30 transition-colors' : ''
                } ${striped && rowIndex % 2 === 1 ? 'bg-muted/20' : ''}`}
              >
                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column.key}`}
                    className={`px-6 py-4 ${getAlignClass(column.align)}`}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No data available</p>
        </div>
      )}
    </Card>
  );
}
