import { redirect } from "next/navigation";
import React from "react";
import Link from "next/link";
import { Plus, FileText, ChevronRight, AlertCircle } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getUserMetrics } from "@/lib/metrics";
import { logError } from "@/lib/logger";
import { db } from "@/lib/db";
import DashboardAnalytics from "./DashboardAnalytics";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export const metadata = {
  title: "Workspace Dashboard | ProofReader",
  description: "View recent document history, check writing quality gauge indices, and evaluate syllable metrics.",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  
  if (!user) {
    redirect("/login");
  }

  let metricsError = false;
  let totalDocs = 0;
  let totalWordsScanned = 0;
  let totalCorrectionsDetected = 0;
  let averageQualityScore = 100;
  let categoryBreakdown: Record<string, number> = { GRAMMAR: 0, CLARITY: 0, TONE: 0, STYLE: 0 };
  interface HistoricalItem {
    id: string;
    title: string;
    date: string;
    wordCount: number;
    qualityScore: number;
    correctionsCount: number;
  }

  interface DocumentItem {
    id: string;
    title: string;
    wordCount: number;
    status: string;
    corrections: Array<{ id: string; category: string }>;
  }

  let historicalActivity: HistoricalItem[] = [];
  let documents: DocumentItem[] = [];
  type CategoryRow = Pick<Awaited<ReturnType<typeof db.category.findMany>>[number], "id" | "name" | "label" | "color">;
  let categories: CategoryRow[] = [];

  try {
    categories = await db.category.findMany({
      where: {
        isActive: true,
        OR: [
          { orgId: null },
          { orgId: user.orgId },
        ],
      },
      orderBy: { sortOrder: "asc" },
    });

    const metrics = await getUserMetrics(user.id, user.orgId);
    totalDocs = metrics.totalDocuments;
    totalWordsScanned = metrics.totalWordsScanned;
    totalCorrectionsDetected = metrics.totalCorrectionsDetected;
    averageQualityScore = metrics.averageQualityScore;
    categoryBreakdown = metrics.categoryBreakdown;
    historicalActivity = metrics.historicalActivity;
    documents = metrics.documents;
  } catch (error) {
    metricsError = true;
    logError("DASHBOARD_METRICS_QUERY_FAILED", error, { userId: user.id, orgId: user.orgId });
    categories = [
      { id: "grammar", name: "GRAMMAR", label: "Grammar & Spelling", color: "#22c55e" },
      { id: "clarity", name: "CLARITY", label: "Conciseness & Clarity", color: "#3b82f6" },
      { id: "tone", name: "TONE", label: "Tone & Engagement", color: "#f59e0b" },
      { id: "style", name: "STYLE", label: "Formatting & Style", color: "#ec4899" },
    ];
  }

  // Documents list ordered descending for display history
  const displayDocuments = documents;

  return (
    <div className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-6xl w-full mx-auto select-none">
      {/* Header and Welcome */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {user.name}</h1>
          <p className="text-muted-foreground text-sm">
            Here is an overview of your recent documents and writing health.
          </p>
        </div>
        <Link href="/dashboard/editor">
          <Button variant="primary" size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> New Document
          </Button>
        </Link>
      </div>

      {metricsError && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 animate-pulse" />
          <span>
            <strong>Database connection degraded.</strong> Metrics dashboard is running in offline/cached mode. Document list might be incomplete.
          </span>
        </div>
      )}

      {/* Dynamic Hand-Crafted Charts Display */}
      <DashboardAnalytics
        totalDocuments={totalDocs}
        totalWordsScanned={totalWordsScanned}
        totalCorrectionsDetected={totalCorrectionsDetected}
        averageQualityScore={averageQualityScore}
        categoryBreakdown={categoryBreakdown}
        historicalActivity={historicalActivity}
        categories={categories}
      />

      {/* Document History section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-zinc-200">Recent Documents</h2>
        
        {displayDocuments.length > 0 ? (
          <div className="flex flex-col gap-4">
            {displayDocuments.map((doc) => (
              <Card
                key={doc.id}
                className="flex items-center justify-between p-5 hover:bg-white/[0.02] border border-white/5"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-zinc-200 truncate">{doc.title}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{doc.wordCount} words</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                      <span>{doc.corrections.length} corrections found</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        doc.status === "DRAFT" 
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                  </div>
                </div>

                <Link href={`/dashboard/editor?id=${doc.id}`}>
                  <Button variant="glass" size="sm" className="gap-1 px-3.5 py-1">
                    Open <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/5 rounded-2xl bg-white/[0.01] text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
              <FileText className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="font-bold text-lg text-zinc-200">No documents found</h3>
              <p className="text-xs text-muted-foreground">
                You haven&apos;t created any proofreading documents yet. Click the button below to get started!
              </p>
            </div>
            <Link href="/dashboard/editor">
              <Button variant="primary" size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Create First Document
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
