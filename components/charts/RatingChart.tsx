"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RatingPointData = { label: string; rating: number };

export function RatingChart({ data, color }: { data: RatingPointData[]; color: string }) {
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
            formatter={(value) => [Math.round(Number(value)), "rating"]}
          />
          <Line type="monotone" dataKey="rating" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
