"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/store";
import { ArrowLeft, Check } from "lucide-react";
import TypingAnimation from "@/components/TypingAnimation";

export default function StepAnalysis() {
  const router = useRouter();
  const {
    companyName,
    description,
    topics,
    competitors,
    simulationResults,
    setSimulationResults,
    isSimulating,
    setIsSimulating,
    setMetrics,
    completeStep,
    setStep,
  } = useOnboardingStore();

  const [progress, setProgress] = useState(0);
  const [currentQuery, setCurrentQuery] = useState("");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const analysisMessages = [
    "Analyzing your positioning",
    "Analyzing competitors",
    "Evaluating topic coverage",
    "Calculating visibility metrics",
  ];

  // Cycle through messages independently
  useEffect(() => {
    if (!isSimulating) return;
    
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % analysisMessages.length);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(messageInterval);
  }, [isSimulating, analysisMessages.length]);

  const selectedTopics = topics.filter((t) => t.selected);

  useEffect(() => {
    if (simulationResults.length === 0 && !isSimulating) {
      runSimulation();
    }
  }, []);

  const runSimulation = async () => {
    console.log('Starting simulation with:', {
      selectedTopicsCount: selectedTopics.length,
      companyName,
      competitorsCount: competitors.length
    });

    setIsSimulating(true);
    setProgress(0);
    setCurrentMessageIndex(0);
    const allResults: typeof simulationResults = [];

    for (let i = 0; i < selectedTopics.length; i++) {
      const topic = selectedTopics[i];
      setCurrentQuery(topic.name);
      
      // Update progress
      const currentProgress = (i / selectedTopics.length) * 100;
      setProgress(Math.round(currentProgress));

      const requestBody = {
        topic: topic.name,
        companyName,
        description,
        competitors: competitors.map((c) => c.name),
      };

      console.log(`Simulating topic ${i + 1}/${selectedTopics.length}:`, topic.name);

      try {
        const response = await fetch("/api/simulate-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        
        const data = await response.json();
        console.log('API response:', { success: data.success, resultsCount: data.results?.length, error: data.error });
        
        if (data.success && data.results) {
          allResults.push(...data.results);
          console.log(`Added ${data.results.length} results. Total: ${allResults.length}`);
        } else {
          console.error('API returned error:', data);
        }
      } catch (error) {
        console.error("Simulation error:", error);
      }

      setProgress(Math.round(((i + 1) / selectedTopics.length) * 100));
    }

    console.log('Simulation complete. Total results:', allResults.length);

    setSimulationResults(allResults);
    calculateMetrics(allResults);
    setIsSimulating(false);
    completeStep(5);
  };

  const calculateMetrics = (results: typeof simulationResults) => {
    const mentioned = results.filter((r) => r.yourBrandMentioned);
    const positions = mentioned.map((r) => r.yourBrandPosition).filter((p) => p !== null) as number[];
    
    const allBrands = new Map<string, number>();
    results.forEach((r) => {
      r.mentionedBrands.forEach((b) => {
        allBrands.set(b.name, (allBrands.get(b.name) || 0) + 1);
      });
    });

    const sortedBrands = Array.from(allBrands.entries()).sort((a, b) => b[1] - a[1]);
    const yourRank = sortedBrands.findIndex(([name]) => name.toLowerCase() === companyName.toLowerCase()) + 1;
    const topCompetitor = sortedBrands.find(([name]) => name.toLowerCase() !== companyName.toLowerCase());

    setMetrics({
      visibilityPercentage: results.length > 0 ? (mentioned.length / results.length) * 100 : 0,
      totalPrompts: results.length,
      mentionCount: mentioned.length,
      avgPosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 0,
      topSource: "ChatGPT",
      topSourceMentions: mentioned.length,
      closestCompetitor: topCompetitor?.[0] || "None",
      closestCompetitorMentions: topCompetitor?.[1] || 0,
      brandRanking: yourRank || sortedBrands.length + 1,
    });
  };

  const mentionedCount = simulationResults.filter((r) => r.yourBrandMentioned).length;
  const visibilityPercent = simulationResults.length > 0 ? (mentionedCount / simulationResults.length) * 100 : 0;

  if (isSimulating) {
    const currentMessage = analysisMessages[currentMessageIndex];
    return (
      <div className="space-y-8">
        <TypingAnimation text={currentMessage} />
        {/* Minimal Progress Bar */}
        <div className="w-full max-w-xs mx-auto">
          <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-neutral-900 transition-all duration-500 ease-out" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Back Button - Outside */}
      <button
        onClick={() => setStep(4)}
        className="absolute -left-16 top-2 flex items-center justify-center w-9 h-9 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-neutral-700" />
      </button>

      <div className="space-y-8">
        {/* Results Summary */}
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-semibold text-neutral-900 mb-1">{visibilityPercent.toFixed(0)}%</p>
            <p className="text-xs text-neutral-500">Visibility</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-neutral-900 mb-1">{mentionedCount}/{simulationResults.length}</p>
            <p className="text-xs text-neutral-500">Mentions</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-neutral-900 mb-1">{selectedTopics.length}</p>
            <p className="text-xs text-neutral-500">Topics</p>
          </div>
        </div>

        {/* Sample Results */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
        {simulationResults.slice(0, 5).map((result, i) => (
          <div key={i} className="flex items-start gap-3 p-3 border border-neutral-200 rounded-lg">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              result.yourBrandMentioned ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-500"
            }`}>
              {result.yourBrandMentioned ? <Check className="w-3 h-3" /> : <span className="text-xs">—</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-900 truncate">{result.query}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {result.yourBrandMentioned ? `#${result.yourBrandPosition}` : "Not mentioned"}
              </p>
            </div>
          </div>
        ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-all"
          >
            View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
