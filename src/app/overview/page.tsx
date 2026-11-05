"use client";

import { businessConfig } from "@/lib/business-config";
import { MessageSquare, Users, Bot, UserCheck, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Total conversations", value: "128", icon: MessageSquare, change: "+12%" },
  { label: "Open / Active", value: "23", icon: Users, change: "+3" },
  { label: "AI-handled", value: "89", icon: Bot, change: "70%" },
  { label: "Human handoffs", value: "14", icon: UserCheck, change: "11%" },
  { label: "Avg response time", value: "1.4m", icon: Clock, change: "-18s" },
  { label: "Resolved today", value: "31", icon: TrendingUp, change: "+8" },
];

export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="border-b border-navy-700 bg-navy-900 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{businessConfig.name} · Overview</h1>
          <p className="text-sm text-gray-400">WhatsApp AI Customer Support</p>
        </div>
        <Link
          href="/inbox"
          className="rounded-lg bg-accent hover:bg-accent-hover text-navy-950 text-sm font-medium px-4 py-2 transition"
        >
          Open Inbox
        </Link>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-navy-900 border border-navy-700 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{s.label}</span>
                <s.icon className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-semibold">{s.value}</div>
              <div className="text-xs text-emerald-400 mt-1">{s.change}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-navy-900 border border-navy-700 p-6">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Quick actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/inbox" className="px-4 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">
              Go to Inbox
            </Link>
            <Link href="/inbox?filter=awaiting_human" className="px-4 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">
              View open handoffs
            </Link>
            <Link href="/settings" className="px-4 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">
              Settings
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
