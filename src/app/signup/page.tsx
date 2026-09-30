import React, { Suspense } from "react";
import SignupContainer from "./SignupContainer";

export const metadata = {
  title: "Create Account | ProofReader",
  description: "Join ProofReader to get instant grammar, style, and tone proofreading scans.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen premium-gradient-bg text-foreground flex items-center justify-center p-6 select-none">
      <Suspense fallback={
        <div className="text-sm text-muted-foreground animate-pulse-subtle">
          Loading registration workspace...
        </div>
      }>
        <SignupContainer />
      </Suspense>
    </div>
  );
}
