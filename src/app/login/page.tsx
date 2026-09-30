import React, { Suspense } from "react";
import LoginContainer from "./LoginContainer";

export const metadata = {
  title: "Sign In | ProofReader",
  description: "Sign in to access your proofreading workspace.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen premium-gradient-bg text-foreground flex items-center justify-center p-6 select-none">
      <Suspense fallback={
        <div className="text-sm text-muted-foreground animate-pulse-subtle">
          Loading login workspace...
        </div>
      }>
        <LoginContainer />
      </Suspense>
    </div>
  );
}
