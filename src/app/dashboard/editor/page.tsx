import React, { Suspense } from "react";
import EditorContainer from "./EditorContainer";

export const metadata = {
  title: "Proofreading Editor | ProofReader",
  description: "Perfect your document structure and word choices.",
};

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground animate-pulse-subtle">
        Loading editor workspace...
      </div>
    }>
      <EditorContainer />
    </Suspense>
  );
}
