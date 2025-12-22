"use client";

import { useEffect, useState } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight, ArrowLeft, Loader2, Check, Plus, X } from "lucide-react";

export default function StepTopics() {
  const {
    description,
    companyName,
    category,
    scrapedFeatures,
    scrapedKeywords,
    topics,
    setTopics,
    toggleTopic,
    isGeneratingTopics,
    setIsGeneratingTopics,
    setStep,
    completeStep,
  } = useOnboardingStore();

  const [newTopic, setNewTopic] = useState("");
  const selectedCount = topics.filter((t) => t.selected).length;
  const minRequired = 3;

  useEffect(() => {
    if (topics.length === 0 && !isGeneratingTopics) {
      generateTopics();
    }
  }, []);

  const generateTopics = async () => {
    setIsGeneratingTopics(true);
    try {
      const response = await fetch("/api/generate-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, companyName, category, scrapedFeatures, scrapedKeywords }),
      });
      const data = await response.json();
      if (data.success && data.topics) {
        const formattedTopics = data.topics.map((name: string, i: number) => ({
          id: `topic-${i}`,
          name,
          selected: false,
        }));
        setTopics(formattedTopics);
      }
    } catch (error) {
      console.error("Failed to generate topics:", error);
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  const handleAddTopic = () => {
    if (!newTopic.trim()) return;
    const newTopicObj = {
      id: `topic-custom-${Date.now()}`,
      name: newTopic.trim(),
      selected: true,
    };
    setTopics([...topics, newTopicObj]);
    setNewTopic("");
  };

  const handleRemoveTopic = (id: string) => {
    setTopics(topics.filter(t => t.id !== id));
  };

  const handleContinue = () => {
    if (selectedCount < minRequired) return;
    completeStep(3);
    setStep(4);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
          Select your topics
        </h1>
        <p className="text-neutral-500">
          Choose the search queries you want to appear in.
        </p>
      </div>

      {isGeneratingTopics ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mb-3" />
          <p className="text-sm text-neutral-500">Generating topics...</p>
        </div>
      ) : (
        <>
          {/* Add Custom Topic */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
              placeholder="Add custom topic... (e.g., Best AI meeting assistant)"
              className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <button
              onClick={handleAddTopic}
              disabled={!newTopic.trim()}
              className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Topics List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                  topic.selected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-700"
                }`}
              >
                <button
                  onClick={() => toggleTopic(topic.id)}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <span className="text-sm">{topic.name}</span>
                  {topic.selected && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
                {topic.id.startsWith('topic-custom-') && (
                  <button
                    onClick={() => handleRemoveTopic(topic.id)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!isGeneratingTopics && selectedCount < minRequired && (
        <p className="text-center text-sm text-neutral-400 mt-4">
          Select at least {minRequired - selectedCount} more topic{minRequired - selectedCount !== 1 ? "s" : ""}
        </p>
      )}

      {!isGeneratingTopics && selectedCount >= minRequired && (
        <p className="text-center text-sm text-green-600 mt-4">
          {selectedCount} topics selected
        </p>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setStep(2)}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-neutral-200 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={selectedCount < minRequired}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            selectedCount >= minRequired
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
