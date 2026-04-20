/**
 * BookStatusPill — Dropdown pill for reading status switching
 */
import type { ReadingStatus } from "@readany/core/types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Ban,
  BookCheck,
  BookOpen,
  BookX,
  ChevronDown,
  Inbox,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const STATUS_CONFIG: Record<
  ReadingStatus,
  { icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  unread: { icon: Inbox, colorClass: "text-muted-foreground bg-muted" },
  reading: { icon: BookOpen, colorClass: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40" },
  finished: { icon: BookCheck, colorClass: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/40" },
  shelved: { icon: Ban, colorClass: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40" },
  dropped: { icon: BookX, colorClass: "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950/40" },
};

const STATUS_ORDER: ReadingStatus[] = [
  "unread",
  "reading",
  "finished",
  "shelved",
  "dropped",
];

interface BookStatusPillProps {
  status: ReadingStatus;
  onChange: (status: ReadingStatus) => void;
}

export function BookStatusPill({ status, onChange }: BookStatusPillProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${config.colorClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {t(`bookInfo.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="center"
          sideOffset={4}
          className="z-50 min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          {STATUS_ORDER.map((s) => {
            const sc = STATUS_CONFIG[s];
            const SIcon = sc.icon;
            return (
              <DropdownMenu.Item
                key={s}
                onSelect={() => onChange(s)}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-muted ${
                  s === status ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                <SIcon className="h-4 w-4" />
                {t(`bookInfo.status${s.charAt(0).toUpperCase() + s.slice(1)}`)}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
