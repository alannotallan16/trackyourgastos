"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Area,
  AreaChart
} from "recharts";

export const CHART_COLORS = [
  "#10B981", // green
  "#2563EB", // blue
  "#8B5CF6", // purple
  "#F59E0B", // orange
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#64748B", // gray
  "#0D1B2A"  // navy
];

const AXIS_TICK = { fontSize: 11, fill: "#64748B" };
const GRID_STROKE = "#E2E8F0";

export function MonthlyTrendChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#10B981"
          strokeWidth={2.5}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          stroke="#FFFFFF"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PaidByBar({ data }: { data: { name: string; paid: number; share: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="paid" fill="#10B981" radius={[6, 6, 0, 0]} />
        <Bar dataKey="share" fill="#2563EB" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
