"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import Card from "@/components/ui/Card";

interface ActivityRecord {
  id: string;
  title: string;
  date: string;
  wordCount: number;
  qualityScore: number;
  correctionsCount: number;
}

interface CategoryMeta {
  id: string;
  name: string;
  label: string;
  color: string;
}

interface DashboardAnalyticsProps {
  totalDocuments: number;
  totalWordsScanned: number;
  totalCorrectionsDetected: number;
  averageQualityScore: number;
  categoryBreakdown: Record<string, number>;
  historicalActivity: ActivityRecord[];
  categories: CategoryMeta[];
}

const BLUE_SHADES = ["#3b82f6", "#60a5fa", "#2563eb", "#93c5fd", "#1d4ed8", "#a5b4fc"];

export default function DashboardAnalytics({
  totalDocuments,
  averageQualityScore,
  categoryBreakdown,
  historicalActivity,
  categories,
}: DashboardAnalyticsProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ActivityRecord | null>(null);

  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (averageQualityScore / 100) * circumference;

  const counts = Object.values(categoryBreakdown);
  const maxCategoryCount = Math.max(1, ...counts);

  const chartDocs = historicalActivity.slice(-7);
  const chartWidth = 500;
  const chartHeight = 200;
  const paddingX = 40;
  const paddingY = 30;

  const points = chartDocs.map((doc, idx) => {
    const x =
      chartDocs.length > 1
        ? paddingX + (idx / (chartDocs.length - 1)) * (chartWidth - paddingX * 2)
        : chartWidth / 2;
    const y =
      chartHeight -
      paddingY -
      (doc.qualityScore / 100) * (chartHeight - paddingY * 2);
    return { x, y, doc };
  });

  let linePath = "";
  let areaPath = "";

  if (points.length > 0) {
    if (points.length === 1) {
      linePath = `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`;
    } else {
      linePath = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        linePath += ` L ${points[i].x} ${points[i].y}`;
      }
      areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;
    }
  }

  let advice = "Write some content and run proofreading to see your health trends.";

  if (totalDocuments > 0) {
    if (averageQualityScore >= 90) {
      advice = "Your writing is extremely precise. Maintain high readability scores.";
    } else if (averageQualityScore >= 75) {
      advice = "Great work! Resolve minor flags to achieve perfect polish.";
    } else {
      advice = "Focus on grammar and clarity. Watch the gauge trend upward.";
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full select-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Radial Gauge */}
        <Card className="flex flex-col justify-between p-5 h-full">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm font-semibold text-foreground">Writing Score</span>
            <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider">Average</span>
          </div>

          <div className="flex items-center justify-center py-5 relative">
            <svg width={140} height={140} className="transform -rotate-90">
              <defs>
                <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
              </defs>

              <circle
                cx={70}
                cy={70}
                r={radius}
                fill="transparent"
                stroke="rgba(59, 130, 246, 0.08)"
                strokeWidth={strokeWidth}
              />

              <circle
                cx={70}
                cy={70}
                r={radius}
                fill="transparent"
                stroke="url(#gauge-grad)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                filter="url(#gauge-glow)"
                style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">
                {averageQualityScore}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                Quality Index
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-500/5 p-3 border border-blue-500/10 rounded-lg leading-relaxed">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>{advice}</span>
          </div>
        </Card>

        {/* Category Breakdown */}
        <Card className="flex flex-col justify-between p-5 h-full">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm font-semibold text-foreground">Categories</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Count</span>
          </div>

          <div className="flex flex-col gap-3.5 py-4">
            {categories.map((cat, idx) => {
              const count = categoryBreakdown[cat.name.toUpperCase()] || 0;
              const color = BLUE_SHADES[idx % BLUE_SHADES.length];
              const pct = maxCategoryCount > 0 ? (count / maxCategoryCount) * 100 : 0;
              return (
                <div key={cat.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{cat.label}</span>
                    <span className="text-foreground">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-blue-500/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}33`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* History Chart */}
        <Card className="flex flex-col justify-between p-5 h-full">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-sm font-semibold text-foreground">Quality Trend</span>
            <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider">History</span>
          </div>

          <div className="py-4 relative">
            {chartDocs.length > 0 ? (
              <div className="w-full">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-auto overflow-visible"
                >
                  <defs>
                    <linearGradient id="chart-area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="chart-line-glow" x="-10%" y="-10%" width="120%" height="120%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = paddingY + pct * (chartHeight - paddingY * 2);
                    return (
                      <line
                        key={idx}
                        x1={paddingX}
                        y1={y}
                        x2={chartWidth - paddingX}
                        y2={y}
                        stroke="rgba(59, 130, 246, 0.06)"
                        strokeDasharray="4"
                      />
                    );
                  })}

                  {areaPath && (
                    <path d={areaPath} fill="url(#chart-area-grad)" style={{ transition: "all 0.5s ease" }} />
                  )}

                  {linePath && (
                    <path
                      d={linePath}
                      fill="transparent"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      strokeLinecap="round"
                      filter="url(#chart-line-glow)"
                      style={{ transition: "all 0.5s ease" }}
                    />
                  )}

                  {points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPoint?.id === p.doc.id ? 6 : 4}
                      fill={hoveredPoint?.id === p.doc.id ? "#60a5fa" : "#3b82f6"}
                      stroke="#040810"
                      strokeWidth={2}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredPoint(p.doc)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}
                </svg>

                <div className="h-5 flex items-center justify-center text-[10px] font-semibold text-muted-foreground select-none mt-2">
                  {hoveredPoint ? (
                    <span className="text-foreground animate-fade-in truncate max-w-full">
                      {hoveredPoint.title}: <strong className="text-blue-400">{hoveredPoint.qualityScore}</strong> score ({hoveredPoint.wordCount} words)
                    </span>
                  ) : (
                    <span>Hover to trace document scores</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center border border-dashed border-border rounded-lg text-xs text-muted-foreground/60 p-4 text-center">
                Create documents to plot your quality trends
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
