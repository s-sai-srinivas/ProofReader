"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2, ArrowRight, BookOpen, MessageSquare, Feather, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import GlassPanel from "@/components/ui/GlassPanel";
import Card from "@/components/ui/Card";

interface DemoSuggestion {
  id: string;
  original: string;
  suggested: string;
  explanation: string;
  category: "grammar" | "clarity" | "tone";
  offsetStart: number;
  offsetEnd: number;
}

export default function Home() {
  const [demoText, setDemoText] = useState(
    "Its vital that we prioritize this task immediately. There is several things we should do to fix this, and we will get back to you in a short period of time."
  );

  const [suggestions, setSuggestions] = useState<DemoSuggestion[]>([
    {
      id: "s1",
      original: "Its",
      suggested: "It's",
      explanation: "Contraction of 'it is' requires an apostrophe.",
      category: "grammar",
      offsetStart: 0,
      offsetEnd: 3,
    },
    {
      id: "s2",
      original: "There is several things",
      suggested: "There are several things",
      explanation: "Subject-verb agreement: 'several things' is plural, so use 'are'.",
      category: "grammar",
      offsetStart: 45,
      offsetEnd: 67,
    },
    {
      id: "s3",
      original: "in a short period of time",
      suggested: "shortly",
      explanation: "Conciseness: Replace wordy phrases with single words.",
      category: "clarity",
      offsetStart: 125,
      offsetEnd: 150,
    },
  ]);

  const handleApplyDemoSuggestion = (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    const textBefore = demoText.slice(0, suggestion.offsetStart);
    const textAfter = demoText.slice(suggestion.offsetEnd);
    const newText = textBefore + suggestion.suggested + textAfter;

    setDemoText(newText);

    const remaining = suggestions.filter((s) => s.id !== id);
    const diff = suggestion.suggested.length - suggestion.original.length;
    const adjusted = remaining.map((s) => {
      if (s.offsetStart > suggestion.offsetStart) {
        return {
          ...s,
          offsetStart: s.offsetStart + diff,
          offsetEnd: s.offsetEnd + diff,
        };
      }
      return s;
    });

    setSuggestions(adjusted);
  };

  return (
    <div className="min-h-screen premium-gradient-bg text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">
              ProofReader
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#demo" className="hover:text-foreground transition-colors">Demo</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-16 md:py-24 flex flex-col gap-28">
        {/* Hero */}
        <section className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 flex flex-col gap-5 text-center lg:text-left items-center lg:items-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 animate-pulse-subtle">
              <Sparkles className="w-3.5 h-3.5" /> AI-Powered Proofreading
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08] text-transparent bg-clip-text bg-gradient-to-b from-white via-blue-100 to-blue-300/40">
              Perfect your writing, instantly.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Detect grammar slips, refine readability, and polish your vocabulary with a single click.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button variant="primary" className="w-full sm:w-auto px-8 gap-2 group">
                  Start Writing Free <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#demo" className="w-full sm:w-auto">
                <Button variant="glass" className="w-full sm:w-auto px-8">
                  See Demo
                </Button>
              </a>
            </div>
            <div className="flex items-center gap-5 mt-3 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" /> Free to start</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" /> No credit card</span>
            </div>
          </div>

          {/* Hero mockup */}
          <div className="flex-1 w-full max-w-xl animate-slide-up">
            <GlassPanel glow className="p-1.5 relative rounded-2xl">
              <div className="absolute top-2 left-4 flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-300/15" />
              </div>
              <div className="bg-surface-elevated/80 rounded-xl p-6 pt-10 border border-border flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="text-xs font-medium text-muted-foreground">Mock_Document.txt</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs text-muted-foreground mr-2">Grammar</span>
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-muted-foreground">Clarity</span>
                  </div>
                </div>
                <div className="text-muted-foreground font-mono text-sm leading-8 min-h-[100px]">
                  {demoText}
                </div>
              </div>
            </GlassPanel>
          </div>
        </section>

        {/* Live Demo */}
        <section id="demo" className="flex flex-col gap-12 scroll-mt-24">
          <div className="text-center flex flex-col gap-3 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-blue-200/40 bg-clip-text text-transparent">
              Experience the Live Proofreader
            </h2>
            <p className="text-muted-foreground">
              Click the suggestion cards on the right to accept improvements and watch the text refine.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-stretch">
            {/* Editor */}
            <div className="flex-[3] flex flex-col">
              <GlassPanel className="p-6 flex flex-col gap-4 h-full flex-1">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <Feather className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold text-sm">Interactive Editor</span>
                  </div>
                  <span className="text-xs bg-blue-500/5 border border-blue-500/10 px-2.5 py-1 rounded-md text-muted-foreground">
                    Words: {demoText.trim().split(/\s+/).length}
                  </span>
                </div>
                <div className="relative flex-1 min-h-[220px]">
                  <textarea
                    className="w-full h-full bg-transparent border-0 resize-none font-sans text-lg text-foreground focus:outline-none leading-relaxed placeholder:text-muted-foreground/30"
                    value={demoText}
                    onChange={(e) => setDemoText(e.target.value)}
                    placeholder="Type or paste your text here..."
                  />
                  {suggestions.length === 0 && (
                    <div className="absolute inset-0 bg-surface/30 backdrop-blur-sm flex flex-col items-center justify-center text-center gap-3 p-6 pointer-events-none rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-foreground">Looking Good!</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          All corrections accepted.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setDemoText("Its vital that we prioritize this task immediately. There is several things we should do to fix this, and we will get back to you in a short period of time.");
                          setSuggestions([
                            { id: "s1", original: "Its", suggested: "It's", explanation: "Contraction of 'it is' requires an apostrophe.", category: "grammar", offsetStart: 0, offsetEnd: 3 },
                            { id: "s2", original: "There is several things", suggested: "There are several things", explanation: "Subject-verb agreement: 'several things' is plural, so use 'are'.", category: "grammar", offsetStart: 45, offsetEnd: 67 },
                            { id: "s3", original: "in a short period of time", suggested: "shortly", explanation: "Conciseness: Replace wordy phrases with single words.", category: "clarity", offsetStart: 125, offsetEnd: 150 },
                          ]);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 pointer-events-auto cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Reset Demo
                      </button>
                    </div>
                  )}
                </div>
              </GlassPanel>
            </div>

            {/* Suggestions */}
            <div className="flex-[2] flex flex-col gap-3">
              <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Suggestions ({suggestions.length})
              </span>
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[360px] lg:max-h-[none]">
                {suggestions.map((suggestion) => (
                  <Card
                    key={suggestion.id}
                    className="p-4 flex flex-col gap-3 select-none border-l-2 border-l-blue-500"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {suggestion.category}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="line-through text-muted-foreground">{suggestion.original}</span>
                        <span className="text-blue-400">→</span>
                        <span className="font-bold text-foreground">{suggestion.suggested}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {suggestion.explanation}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs gap-1.5"
                      onClick={() => handleApplyDemoSuggestion(suggestion.id)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Apply
                    </Button>
                  </Card>
                ))}
                {suggestions.length === 0 && (
                  <div className="h-full flex items-center justify-center p-8 border border-dashed border-border rounded-xl bg-surface-elevated/30">
                    <span className="text-xs text-muted-foreground text-center">
                      No suggestions left.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="flex flex-col gap-12 scroll-mt-24">
          <div className="text-center flex flex-col gap-3 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-blue-200/40 bg-clip-text text-transparent">
              Built to refine your voice
            </h2>
            <p className="text-muted-foreground">
              ProofReader targets spelling, grammar, clarity, and style.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="flex flex-col gap-4 p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">Grammar & Syntax</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Catch spelling mistakes, comma splices, and subject-verb disagreements.
              </p>
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">Readability & Clarity</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Detect run-on sentences and wordy phrasing to make your points powerful.
              </p>
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">Tone Analysis</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Analyze tone and suggest custom adjustments for your writing style.
              </p>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10 bg-surface/50 text-center text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-foreground">ProofReader</span>
          </div>
          <span className="text-xs">
            © {new Date().getFullYear()} ProofReader Inc.
          </span>
        </div>
      </footer>
    </div>
  );
}
