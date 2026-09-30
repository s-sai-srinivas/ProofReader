import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, LayoutDashboard, FileEdit, Sliders, Tag, Settings } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import { hasPermission } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-60 bg-surface border-b md:border-b-0 md:border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-14 px-5 border-b border-border flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            ProofReader
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider select-none">
            Workspace
          </span>
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-blue-500/5 transition-all text-sm font-medium group"
          >
            <LayoutDashboard className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/editor"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-blue-500/5 transition-all text-sm font-medium group"
          >
            <FileEdit className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
            New Document
          </Link>

          {(hasPermission(user, "rules:manage") ||
            hasPermission(user, "categories:manage") ||
            hasPermission(user, "settings:manage")) && (
            <>
              <span className="text-[10px] font-semibold text-muted-foreground px-3 py-2 mt-3 uppercase tracking-wider select-none">
                Admin
              </span>
              {hasPermission(user, "rules:manage") && (
                <Link
                  href="/dashboard/admin/rules"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-blue-500/5 transition-all text-sm font-medium group"
                >
                  <Sliders className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                  Rules
                </Link>
              )}
              {hasPermission(user, "categories:manage") && (
                <Link
                  href="/dashboard/admin/categories"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-blue-500/5 transition-all text-sm font-medium group"
                >
                  <Tag className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                  Categories
                </Link>
              )}
              {hasPermission(user, "settings:manage") && (
                <Link
                  href="/dashboard/admin/settings"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-blue-500/5 transition-all text-sm font-medium group"
                >
                  <Settings className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                  Settings
                </Link>
              )}
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-xs">
              {user.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate text-foreground">{user.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {children}
      </main>
    </div>
  );
}
