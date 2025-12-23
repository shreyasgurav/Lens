"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight } from "lucide-react";

export default function StepWebsite() {
  const { companyName, websiteUrl, setCompanyInfo, setStep, completeStep } = useOnboardingStore();
  const [name, setName] = useState(companyName);
  const [url, setUrl] = useState(websiteUrl);

  const handleContinue = () => {
    if (!name.trim() || !url.trim()) return;
    setCompanyInfo(name.trim(), url.trim());
    completeStep(1);
    setStep(2);
  };

  const isValid = name.trim().length > 0 && url.trim().length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && isValid && handleContinue()}
            placeholder="Company Name"
            className="w-full px-0 py-3 border-0 border-b-2 border-neutral-200 text-neutral-900 text-lg placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors bg-transparent"
            autoFocus
          />
        </div>

        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && isValid && handleContinue()}
            placeholder="Website URL"
            className="w-full px-0 py-3 border-0 border-b-2 border-neutral-200 text-neutral-900 text-lg placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors bg-transparent"
          />
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!isValid}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all ${
          isValid
            ? "bg-neutral-900 text-white hover:bg-neutral-800"
            : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
        }`}
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
