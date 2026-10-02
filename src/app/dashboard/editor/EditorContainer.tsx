"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Sparkles, Save, Feather, Check, AlertCircle, Edit3, Eye } from "lucide-react";
import Link from "next/link";
import { clientFetch } from "@/lib/client-fetch";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface LocalCorrection {
  id: string;
  category: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
  offsetStart: number;
  offsetEnd: number;
}

interface CategoryInfo {
  id: string;
  name: string;
  label: string;
  color: string;
}

export default function EditorContainer() {
  // Read `?id=` lazily on mount — render-time useSearchParams() stalls
  // hydration under the static Suspense shell on this deployment target.
  const [documentId, setDocumentId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setDocumentId(id);
  }, []);
  const [title, setTitle] = useState("Untitled Document");
  const [content, setContent] = useState("");
  const [suggestions, setSuggestions] = useState<LocalCorrection[]>([]);
  const [version, setVersion] = useState<number>(0);
  const [editMode, setEditMode] = useState<"WRITE" | "REVIEW">("WRITE");
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("Saved");
  const [error, setError] = useState("");

  const versionRef = useRef<number>(0);
  useEffect(() => { versionRef.current = version; }, [version]);

  interface FetchCorrection {
    id?: string;
    category: string;
    originalText: string;
    suggestedText: string;
    explanation: string;
    offsetStart: number;
    offsetEnd: number;
  }

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await clientFetch("/api/categories");
        if (res.ok) setCategories(await res.json() as CategoryInfo[]);
      } catch (err) { console.error("Failed to load categories:", err); }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!documentId) return;
    const fetchDocument = async () => {
      setIsFetching(true);
      setError("");
      try {
        const res = await clientFetch(`/api/documents?id=${documentId}`);
        if (!res.ok) throw new Error("Failed to fetch document");
        const data = await res.json();
        setTitle(data.title);
        setContent(data.originalContent);
        setVersion(data.version || 0);
        if (data.corrections) {
          setSuggestions(
            (data.corrections as FetchCorrection[]).map((c, idx) => ({
              id: c.id || `c-${idx}-${Date.now()}`,
              category: c.category,
              originalText: c.originalText,
              suggestedText: c.suggestedText,
              explanation: c.explanation,
              offsetStart: c.offsetStart,
              offsetEnd: c.offsetEnd,
            }))
          );
        }
      } catch (err) {
        console.error("Fetch document error:", err);
        setError("Could not load your document");
      } finally {
        setIsFetching(false);
      }
    };
    fetchDocument();
  }, [documentId]);

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const saveDocument = async (currentTitle: string, currentContent: string, currentSuggestions: LocalCorrection[]) => {
    if (!isMounted.current) return;
    setIsSaving(true);
    setAutosaveStatus("Saving...");
    try {
      const res = await clientFetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: documentId, title: currentTitle, content: currentContent, corrections: currentSuggestions, version: versionRef.current }),
      });
      if (!isMounted.current) return;
      if (res.status === 409) { setError("Sync Conflict: document modified in another session."); setAutosaveStatus("Conflict"); return; }
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      if (!isMounted.current) return;
      if (!documentId && data.id) { setDocumentId(data.id); window.history.replaceState(null, "", `/dashboard/editor?id=${data.id}`); }
      setVersion(data.version || 0);
      setAutosaveStatus("Saved");
    } catch (error) {
      console.error("Autosave error:", error);
      if (isMounted.current) setAutosaveStatus("Unsaved");
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    setAutosaveStatus("Unsaved");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveDocument(title, text, suggestions), 1500);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value || "Untitled Document";
    setTitle(e.target.value);
    setAutosaveStatus("Unsaved");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveDocument(newTitle, content, suggestions), 1500);
  };

  const handleRunProofreader = async () => {
    if (!content.trim()) return;
    setIsScanning(true);
    setError("");
    try {
      const res = await clientFetch("/api/proofread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to scan document");
      const data = await res.json();
      interface ProofreadCorrection { id?: string; category: string; originalText: string; suggestedText: string; explanation: string; offsetStart: number; offsetEnd: number; }
      const mappedCorrections = (data as ProofreadCorrection[]).map((c, index) => ({
        id: c.id || `c-${index}-${Date.now()}`, category: c.category, originalText: c.originalText, suggestedText: c.suggestedText, explanation: c.explanation, offsetStart: c.offsetStart, offsetEnd: c.offsetEnd,
      }));
      if (isMounted.current) { setSuggestions(mappedCorrections); setEditMode("REVIEW"); setSelectedCorrectionId(null); }
      await saveDocument(title, content, mappedCorrections);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred during scanning";
      console.error("Proofread error:", err);
      if (isMounted.current) setError(errorMsg);
    } finally {
      if (isMounted.current) setIsScanning(false);
    }
  };

  const handleApplySuggestion = (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    if (!suggestion) return;
    const before = content.slice(0, suggestion.offsetStart);
    const after = content.slice(suggestion.offsetEnd);
    const updatedText = before + suggestion.suggestedText + after;
    setContent(updatedText);
    setAutosaveStatus("Unsaved");
    const remaining = suggestions.filter((s) => s.id !== id);
    const diff = suggestion.suggestedText.length - suggestion.originalText.length;
    const adjusted = remaining.map((s) => {
      if (s.offsetStart > suggestion.offsetStart) return { ...s, offsetStart: s.offsetStart + diff, offsetEnd: s.offsetEnd + diff };
      return s;
    });
    setSuggestions(adjusted);
    if (selectedCorrectionId === id) setSelectedCorrectionId(null);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveDocument(title, updatedText, adjusted);
  };

  const renderHighlightedText = () => {
    if (suggestions.length === 0) {
      return (
        <div className="whitespace-pre-wrap leading-relaxed text-foreground text-lg">
          {content || <span className="text-muted-foreground/30 italic">Write something to proofread...</span>}
        </div>
      );
    }
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    const sorted = [...suggestions]
      .filter((c) => c.offsetStart >= 0 && c.offsetEnd <= content.length && c.offsetStart < c.offsetEnd)
      .sort((a, b) => a.offsetStart - b.offsetStart);
    for (let i = 0; i < sorted.length; i++) {
      const correction = sorted[i];
      if (correction.offsetStart < lastIndex) continue;
      if (correction.offsetStart > lastIndex) elements.push(<span key={`text-${lastIndex}-${correction.offsetStart}`}>{content.slice(lastIndex, correction.offsetStart)}</span>);
      const isSelected = selectedCorrectionId === correction.id;
      const categoryInfo = categories.find((c) => c.name === correction.category);
      const color = categoryInfo?.color || "#3b82f6";
      const originalWord = content.slice(correction.offsetStart, correction.offsetEnd);
      elements.push(
        <span
          key={`highlight-${correction.id}`}
          onClick={() => { setSelectedCorrectionId(correction.id); document.getElementById(`card-${correction.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
          style={{
            borderBottom: `2px solid ${isSelected ? color : `${color}66`}`,
            backgroundColor: isSelected ? `${color}20` : `${color}08`,
            boxShadow: isSelected ? `0 0 0 1px ${color}40` : "none",
            borderRadius: isSelected ? "3px" : "none",
          }}
          className="px-0.5 py-px cursor-pointer font-medium transition-all duration-150 text-foreground"
          title={`${categoryInfo?.label || correction.category}: ${correction.explanation}`}
        >
          {originalWord}
        </span>
      );
      lastIndex = correction.offsetEnd;
    }
    if (lastIndex < content.length) elements.push(<span key={`text-end-${lastIndex}`}>{content.slice(lastIndex)}</span>);
    return <div className="whitespace-pre-wrap leading-relaxed text-foreground text-lg">{elements}</div>;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border px-5 flex items-center justify-between gap-4 flex-shrink-0 bg-surface/50 backdrop-blur-md">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/dashboard" className="p-2 hover:bg-blue-500/5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <input
            className="bg-transparent border-0 font-semibold text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 min-w-0 max-w-sm truncate"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Document"
          />
          <span className="text-[10px] bg-blue-500/5 px-2 py-0.5 border border-blue-500/10 rounded font-medium text-muted-foreground select-none">
            {autosaveStatus}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-elevated border border-border rounded-lg p-0.5 select-none">
            <button onClick={() => setEditMode("WRITE")} className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${editMode === "WRITE" ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-muted-foreground hover:text-foreground"}`}>
              <Edit3 className="w-3 h-3" /> Write
            </button>
            <button onClick={() => setEditMode("REVIEW")} className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${editMode === "REVIEW" ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-muted-foreground hover:text-foreground"}`}>
              <Eye className="w-3 h-3" /> Review
            </button>
          </div>
          <Button variant="glass" size="sm" onClick={() => saveDocument(title, content, suggestions)} isLoading={isSaving}>
            <Save className="w-3.5 h-3.5 mr-1.5" /> Save
          </Button>
          <Button variant="primary" size="sm" onClick={handleRunProofreader} isLoading={isScanning} disabled={!content.trim()}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Proofread
          </Button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/5 border-b border-red-500/15 text-red-400 text-xs py-2 px-5 flex items-center justify-between gap-4 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="hover:bg-red-500/10 px-2 py-0.5 rounded text-red-400/70 hover:text-red-400 transition-colors text-[10px] font-bold uppercase tracking-wider">Dismiss</button>
        </div>
      )}

      {/* Split view */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch overflow-hidden min-h-0">
        {/* Text editor */}
        <div className="flex-[3] flex flex-col p-5 overflow-y-auto border-r border-border">
          {isFetching ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground animate-pulse-subtle">Loading document...</div>
          ) : (
            <div className="flex-1 flex flex-col h-full min-h-0">
              {editMode === "WRITE" ? (
                <textarea className="w-full flex-1 bg-transparent border-0 resize-none font-sans text-base text-foreground focus:outline-none leading-relaxed placeholder:text-muted-foreground/25 min-h-[300px]" value={content} onChange={handleTextChange} placeholder="Type or paste your text here..." />
              ) : (
                <div className="w-full flex-1 min-h-[300px] rounded-md focus:outline-none overflow-y-auto">{renderHighlightedText()}</div>
              )}
              <div className="flex items-center justify-between mt-3 border-t border-border pt-3 text-[10px] font-semibold text-muted-foreground select-none">
                <span>Words: {content.trim() ? content.trim().split(/\s+/).length : 0}</span>
                <span>Chars: {content.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions sidebar */}
        <div className="flex-[2] flex flex-col p-5 bg-surface/50 overflow-y-auto min-w-[300px] max-w-[440px]">
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground select-none">
              Suggestions ({suggestions.length})
            </span>
            <div className="flex flex-col gap-3">
              {suggestions.map((suggestion) => {
                const isFocused = selectedCorrectionId === suggestion.id;
                const categoryInfo = categories.find((c) => c.name === suggestion.category);
                const color = categoryInfo?.color || "#3b82f6";
                const label = categoryInfo?.label || suggestion.category;
                return (
                  <Card
                    key={suggestion.id}
                    id={`card-${suggestion.id}`}
                    onClick={() => setSelectedCorrectionId(suggestion.id)}
                    style={{ borderLeft: `3px solid ${color}`, boxShadow: isFocused ? `0 0 0 1px ${color}40` : "none" }}
                    className="p-3.5 flex flex-col gap-2.5 select-none transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}25` }} className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        {label}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="line-through text-muted-foreground">{suggestion.originalText}</span>
                        <span className="text-blue-400">→</span>
                        <span className="font-bold text-foreground">{suggestion.suggestedText}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.explanation}</p>
                    <Button variant="primary" size="sm" className="w-full text-[10px] gap-1 h-8" onClick={(e) => { e.stopPropagation(); handleApplySuggestion(suggestion.id); }}>
                      <Check className="w-3 h-3" /> Accept
                    </Button>
                  </Card>
                );
              })}
              {suggestions.length === 0 && (
                <div className="flex flex-col items-center justify-center p-10 border border-dashed border-border rounded-xl text-center gap-3 bg-surface-elevated/30 select-none">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400">
                    <Feather className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">No suggestions</h4>
                    <p className="text-[10px] text-muted-foreground mt-1">Type text and click Proofreader</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
