"use client";

import { useEffect, useState } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight, ArrowLeft, Check, Plus, X } from "lucide-react";
import TypingAnimation from "@/components/TypingAnimation";

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

  if (isGeneratingTopics) {
    return <TypingAnimation text="Generating topics" />;
  }

  return (
    <div className="relative">
      {/* Back Button - Outside */}
      <button
        onClick={() => setStep(2)}
        className="absolute -left-16 top-2 flex items-center justify-center w-9 h-9 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-neutral-700" />
      </button>

      <div className="space-y-8">
        {/* Add Custom Topic */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
            placeholder="Add custom topic"
            className="flex-1 px-0 py-3 border-0 border-b-2 border-neutral-200 text-neutral-900 text-lg placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors bg-transparent"
          />
          <button
            onClick={handleAddTopic}
            disabled={!newTopic.trim()}
            className="px-4 py-2 text-neutral-900 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Topics List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
        {topics.map((topic) => (
          <div
            key={topic.id}
            onClick={() => toggleTopic(topic.id)}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-all ${
              topic.selected
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
            }`}
          >
            <span className="text-sm">{topic.name}</span>
            <div className="flex items-center gap-2">
              {topic.selected && <Check className="w-4 h-4 flex-shrink-0" />}
              {topic.id.startsWith('topic-custom-') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTopic(topic.id);
                  }}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

        {selectedCount < minRequired && (
          <p className="text-center text-xs text-neutral-400">
            Select at least {minRequired - selectedCount} more
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleContinue}
            disabled={selectedCount < minRequired}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all ${
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
    </div>
  );
}
