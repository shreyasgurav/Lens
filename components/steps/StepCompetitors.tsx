"use client";

import { useState, useEffect } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight, ArrowLeft, Plus, X } from "lucide-react";
import TypingAnimation from "@/components/TypingAnimation";

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
    const input = newName.trim();
    
    // Extract domain and name from URL or plain text
    let domain = '';
    let competitorName = '';
    
    try {
      // Try to parse as URL
      let urlToParse = input;
      if (!input.startsWith('http://') && !input.startsWith('https://')) {
        urlToParse = 'https://' + input;
      }
      const url = new URL(urlToParse);
      domain = url.hostname.replace('www.', '');
      // Extract company name from domain (e.g., cluely.com -> Cluely)
      competitorName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    } catch {
      // If not a valid URL, treat as company name
      competitorName = input;
      domain = input.toLowerCase().replace(/\s+/g, '') + '.com';
    }
    
    addCompetitor({
      id: `comp-${Date.now()}`,
      name: competitorName,
      website: domain,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    });
    setNewName("");
  };

  const handleContinue = () => {
    if (competitors.length === 0) return;
    completeStep(4);
    setStep(5);
  };

  if (isGeneratingCompetitors) {
    return <TypingAnimation text="Searching competitors" />;
  }

  return (
    <div className="relative">
      {/* Back Button - Outside */}
      <button
        onClick={() => setStep(3)}
        className="absolute -left-16 top-2 flex items-center justify-center w-9 h-9 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-neutral-700" />
      </button>

      <div className="space-y-8">
        {/* Add Competitor */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
            placeholder="Add competitor"
            className="flex-1 px-0 py-2.5 border-0 border-b-2 border-neutral-200 text-neutral-900 text-base placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors bg-transparent"
          />
          <button
            onClick={handleAddCompetitor}
            disabled={!newName.trim()}
            className="px-4 py-2 text-neutral-900 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Competitors List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
        {competitors.map((comp) => (
          <div
            key={comp.id}
            className="flex items-center justify-between px-4 py-3 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
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
              className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

        {competitors.length > 0 && (
          <p className="text-xs text-neutral-400 text-center">
            {competitors.length} competitor{competitors.length !== 1 ? "s" : ""}
          </p>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            disabled={competitors.length === 0}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
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
    </div>
  );
}
