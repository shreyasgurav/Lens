"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/store";
import { ArrowLeft, Check, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
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
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

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

  // Use a ref to prevent duplicate runs (React StrictMode issue)
  const simulationStartedRef = useRef(false);

  useEffect(() => {
    if (simulationResults.length === 0 && !isSimulating && !simulationStartedRef.current) {
      simulationStartedRef.current = true;
      runSimulation();
    }
  }, []);

  const runSimulation = async () => {
    console.log('Starting parallel simulation with:', {
      selectedTopicsCount: selectedTopics.length,
      companyName,
      competitorsCount: competitors.length
    });

    setIsSimulating(true);
    setProgress(0);
    setCurrentMessageIndex(0);

    // Track completed simulations for progress
    let completedCount = 0;
    const totalCount = selectedTopics.length;

    // Run all simulations in parallel
    const simulationPromises = selectedTopics.map((topic, i) => {
      const requestBody = {
        topic: topic.name,
        companyName,
        description,
        competitors: competitors.map((c) => c.name),
      };

      console.log(`Starting simulation ${i + 1}/${totalCount}:`, topic.name);

      return fetch("/api/simulate-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
        .then(response => response.json())
        .then(data => {
          console.log(`Completed simulation for "${topic.name}":`, { 
            success: data.success, 
            resultsCount: data.results?.length 
          });
          
          // Update progress as each completes
          completedCount++;
          setProgress(Math.round((completedCount / totalCount) * 100));
          
          return data;
        })
        .catch(error => {
          console.error(`Simulation error for "${topic.name}":`, error);
          completedCount++;
          setProgress(Math.round((completedCount / totalCount) * 100));
          return { success: false, results: [] };
        });
    });

    // Wait for all simulations to complete
    const allResponses = await Promise.all(simulationPromises);
    
    // Collect all results
    const allResults: typeof simulationResults = [];
    allResponses.forEach(data => {
      if (data.success && data.results) {
        allResults.push(...data.results);
      }
    });

    console.log('All simulations complete. Total results:', allResults.length);

    setSimulationResults(allResults);
    calculateMetrics(allResults);
    
    // Generate actions based on simulation results
    try {
      const actionsResponse = await fetch("/api/generate-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yourBrand: companyName,
          simulationResults: allResults,
          topics: selectedTopics,
          competitors: competitors,
        }),
      });
      
      const actionsData = await actionsResponse.json();
      if (actionsData.success) {
        useOnboardingStore.getState().setActions(actionsData.actions, actionsData.summary);
        console.log('Generated actions:', actionsData.actions.length);
      }
    } catch (error) {
      console.error("Failed to generate actions:", error);
    }
    
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

        {/* Simulations */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-neutral-500">Simulations</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {simulationResults.map((result, i) => (
              <div key={i} className="border-b border-neutral-200 pb-3">
                {/* Source Header */}
                <button
                  onClick={() => setExpandedSource(expandedSource === i ? null : i)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-900">{result.query}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs text-neutral-400">
                        {result.yourBrandMentioned ? `Position #${result.yourBrandPosition}` : "Not mentioned"}
                      </p>
                      <span className="text-xs text-neutral-300">•</span>
                      <p className="text-xs text-neutral-400">
                        {result.mentionedBrands.length} brand{result.mentionedBrands.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {expandedSource === i ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {/* Expanded Content */}
                {expandedSource === i && (
                  <div className="space-y-3 mt-3">
                    {/* ChatGPT Response */}
                    <div className="pt-3">
                      <p className="text-xs font-medium text-neutral-700 mb-2">ChatGPT Response:</p>
                      <p className="text-xs text-neutral-600 leading-relaxed">{result.response}</p>
                    </div>

                    {/* Mentioned Brands */}
                    {result.mentionedBrands.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-neutral-700 mb-2">Mentioned Brands:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.mentionedBrands.map((brand: any, idx: number) => (
                            <div
                              key={idx}
                              className={`px-2.5 py-1 rounded-full text-xs ${
                                brand.name.toLowerCase() === companyName.toLowerCase()
                                  ? "bg-neutral-900 text-white"
                                  : "bg-neutral-100 text-neutral-700"
                              }`}
                            >
                              #{brand.position} {brand.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Source Links */}
                    {result.sources && result.sources.length > 0 && (
                      <div className="pt-2 border-t border-neutral-100">
                        <p className="text-xs font-medium text-neutral-500 mb-2">Sources</p>
                        <div className="space-y-2">
                          {result.sources.map((source: any, sidx: number) => (
                            <a
                              key={sidx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 text-xs text-neutral-600 hover:text-blue-600 transition-colors group"
                            >
                              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-neutral-400 group-hover:text-blue-600" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium group-hover:underline">{source.title}</p>
                                <p className="text-neutral-400 truncate">{source.url}</p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-all"
          >
            View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
