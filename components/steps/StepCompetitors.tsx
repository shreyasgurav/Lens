"use client";

import { useState, useEffect } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight, ArrowLeft, Plus, X, Loader2 } from "lucide-react";

export default function StepCompetitors() {
  const {
    description,
    companyName,
    category,
    scrapedFeatures,
    topics,
    competitors,
    setCompetitors,
    addCompetitor,
    removeCompetitor,
    isGeneratingCompetitors,
    setIsGeneratingCompetitors,
    setStep,
    completeStep,
  } = useOnboardingStore();

  const [newName, setNewName] = useState("");
  const selectedTopics = topics.filter(t => t.selected).map(t => t.name);

  useEffect(() => {
    if (competitors.length === 0 && !isGeneratingCompetitors) {
      generateCompetitors();
    }
  }, []);

  const generateCompetitors = async () => {
    setIsGeneratingCompetitors(true);
    try {
      const response = await fetch("/api/generate-competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, companyName, category, scrapedFeatures, topics: selectedTopics }),
      });
      const data = await response.json();
      if (data.success && data.competitors) {
        const formattedCompetitors = data.competitors.map(
          (c: { name: string; website?: string; favicon?: string }, i: number) => ({
            id: `comp-${i}`,
            name: c.name,
            website: c.website,
            favicon: c.favicon || (c.website ? `https://www.google.com/s2/favicons?domain=${c.website}&sz=64` : undefined),
          })
        );
        setCompetitors(formattedCompetitors);
      }
    } catch (error) {
      console.error("Failed to generate competitors:", error);
    } finally {
      setIsGeneratingCompetitors(false);
    }
  };

  const handleAddCompetitor = () => {
    if (!newName.trim()) return;
    addCompetitor({
      id: `comp-${Date.now()}`,
      name: newName.trim(),
    });
    setNewName("");
  };

  const handleContinue = () => {
    if (competitors.length === 0) return;
    completeStep(4);
    setStep(5);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
          Your competitors
        </h1>
        <p className="text-neutral-500">
          Review and edit your competitor list.
        </p>
      </div>

      {isGeneratingCompetitors ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mb-3" />
          <p className="text-sm text-neutral-500">Finding competitors...</p>
        </div>
      ) : (
        <>
          {/* Add Competitor */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
              placeholder="Add a competitor..."
              className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <button
              onClick={handleAddCompetitor}
              disabled={!newName.trim()}
              className="px-4 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Competitors List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {comp.favicon ? (
                    <img src={comp.favicon} alt="" className="w-6 h-6 rounded" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center">
                      <span className="text-xs font-medium text-neutral-500">{comp.name[0]}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{comp.name}</p>
                    {comp.website && (
                      <p className="text-xs text-neutral-400">{comp.website}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeCompetitor(comp.id)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-xs text-neutral-400 mt-3">
            {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} added
          </p>
        </>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setStep(3)}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-neutral-200 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={competitors.length === 0}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            competitors.length > 0
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
          }`}
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
