"use client";

import { useState, useEffect } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
import TypingAnimation from "@/components/TypingAnimation";

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

  if (isGeneratingDescription) {
    return <TypingAnimation text="Generating description" />;
  }

  return (
    <div className="relative">
      {/* Back Button - Outside */}
      <button
        onClick={() => setStep(1)}
        className="absolute -left-16 top-2 flex items-center justify-center w-9 h-9 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-neutral-700" />
      </button>

      <div className="space-y-8">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Business description"
            rows={8}
            className="w-full px-0 py-3 border-0 border-b-2 border-neutral-200 text-neutral-900 text-lg placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors resize-none bg-transparent"
          />
        </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs ${text.length > maxChars ? "text-red-500" : "text-neutral-400"}`}>
          {text.length}/{maxChars}
        </span>
        <button
          onClick={generateDescription}
          className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleContinue}
          disabled={!isValid}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all ${
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
    </div>
  );
}
