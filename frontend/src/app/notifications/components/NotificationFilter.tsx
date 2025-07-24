import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";

interface NotificationFilterProps {
  currentFilter: "all" | "unread";
  onFilterChange: (filter: "all" | "unread") => void;
  unreadCount?: number;
}

export const NotificationFilter = ({
  currentFilter,
  onFilterChange,
  unreadCount,
}: NotificationFilterProps) => {
  const filters = [
    { key: "all" as const, label: "All", count: undefined },
    { key: "unread" as const, label: "Unread", count: unreadCount },
  ];

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1">
        {filters.map(({ key, label, count }) => (
          <Button
            key={key}
            variant={currentFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange(key)}
            className="relative"
          >
            {label}
            {count !== undefined && count > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs h-5 px-1.5">
                {count}
              </Badge>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
};
