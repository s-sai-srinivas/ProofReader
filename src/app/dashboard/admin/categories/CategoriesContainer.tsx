"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Layers,
  Palette,
  Trash
} from "lucide-react";
import { clientFetch } from "@/lib/client-fetch";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import GlassPanel from "@/components/ui/GlassPanel";

interface Category {
  id: string;
  name: string;
  label: string;
  description: string | null;
  color: string;
  sortOrder: number;
  weight: number;
  isActive: boolean;
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CategoriesContainer() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [weight, setWeight] = useState(1.0);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [reassignToCategoryId, setReassignToCategoryId] = useState("");

  const presetColors = [
    "#22c55e",
    "#3b82f6",
    "#f59e0b",
    "#ec4899",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#f43f5e",
  ];

  const fetchCategories = useCallback(async () => {
    setIsFetching(true);
    setError("");
    try {
      const res = await clientFetch("/api/admin/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retrieve categories");
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCategories();
    });
  }, [fetchCategories]);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setName("");
    setLabel("");
    setDescription("");
    setColor("#7c3aed");
    setWeight(1.0);
    setError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setLabel(cat.label);
    setDescription(cat.description || "");
    setColor(cat.color);
    setWeight(cat.weight);
    setError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    if (!name.trim() || !label.trim()) {
      setError("Category reference name and display label are required");
      setIsSubmitting(false);
      return;
    }

    try {
      const url = "/api/admin/categories";
      const method = editingCategory ? "PUT" : "POST";
      const bodyPayload = {
        id: editingCategory?.id,
        name: editingCategory ? undefined : name,
        label,
        description,
        color,
        weight: Number(weight),
      };

      const res = await clientFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save category");
      }

      setSuccessMessage(
        editingCategory ? "Category updated successfully!" : "New category added successfully!"
      );

      handleCloseModal();
      fetchCategories();

      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (cat: Category) => {
    setDeletingCategory(cat);
    const otherCats = categories.filter((c) => c.id !== cat.id);
    if (otherCats.length > 0) {
      setReassignToCategoryId(otherCats[0].id);
    } else {
      setReassignToCategoryId("");
    }
    setIsDeleteModalOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsSubmitting(true);
    setError("");

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("id", deletingCategory.id);
      if (reassignToCategoryId) {
        queryParams.set("reassignTo", reassignToCategoryId);
      }

      const res = await clientFetch(`/api/admin/categories?${queryParams.toString()}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      setSuccessMessage("Category deleted and rules reassigned successfully!");
      setIsDeleteModalOpen(false);
      setDeletingCategory(null);
      fetchCategories();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMove = async (index: number, direction: "UP" | "DOWN") => {
    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const list = [...categories];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    setCategories(list);

    try {
      for (let i = 0; i < list.length; i++) {
        if (list[i].sortOrder !== i) {
          await clientFetch("/api/admin/categories", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: list[i].id,
              sortOrder: i,
            }),
          });
        }
      }
    } catch (err) {
      console.error("Reorder synchronization failed", err);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const list = [...categories];
    const [moved] = list.splice(draggedIndex, 1);
    list.splice(index, 0, moved);

    setCategories(list);
    setDraggedIndex(null);

    try {
      for (let i = 0; i < list.length; i++) {
        if (list[i].sortOrder !== i) {
          await clientFetch("/api/admin/categories", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: list[i].id,
              sortOrder: i,
            }),
          });
        }
      }
    } catch (err) {
      console.error("Reorder drag synchronization failed", err);
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-6xl w-full mx-auto select-none">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Category Configuration</h1>
          <p className="text-muted-foreground text-sm">
            Configure system categories, colors, highlights, and priorities.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenAddModal} className="gap-2">
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-500 font-medium animate-fade-in">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive font-medium animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface-elevated/60 p-4 border border-border rounded-xl">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground/60" />
          <input
            className="w-full h-11 pl-10 pr-4 bg-surface-elevated border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm"
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Drag rows or use arrow buttons to define highlighting order.
        </div>
      </div>

      <Card className="p-0 overflow-hidden flex flex-col border border-border bg-surface-elevated/30">
        {isFetching ? (
          <div className="p-16 flex items-center justify-center text-sm text-muted-foreground animate-pulse-subtle">
            Fetching active categories list...
          </div>
        ) : filteredCategories.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-blue-500/[0.02] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-4 px-6 w-12 text-center">Order</th>
                  <th className="py-4 px-6">Reference Name</th>
                  <th className="py-4 px-6">Display Label</th>
                  <th className="py-4 px-6">Swatch Highlight</th>
                  <th className="py-4 px-6">Scoring Deduction</th>
                  <th className="py-4 px-6">Description</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredCategories.map((cat, idx) => (
                  <tr
                    key={cat.id}
                    className="hover:bg-blue-500/[0.03] transition-colors cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                  >
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, "UP")}
                          className="p-1 rounded bg-white/5 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={idx === categories.length - 1}
                          onClick={() => handleMove(idx, "DOWN")}
                          className="p-1 rounded bg-white/5 text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-zinc-200">
                      {cat.name}
                    </td>
                    <td className="py-4 px-6 font-semibold text-zinc-300">
                      {cat.label}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-5 h-5 rounded-full border border-white/20 shadow-md"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-mono text-xs text-zinc-400">{cat.color}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-semibold text-zinc-300 whitespace-nowrap">
                      -{cat.weight.toFixed(1)} points
                    </td>
                    <td className="py-4 px-6 text-zinc-400 max-w-xs truncate">
                      {cat.description || <span className="text-zinc-600 italic">No description</span>}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {cat.orgId !== null ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(cat)}
                            className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-primary transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(cat)}
                            className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-destructive transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-0.5 border border-zinc-800 rounded bg-zinc-900 select-none">
                          System Default
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-zinc-200">No categories found</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px] leading-relaxed">
                Add custom highlighting categories to map rules inside the proofreading engine!
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={handleOpenAddModal} className="mt-2">
              Create First Category
            </Button>
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md animate-slide-up">
            <GlassPanel glow className="p-8 relative">
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">
                    {editingCategory ? "Edit Highlighting Category" : "Add Highlighting Category"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set a reference name, friendly label, and highlights color.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <Input
                    label="Reference Name (Read-only after creation)"
                    type="text"
                    placeholder="e.g. GRAMMAR"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting || !!editingCategory}
                    required
                  />

                  <Input
                    label="Display Label (Visible to writers)"
                    type="text"
                    placeholder="e.g. Grammar & Spelling"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />

                  <Input
                    label="Brief Description"
                    type="text"
                    placeholder="Describe mistakes captured by this tag..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                  />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      Scoring Deduction Weight (0.0 to 10.0 points)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value))}
                        disabled={isSubmitting}
                        className="flex-1 h-2 bg-white/5 border border-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <span className="w-16 text-right font-mono text-sm font-semibold text-zinc-300">
                        -{Number(weight).toFixed(1)} pts
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-zinc-400" />
                      Highlight Color Swatch
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        disabled={isSubmitting}
                        className="w-10 h-10 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        disabled={isSubmitting}
                        className="flex-1 h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-foreground focus:outline-none font-mono focus:ring-1 focus:ring-primary focus:border-primary"
                        placeholder="#ffffff"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {presetColors.map((pc) => (
                        <button
                          key={pc}
                          type="button"
                          onClick={() => setColor(pc)}
                          className="w-6 h-6 rounded-full border border-white/10 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-sm"
                          style={{ backgroundColor: pc }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-2">
                    <Button
                      type="button"
                      variant="glass"
                      onClick={handleCloseModal}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Save Category"}
                    </Button>
                  </div>
                </form>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}

      {isDeleteModalOpen && deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md animate-slide-up">
            <GlassPanel glow className="p-8 border border-red-500/20 relative">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                    <Trash className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Deactivate Category</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This action will soft-delete the category: <strong className="text-zinc-200">{deletingCategory.label}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Proofreading rules linked to this category cannot function without a target label. Please select a category to reassign existing rules to, or set to null.
                  </p>

                  {categories.filter((c) => c.id !== deletingCategory.id).length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Reassign Rules To:
                      </label>
                      <select
                        className="w-full h-11 px-3 bg-white/5 border border-white/10 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all"
                        value={reassignToCategoryId}
                        onChange={(e) => setReassignToCategoryId(e.target.value)}
                        disabled={isSubmitting}
                      >
                        <option value="" className="bg-[#0f0f15]">Do not reassign (clear category links)</option>
                        {categories
                          .filter((c) => c.id !== deletingCategory.id)
                          .map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#0f0f15]">
                              {c.label} ({c.name})
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3 bg-white/5 rounded border border-white/5 text-xs text-muted-foreground italic text-center">
                      No other active categories are available to reassign rules to. Links will be cleared.
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 mt-4">
                    <Button
                      type="button"
                      variant="glass"
                      onClick={() => setIsDeleteModalOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="bg-red-600 hover:bg-red-500 border-red-700 hover:border-red-600"
                      onClick={handleDeleteCategory}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Deactivating..." : "Deactivate"}
                    </Button>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  );
}
