"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Check, X, Sparkles, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { clientFetch } from "@/lib/client-fetch";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import GlassPanel from "@/components/ui/GlassPanel";

interface Rule {
  id: string;
  pattern: string;
  replacement: string;
  category: string;
  explanation: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryMeta {
  id: string;
  name: string;
  label: string;
  color: string;
}

export default function RulesContainer() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  
  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("");
  const [category, setCategory] = useState("GRAMMAR");
  const [explanation, setExplanation] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await clientFetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        if (data.length > 0 && !editingRule) {
          setCategory(data[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load categories in RulesContainer", err);
    }
  }, [editingRule]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCategories();
    });
  }, [fetchCategories]);

  const fetchRules = useCallback(async () => {
    setIsFetching(true);
    setError("");
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set("search", search);
      if (categoryFilter) queryParams.set("category", categoryFilter);

      const res = await clientFetch(`/api/admin/rules?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to load rules");

      const data = await res.json();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retrieve rules");
    } finally {
      setIsFetching(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchRules();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [fetchRules]);

  const handleOpenAddModal = () => {
    setEditingRule(null);
    setPattern("");
    setReplacement("");
    setCategory(categories.length > 0 ? categories[0].name : "GRAMMAR");
    setExplanation("");
    setIsActive(true);
    setError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: Rule) => {
    setEditingRule(rule);
    setPattern(rule.pattern);
    setReplacement(rule.replacement);
    setCategory(rule.category);
    setExplanation(rule.explanation);
    setIsActive(rule.isActive);
    setError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    if (!pattern.trim() || !explanation.trim()) {
      setError("Pattern and explanation are required");
      setIsSubmitting(false);
      return;
    }

    try {
      const url = "/api/admin/rules";
      const method = editingRule ? "PUT" : "POST";
      const bodyPayload = {
        id: editingRule?.id,
        pattern,
        replacement,
        category,
        explanation,
        isActive,
      };

      const res = await clientFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save rule");
      }

      setSuccessMessage(
        editingRule ? "Rule updated successfully!" : "New rule added successfully!"
      );
      
      handleCloseModal();
      fetchRules();
      
      // Clear success notification after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status immediately from the list
  const handleToggleActiveStatus = async (rule: Rule) => {
    try {
      const res = await clientFetch("/api/admin/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          isActive: !rule.isActive,
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle status");
      
      // Update state locally for instant feedback
      setRules(
        rules.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
      );
    } catch (err) {
      console.error("Toggle rule error:", err instanceof Error ? err.message : err);
    }
  };

  // Delete a rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this proofreading rule?")) return;

    try {
      const res = await clientFetch(`/api/admin/rules?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");
      
      setRules(rules.filter((r) => r.id !== id));
      setSuccessMessage("Rule deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete rule");
    }
  };

  // Calculate statistics
  const totalCount = rules.length;
  const activeCount = rules.filter((r) => r.isActive).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-6xl w-full mx-auto select-none">
      {/* Header section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Rule Management</h1>
          <p className="text-muted-foreground text-sm">
            Add, update, or remove rules that power the live proofreader engine.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenAddModal} className="gap-2">
          <Plus className="w-4 h-4" /> Add New Rule
        </Button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-500 font-medium animate-fade-in">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Statistics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 flex items-center gap-4 hover:translate-y-0 hover:bg-white/[0.01]">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
            {totalCount}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-300">Total Rules</span>
            <span className="text-[10px] text-muted-foreground">In active list</span>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4 hover:translate-y-0 hover:bg-white/[0.01]">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">
            {activeCount}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-300">Active Rules</span>
            <span className="text-[10px] text-emerald-500">Currently live</span>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4 hover:translate-y-0 hover:bg-white/[0.01]">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold">
            {inactiveCount}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-300">Inactive Rules</span>
            <span className="text-[10px] text-muted-foreground">Temporarily disabled</span>
          </div>
        </Card>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface-elevated/60 p-4 border border-border rounded-xl">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground/60" />
            <input
            className="w-full h-11 pl-10 pr-4 bg-surface-elevated border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm"
            type="text"
            placeholder="Search patterns or explanations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto select-none">
          <button
            key="ALL"
            onClick={() => setCategoryFilter("ALL")}
              className={`h-9 px-4 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                categoryFilter === "ALL"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-surface-elevated hover:bg-blue-500/10 text-muted-foreground hover:text-foreground border border-border"
              }`}
          >
            ALL
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.name)}
              className={`h-9 px-4 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                categoryFilter === cat.name
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-surface-elevated hover:bg-blue-500/10 text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules list container */}
      <Card className="p-0 overflow-hidden flex flex-col border border-border bg-surface-elevated/30">
        {isFetching ? (
          <div className="p-16 flex items-center justify-center text-sm text-muted-foreground animate-pulse-subtle">
            Fetching rules list from database...
          </div>
        ) : rules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-blue-500/[0.02] text-xs font-bold uppercase tracking-wider text-muted-foreground select-none">
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Match Pattern</th>
                  <th className="py-4 px-6">Suggested Change</th>
                  <th className="py-4 px-6">Explanation</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {rules.map((rule) => {
                  const categoryInfo = categories.find((c) => c.name === rule.category);
                  const color = categoryInfo?.color || "#7c3aed";
                  const label = categoryInfo?.label || rule.category;
                  return (
                    <tr key={rule.id} className="hover:bg-blue-500/[0.03] transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{
                            backgroundColor: `${color}1a`,
                            color: color,
                            border: `1px solid ${color}33`,
                          }}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-zinc-200">
                        {rule.pattern}
                      </td>
                      <td className="py-4 px-6 font-mono text-zinc-300 font-bold">
                        {rule.replacement || <span className="text-muted-foreground italic font-normal text-xs">None (Delete)</span>}
                      </td>
                      <td className="py-4 px-6 text-zinc-400 max-w-xs truncate">
                        {rule.explanation}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleToggleActiveStatus(rule)}
                            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title={rule.isActive ? "Deactivate Rule" : "Activate Rule"}
                          >
                            {rule.isActive ? (
                              <ToggleRight className="w-8 h-8 text-primary" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-zinc-600" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-primary transition-colors cursor-pointer"
                            title="Edit Rule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-destructive transition-colors cursor-pointer"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-zinc-200">No rules matches</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px] leading-relaxed">
                Add your first custom grammar or clarity rule to verify your text scanner!
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={handleOpenAddModal} className="mt-2">
              Add Your First Rule
            </Button>
          </div>
        )}
      </Card>

      {/* Reusable Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-lg animate-slide-up">
            <GlassPanel glow className="p-8 relative">
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold tracking-tight">
                    {editingRule ? "Edit Proofreading Rule" : "Add Proofreading Rule"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Define matching parameters to verify spelling, grammar, clarity, or tone.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive font-medium animate-fade-in">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Match Pattern"
                      type="text"
                      placeholder="e.g. its"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                    <Input
                      label="Replacement Proposal"
                      type="text"
                      placeholder="e.g. it's"
                      value={replacement}
                      onChange={(e) => setReplacement(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      Category
                    </label>
                    <select
                      className="w-full h-11 px-3.5 bg-white/5 border border-white/10 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={isSubmitting}
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name} className="bg-[#0f0f15]">
                          {cat.label} ({cat.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      Explanation Description
                    </label>
                    <textarea
                      className="w-full h-24 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all resize-none"
                      placeholder="Describe why this correction is necessary..."
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-3 mt-1 py-1">
            <input
                        type="checkbox"
                        id="rule-active"
                        className="w-4.5 h-4.5 accent-blue-500 rounded cursor-pointer"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={isSubmitting}
                    />
                    <label htmlFor="rule-active" className="text-sm text-zinc-300 select-none cursor-pointer">
                      Enable this rule immediately (Active status)
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-4">
                    <Button
                      variant="glass"
                      size="sm"
                      type="button"
                      onClick={handleCloseModal}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      isLoading={isSubmitting}
                    >
                      {editingRule ? "Save Changes" : "Create Rule"}
                    </Button>
                  </div>
                </form>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  );
}
