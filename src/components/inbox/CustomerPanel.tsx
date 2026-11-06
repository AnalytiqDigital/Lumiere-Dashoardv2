"use client";

import { cn } from "@/lib/utils";
import { Phone, Tag, StickyNote, UserCheck, X } from "lucide-react";

interface Props {
  customer: {
    name: string;
    phone: string;
    tags?: string[];
    notes?: string;
    status: string;
    summary?: string;
  } | null;
  onClose?: () => void;
  onTakeover?: () => void;
  onCloseHandoff?: () => void;
  actionPending?: boolean;
  className?: string;
}

export function CustomerPanel({
  customer,
  onClose,
  onTakeover,
  onCloseHandoff,
  actionPending = false,
  className,
}: Props) {
  if (!customer) {
    return (
      <div className={cn("hidden lg:flex w-72 border-l border-navy-700 bg-navy-900/40 items-center justify-center text-gray-500 text-sm", className)}>
        Select a conversation
      </div>
    );
  }

  return (
    <div className={cn("w-full lg:w-72 border-l border-navy-700 bg-navy-900/40 flex flex-col", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700">
        <h3 className="text-sm font-medium text-white">Customer</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-navy-700 text-gray-400 lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Identity */}
        <div>
          <div className="text-base font-medium text-white">{customer.name}</div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-1">
            <Phone className="w-3.5 h-3.5" />
            {customer.phone}
          </div>
          {customer.summary && (
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{customer.summary}</p>
          )}
        </div>

        {/* Status */}
        <div>
          <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Status</div>
          <span className="inline-block text-xs px-2 py-1 rounded-full bg-accent/20 text-accent font-medium capitalize">
            {customer.status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
            <Tag className="w-3 h-3" /> Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(customer.tags && customer.tags.length > 0) ? (
              customer.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded bg-navy-700 text-gray-300">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-600">No tags</span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
            <StickyNote className="w-3 h-3" /> Notes
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            {customer.notes || "No notes yet."}
          </p>
        </div>

        {/* Handoff actions */}
        <div className="pt-2 space-y-2">
          <button
            onClick={onTakeover}
            disabled={actionPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent hover:bg-accent-hover text-navy-950 text-sm font-medium py-2.5 transition"
          >
            <UserCheck className="w-4 h-4" />
            Take over conversation
          </button>
          {onCloseHandoff && (
            <button
              onClick={onCloseHandoff}
              disabled={actionPending}
              className="w-full rounded-lg border border-navy-600 hover:bg-navy-800 text-gray-300 text-sm py-2.5 transition disabled:opacity-50"
            >
              {actionPending ? "Closing…" : "Mark as resolved / close"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
