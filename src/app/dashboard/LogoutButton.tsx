"use client";

import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { clientFetch } from "@/lib/client-fetch";

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await clientFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-all text-sm font-medium cursor-pointer disabled:opacity-40"
    >
      <LogOut className="w-4 h-4" />
      {isLoading ? "Signing out..." : "Sign Out"}
    </button>
  );
}
