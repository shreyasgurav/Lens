"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/store";
import { ArrowLeft, Loader2, Check, TrendingUp, BarChart3 } from "lucide-react";

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
    const allResults: typeof simulationResults = [];

    for (let i = 0; i < selectedTopics.length; i++) {
      const topic = selectedTopics[i];
      setCurrentQuery(topic.name);
      setProgress(Math.round(((i + 0.5) / selectedTopics.length) * 100));

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

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
          {isSimulating ? "Analyzing AI responses..." : "Analysis Complete"}
        </h1>
        <p className="text-neutral-500">
          {isSimulating 
            ? "We're simulating AI searches for your selected topics."
            : "Here's how you appear in AI-generated responses."
          }
        </p>
      </div>

      {isSimulating ? (
        <div className="py-8">
          <div className="flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 animate-spin text-neutral-400" />
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-500">Progress</span>
              <span className="font-medium text-neutral-900">{progress}%</span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-neutral-900 transition-all duration-300" 
                style={{ width: `${progress}%` }} 
              />
            </div>
          </div>
          
          <p className="text-sm text-center text-neutral-500 truncate">
            {currentQuery}
          </p>
        </div>
      ) : (
        <>
          {/* Results Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-neutral-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-neutral-500" />
                <span className="text-sm text-neutral-500">Visibility</span>
              </div>
              <p className="text-2xl font-semibold text-neutral-900">{visibilityPercent.toFixed(1)}%</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-neutral-500" />
                <span className="text-sm text-neutral-500">Mentions</span>
              </div>
              <p className="text-2xl font-semibold text-neutral-900">{mentionedCount}/{simulationResults.length}</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-neutral-500" />
                <span className="text-sm text-neutral-500">Topics</span>
              </div>
              <p className="text-2xl font-semibold text-neutral-900">{selectedTopics.length}</p>
            </div>
          </div>

          {/* Sample Results */}
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {simulationResults.slice(0, 4).map((result, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  result.yourBrandMentioned ? "bg-green-100 text-green-600" : "bg-neutral-200 text-neutral-500"
                }`}>
                  {result.yourBrandMentioned ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs">—</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900 truncate">{result.query}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {result.yourBrandMentioned ? `Ranked #${result.yourBrandPosition}` : "Not mentioned"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setStep(4)}
          disabled={isSimulating}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-neutral-200 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          disabled={isSimulating}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            !isSimulating
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
          }`}
        >
          View Dashboard
        </button>
      </div>
    </div>
  );
}
