"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  RotateCcw,
  Sliders,
  Settings,
  Brain,
  Shield,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  Clock,
  Activity
} from "lucide-react";
import { clientFetch } from "@/lib/client-fetch";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import GlassPanel from "@/components/ui/GlassPanel";

interface SettingItem {
  id: string;
  key: string;
  label: string;
  value: unknown;
  type: string;
  category: string;
  updatedAt: string;
}

interface GradeLevel {
  min: number;
  label: string;
}

type CategoryWeights = Record<string, number>;

export default function SettingsContainer() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [originalSettings, setOriginalSettings] = useState<SettingItem[]>([]);
  const [activeTab, setActiveTab] = useState<"general" | "rate-limit" | "ai" | "scoring">("general");
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Live tester states
  const [testFleschScore, setTestFleschScore] = useState(65);
  const [testText, setTestText] = useState("It is vital that we prioritize this immediately.");
  
  const fetchSettings = useCallback(async () => {
    setIsFetching(true);
    setError("");
    try {
      const res = await clientFetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      setSettings(data);
      setOriginalSettings(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retrieve settings");
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSettings();
    });
  }, [fetchSettings]);

  // Safe timer for success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handle standard setting input change
  const handleSettingChange = (key: string, newValue: string | number | boolean | GradeLevel[] | CategoryWeights) => {
    setSettings((prev) =>
      prev.map((s) => {
        if (s.key === key) {
          return { ...s, value: newValue };
        }
        return s;
      })
    );
  };

  // Reset to original fetched settings
  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    setError("");
    setSuccess("Settings reverted to saved values.");
  };

  // Submit all settings
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    // Validate settings before saving
    for (const setting of settings) {
      if (setting.key === "password_min_length") {
        const val = Number(setting.value);
        if (isNaN(val) || val < 4 || val > 32) {
          setError("Minimum password length must be between 4 and 32 characters.");
          setIsSubmitting(false);
          return;
        }
      }
      if (setting.key === "gemini_timeout_ms") {
        const val = Number(setting.value);
        if (isNaN(val) || val < 1000 || val > 120000) {
          setError("AI timeout must be between 1,000ms (1s) and 120,000ms (2m).");
          setIsSubmitting(false);
          return;
        }
      }
      if (setting.key === "rate_limit_proofread_limit") {
        const val = Number(setting.value);
        if (isNaN(val) || val < 1 || val > 200) {
          setError("Proofreading rate limit must be between 1 and 200 scans per minute.");
          setIsSubmitting(false);
          return;
        }
      }
      if (setting.key === "grade_levels") {
        if (!Array.isArray(setting.value) || setting.value.length === 0) {
          setError("Grade levels must contain at least one row.");
          setIsSubmitting(false);
          return;
        }
        for (const row of setting.value) {
          const min = Number(row.min);
          if (isNaN(min) || min < 0 || min > 100) {
            setError("All grade level thresholds must be a valid number between 0 and 100.");
            setIsSubmitting(false);
            return;
          }
          if (!row.label || row.label.trim().length === 0) {
            setError("All grade level rows must have a label.");
            setIsSubmitting(false);
            return;
          }
        }
      }
    }

    try {
      const res = await clientFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update settings");
      }

      const updated = await res.json();
      setSettings(updated);
      setOriginalSettings(JSON.parse(JSON.stringify(updated)));
      setSuccess("All settings saved and cached successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while updating settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // JSON helper editors
  const gradeLevelsSetting = settings.find((s) => s.key === "grade_levels");
  const categoryWeightsSetting = settings.find((s) => s.key === "category_weights");

  // Update grade level row
  const updateGradeLevelRow = (index: number, field: "min" | "label", val: string | number) => {
    if (!gradeLevelsSetting) return;
    const list = [...(gradeLevelsSetting.value as GradeLevel[])];
    list[index] = { ...list[index], [field]: field === "min" ? Number(val) : val };
    handleSettingChange("grade_levels", list);
  };

  // Add grade level row
  const addGradeLevelRow = () => {
    if (!gradeLevelsSetting) return;
    const list = [...(gradeLevelsSetting.value as GradeLevel[]), { min: 50, label: "New Custom Grade Level" }];
    // Sort automatically descending
    list.sort((a: GradeLevel, b: GradeLevel) => b.min - a.min);
    handleSettingChange("grade_levels", list);
  };

  // Delete grade level row
  const deleteGradeLevelRow = (index: number) => {
    if (!gradeLevelsSetting) return;
    const list = (gradeLevelsSetting.value as GradeLevel[]).filter((_: GradeLevel, idx: number) => idx !== index);
    handleSettingChange("grade_levels", list);
  };

  // Update specific category weight slider
  const updateCategoryWeight = (category: string, weightVal: number) => {
    if (!categoryWeightsSetting) return;
    const weights = { ...(categoryWeightsSetting.value as CategoryWeights), [category.toUpperCase()]: Number(weightVal) };
    handleSettingChange("category_weights", weights);
  };

  // Live tester readability matcher based on current edited grade_levels
  const getTestGradeLevel = (score: number) => {
    if (!gradeLevelsSetting || !Array.isArray(gradeLevelsSetting.value)) {
      return "College Graduate (Very Confusing)";
    }
    const sorted = [...(gradeLevelsSetting.value as GradeLevel[])].sort((a, b) => b.min - a.min);
    const matched = sorted.find((level: GradeLevel) => score >= level.min);
    return matched ? matched.label : "College Graduate (Very Confusing)";
  };

  // Heuristic syllable & readability calculator for live interactive test text
  const calculateTestTextScore = (text: string): { score: number; level: string } => {
    const trimmed = text.trim();
    if (!trimmed) return { score: 100, level: "No content" };

    const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const sentenceCount = Math.max(1, sentences.length);
    const words = trimmed.split(/\s+/).filter((w) => w.trim().length > 0);
    const wordCount = Math.max(1, words.length);

    let syllables = 0;
    const countVowelSyllables = (w: string) => {
      const clean = w.toLowerCase().replace(/[^a-z]/g, "");
      if (clean.length <= 3) return 1;
      const matches = clean.match(/[aeiouy]+/g);
      let c = matches ? matches.length : 0;
      if (clean.endsWith("e") && !clean.endsWith("le")) {
        if (!"aeiouy".includes(clean.charAt(clean.length - 2))) c--;
      }
      return Math.max(1, c);
    };

    for (const word of words) {
      syllables += countVowelSyllables(word);
    }
    syllables = Math.max(1, syllables);

    const flesch = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllables / wordCount);
    const rounded = Math.max(0, Math.min(100, Math.round(flesch)));

    return {
      score: rounded,
      level: getTestGradeLevel(rounded)
    };
  };

  const testTextReadability = calculateTestTextScore(testText);

  // Tab definitions
  const tabs = [
    { id: "general", label: "General & Auth", icon: Settings },
    { id: "rate-limit", label: "Rate Limits", icon: Shield },
    { id: "ai", label: "AI Models", icon: Brain },
    { id: "scoring", label: "Scoring & Grade Levels", icon: Sliders },
  ] as const;

  return (
    <div className="p-6 md:p-10 max-w-6xl w-full mx-auto flex flex-col gap-8 text-foreground">
      {/* Settings Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-blue-200/40 bg-clip-text text-transparent">
              System Settings
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure system rules, rate controls, password policies, AI scanning models, and custom readability categories.
          </p>
        </div>

        {/* Global Save and Revert Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="glass"
            type="button"
            onClick={handleReset}
            disabled={isSubmitting || isFetching}
            className="flex items-center gap-2 text-sm border-border hover:border-blue-500/20 px-4 h-10 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Revert
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || isFetching}
            className="flex items-center gap-2 text-sm shadow-lg px-5 h-10 cursor-pointer"
          >
            <Save className="w-4 h-4 text-white" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Alert Feedbacks */}
      {error && (
        <Card className="border-red-500/20 bg-red-500/5 text-red-400 p-4 rounded-xl flex items-start gap-3.5 shadow-lg">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm">Saving Blocked</span>
            <span className="text-xs text-destructive/90">{error}</span>
          </div>
        </Card>
      )}

      {success && (
        <Card className="border-blue-500/20 bg-blue-500/5 text-blue-400 p-4 rounded-xl flex items-start gap-3.5 shadow-lg">
          <Check className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm">Success</span>
            <span className="text-xs text-emerald-400/90">{success}</span>
          </div>
        </Card>
      )}

      {/* Main Tabbed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Tabs list */}
        <div className="lg:col-span-1 flex flex-col gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3.5 w-full text-left px-4 py-3.5 rounded-xl transition-all font-medium text-sm border cursor-pointer ${
              isActive
                ? "bg-blue-500/10 text-foreground border-blue-500/20 shadow-lg shadow-blue-500/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-blue-500/5"
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "scale-110 text-blue-400" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Panels Panel */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {isFetching ? (
            <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center gap-3.5 bg-[#0a0a0f] border border-white/5 rounded-2xl">
              <div className="w-10 h-10 border-2 border-t-primary border-r-transparent border-white/10 rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground animate-pulse-subtle">
                Querying configuration parameters...
              </span>
            </div>
          ) : (
            <GlassPanel className="p-6 md:p-8 rounded-2xl flex flex-col gap-6 shadow-2xl">
              {/* Tab 1: General & Auth */}
              {activeTab === "general" && (
                <div className="flex flex-col gap-6">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-primary" />
                      General Settings
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage authentication parameters, security keys, and UI interaction limits.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                    {/* Minimum Password Length */}
                    {settings
                      .filter((s) => s.key === "password_min_length")
                      .map((setting) => (
                        <div key={setting.key} className="flex flex-col gap-2">
                          <label className="text-sm font-semibold text-zinc-300">
                            {setting.label}
                          </label>
                          <Input
                            type="number"
                            min={4}
                            max={32}
                            value={setting.value as string | number}
                            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                            className="bg-black/40"
                            placeholder="e.g. 8"
                          />
                          <p className="text-[10px] text-muted-foreground/80 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            Protects customer accounts by rejecting weaker/shorter credentials during sign-up.
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Rate Limits */}
              {activeTab === "rate-limit" && (
                <div className="flex flex-col gap-6">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-amber-500" />
                      Security & Rate Limits
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure execution restrictions to shield backend scanning systems and manage database connection quotas.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                    {/* Proofreading Scan Limit */}
                    {settings
                      .filter((s) => s.key === "rate_limit_proofread_limit")
                      .map((setting) => (
                        <div key={setting.key} className="flex flex-col gap-2">
                          <label className="text-sm font-semibold text-zinc-300">
                            {setting.label}
                          </label>
                          <Input
                            type="number"
                            min={1}
                            max={200}
                            value={setting.value as string | number}
                            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                            className="bg-black/40"
                            placeholder="e.g. 20"
                          />
                          <p className="text-[10px] text-muted-foreground/80 flex items-start gap-1">
                            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            Blocks scanning abuse by limiting the maximum document scan requests permitted per user per minute.
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tab 3: AI Models */}
              {activeTab === "ai" && (
                <div className="flex flex-col gap-6">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-violet-500" />
                      AI Scanning Engines
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage fallback linguistic models and response timeouts.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                    {/* Gemini AI Model Selection */}
                    {settings
                      .filter((s) => s.key === "gemini_model")
                      .map((setting) => (
                        <div key={setting.key} className="flex flex-col gap-2">
                          <label className="text-sm font-semibold text-zinc-300">
                            {setting.label}
                          </label>
                          <select
                            value={setting.value as string | number}
                            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                            className="w-full h-11 px-3.5 bg-black/40 border border-white/10 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                          >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default — Extremely Fast)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Grammar & Heavy Reasoning)</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy Model)</option>
                          </select>
                          <p className="text-[10px] text-muted-foreground/80 flex items-start gap-1">
                            <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            Selects the AI engine to handle advanced grammar correction tasks.
                          </p>
                        </div>
                      ))}

                    {/* Gemini Timeout */}
                    {settings
                      .filter((s) => s.key === "gemini_timeout_ms")
                      .map((setting) => (
                        <div key={setting.key} className="flex flex-col gap-2">
                          <label className="text-sm font-semibold text-zinc-300">
                            {setting.label}
                          </label>
                          <Input
                            type="number"
                            min={1000}
                            max={120000}
                            step={1000}
                            value={setting.value as string | number}
                            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                            className="bg-black/40"
                            placeholder="e.g. 30000"
                          />
                          <p className="text-[10px] text-muted-foreground/80 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            Protects UI responsiveness by cutting off unresponsive AI scan queries after X milliseconds.
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tab 4: Scoring & Grade Levels */}
              {activeTab === "scoring" && (
                <div className="flex flex-col gap-8">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-emerald-500" />
                      Dynamic Quality Scoring & Readability Scales
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure dynamic mistake deductions and define readability thresholds.
                    </p>
                  </div>

                  {/* Dynamic Category weights sliders */}
                  {categoryWeightsSetting && (
                    <Card className="p-5 border-white/5 bg-black/20 flex flex-col gap-4 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-200">Category Deduction Weight Table</span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">Dynamic Weights Enabled</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                        {Object.entries((categoryWeightsSetting.value as CategoryWeights) || {}).map(([catName, wVal]) => (
                          <div key={catName} className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold tracking-wider text-zinc-300">{catName}</span>
                              <span className="font-mono text-primary font-bold">{wVal.toFixed(1)} pts</span>
                            </div>
                            <input
                              type="range"
                              min={0.0}
                              max={10.0}
                              step={0.5}
                              value={wVal}
                              onChange={(e) => updateCategoryWeight(catName, Number(e.target.value))}
                              className="w-full accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer mt-1"
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Readability levels editor */}
                  {gradeLevelsSetting && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-200">Readability Grading scale (Flesch Index)</span>
                        <Button
                          variant="glass"
                          size="sm"
                          type="button"
                          onClick={addGradeLevelRow}
                          className="flex items-center gap-1.5 text-xs h-8 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Level
                        </Button>
                      </div>

                        <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-surface-elevated/50">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-white/5 border-b border-white/5 text-[10px] uppercase font-bold text-muted-foreground tracking-wider select-none">
                          <div className="col-span-4">Min Flesch Score</div>
                          <div className="col-span-7">Readability Grade Label</div>
                          <div className="col-span-1 text-center">Action</div>
                        </div>

                        {/* Table Rows */}
                        <div className="flex flex-col divide-y divide-white/5">
                          {Array.isArray(gradeLevelsSetting.value) &&
                            (gradeLevelsSetting.value as GradeLevel[]).map((row: GradeLevel, idx: number) => (
                              <div key={idx} className="grid grid-cols-12 gap-3 px-4 py-2 items-center hover:bg-white/5 transition-colors">
                                <div className="col-span-4">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={row.min}
                                    onChange={(e) => updateGradeLevelRow(idx, "min", e.target.value)}
                                    className="bg-black/60 h-8 px-2 py-1 text-xs text-center border-white/5 focus:ring-primary"
                                  />
                                </div>
                                <div className="col-span-7">
                                  <Input
                                    type="text"
                                    value={row.label}
                                    onChange={(e) => updateGradeLevelRow(idx, "label", e.target.value)}
                                    className="bg-black/60 h-8 px-2 py-1 text-xs border-white/5 focus:ring-primary"
                                    placeholder="Grade Level label"
                                  />
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => deleteGradeLevelRow(idx)}
                                    className="p-1.5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                                    title="Delete grade level"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* --- Live Interactive Grade Level Tester --- */}
                      <Card className="p-5 border-blue-500/20 bg-gradient-to-br from-surface-elevated/80 via-surface/50 to-blue-500/5 rounded-2xl flex flex-col gap-4 mt-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-primary animate-pulse" />
                            Interactive Readability Live Tester (Unsaved Changes Preview)
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Verify how readability scores calculate instantly as you tweak score thresholds above, prior to hitting Save.
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                          {/* Live Tester Flesch Score Slider */}
                          <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-zinc-300">Option 1: Test by Flesch Index Score</span>
                              <span className="text-[10px] text-muted-foreground">Drag the slider to mock linguistic index ratings.</span>
                            </div>
                            <div className="flex items-center gap-4 py-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={testFleschScore}
                                onChange={(e) => setTestFleschScore(Number(e.target.value))}
                                className="flex-1 accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="font-mono text-sm font-extrabold text-white w-8 text-right shrink-0 bg-primary/25 px-1.5 py-0.5 rounded border border-primary/20">
                                {testFleschScore}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1 text-xs">
                              <span className="text-muted-foreground">Readability Level:</span>
                              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm animate-pulse-subtle">
                                {getTestGradeLevel(testFleschScore)}
                              </span>
                            </div>
                          </div>

                          {/* Live Tester Text Evaluator */}
                          <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-zinc-300">Option 2: Test by Typing Content</span>
                              <span className="text-[10px] text-muted-foreground">Write a phrase to run dynamic syllables heuristic scans.</span>
                            </div>
                            <textarea
                              value={testText}
                              onChange={(e) => setTestText(e.target.value)}
                              rows={2}
                              className="w-full text-xs bg-black/40 border border-white/10 rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none placeholder:text-muted-foreground/50"
                              placeholder="Type something..."
                            />
                            <div className="flex items-center justify-between border-t border-white/5 pt-2.5 text-xs">
                              <div className="flex gap-1.5 text-[10px] text-muted-foreground font-mono">
                                <span>Words: {testText.trim().split(/\s+/).filter(Boolean).length}</span>
                                <span>|</span>
                                <span>Computed Flesch: {testTextReadability.score}</span>
                              </div>
                              <span className="font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20 shadow-sm animate-pulse-subtle">
                                {testTextReadability.level}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}
