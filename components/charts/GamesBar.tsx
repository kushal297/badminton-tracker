"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Games played per day over a window — vertical court-green bars. */
export function GamesBar({ data }: { data: { label: string; games: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No games in this window yet.</p>;
  }
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DCE5DF" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5C6B63" }} tickLine={false} axisLine={{ stroke: "#DCE5DF" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#5C6B63" }}
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "#E7F1EB" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #DCE5DF",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
            labelStyle={{ color: "#5C6B63" }}
            formatter={(value) => [Number(value), "games"]}
          />
          <Bar dataKey="games" fill="#0B6E4F" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
