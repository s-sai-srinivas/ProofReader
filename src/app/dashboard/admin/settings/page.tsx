import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import SettingsContainer from "./SettingsContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";

export const metadata = {
  title: "Settings Manager | ProofReader Admin",
  description: "Configure system thresholds, rate-limits, AI models, and readability scores.",
};

export default async function AdminSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // Double check settings permission
  if (!hasPermission(user, "settings:manage")) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[#030303]">
        <Card className="max-w-md w-full p-8 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-zinc-100">Access Denied</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This space is restricted to authorized administrator accounts only. You do not have permissions to access these tools.
            </p>
          </div>
          <Link href="/dashboard" className="w-full">
            <Button variant="glass" className="w-full text-sm">
              Return to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground animate-pulse-subtle">
          Loading administration settings panel...
        </div>
      }
    >
      <SettingsContainer />
    </Suspense>
  );
}
