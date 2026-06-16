"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Series = { key: string; name: string; color: string };

/**
 * Multi-series rating trend. One <Line> per series; rows are wide records keyed
 * by a "label" x-value plus one numeric field per series key. Mirrors
 * RatingChart's axis/tooltip styling.
 */
export function MultiLineChart({
  data,
  series,
}: {
  data: Array<Record<string, string | number>>;
  series: Series[];
}) {
  if (data.length < 2) {
    return <p className="text-sm text-muted">Play a couple of sessions to see a rating trend.</p>;
  }
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DCE5DF" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5C6B63" }} tickLine={false} axisLine={{ stroke: "#DCE5DF" }} />
          <YAxis
            domain={[(min: number) => Math.floor(min - 15), (max: number) => Math.ceil(max + 15)]}
            tick={{ fontSize: 11, fill: "#5C6B63" }}
            tickLine={false}
            axisLine={false}
            width={48}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #DCE5DF",
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
            labelStyle={{ color: "#5C6B63" }}
            formatter={(value, name) => [Math.round(Number(value)), name]}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: s.color }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
