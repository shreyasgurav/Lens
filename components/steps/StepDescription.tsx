"use client";

import { useState, useEffect } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight, ArrowLeft, RefreshCw, Loader2, Sparkles } from "lucide-react";

export default function StepDescription() {
  const {
    companyName,
    websiteUrl,
    description,
    category,
    setDescription,
    setScrapedData,
    isGeneratingDescription,
    setIsGeneratingDescription,
    setStep,
    completeStep,
  } = useOnboardingStore();

  const [text, setText] = useState(description);
  const [detectedCategory, setDetectedCategory] = useState(category);
  const [status, setStatus] = useState("");
  const maxChars = 500;

  useEffect(() => {
    if (!description && !isGeneratingDescription) {
      generateDescription();
    } else if (description) {
      setText(description);
    }
  }, []);

  const generateDescription = async () => {
    setIsGeneratingDescription(true);
    setStatus("Analyzing website...");
    
    try {
      const response = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, companyName }),
      });
      const data = await response.json();
      
      if (data.success && data.description) {
        setText(data.description);
        setDescription(data.description);
        if (data.category) setDetectedCategory(data.category);
        setScrapedData(data.category || "", data.scrapedFeatures || [], data.scrapedKeywords || []);
      }
    } catch (error) {
      console.error("Failed to generate description:", error);
    } finally {
      setIsGeneratingDescription(false);
      setStatus("");
    }
  };

  const handleContinue = () => {
    if (!text.trim()) return;
    setDescription(text.trim());
    completeStep(2);
    setStep(3);
  };

  const isValid = text.trim().length > 0 && text.length <= maxChars;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
          Describe your business
        </h1>
        <p className="text-neutral-500">
          We've analyzed your website. Edit the description below.
        </p>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isGeneratingDescription}
          placeholder="Describe your business..."
          rows={5}
          className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none disabled:bg-neutral-50"
        />
        
        {isGeneratingDescription && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-600 mb-2" />
            <p className="text-sm text-neutral-500">{status}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <span className={`text-xs ${text.length > maxChars ? "text-red-500" : "text-neutral-400"}`}>
            {text.length}/{maxChars}
          </span>
          {detectedCategory && !isGeneratingDescription && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              {detectedCategory}
            </div>
          )}
        </div>
        <button
          onClick={generateDescription}
          disabled={isGeneratingDescription}
          className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 disabled:text-neutral-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingDescription ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={() => setStep(1)}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-neutral-200 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!isValid}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            isValid
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
