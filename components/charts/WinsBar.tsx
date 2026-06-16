"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type WinsDatum = { name: string; wins: number; color: string };

/** Wins per player — horizontal bars, each tinted with the player's own accent. */
export function WinsBar({ data }: { data: WinsDatum[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No games in this window yet.</p>;
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#5C6B63" }}
            tickLine={false}
            axisLine={{ stroke: "#DCE5DF" }}
            allowDecimals={false}
            domain={[0, "dataMax"]}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#5C6B63" }}
            tickLine={false}
            axisLine={false}
            width={64}
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
            formatter={(value) => [Number(value), "wins"]}
          />
          <Bar dataKey="wins" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
