"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/lib/store";
import { ArrowRight, Globe } from "lucide-react";

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
    <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
          Let's get started
        </h1>
        <p className="text-neutral-500">
          Enter your company details to begin tracking AI visibility.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Company Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc"
            className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Website URL
          </label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full pl-11 pr-4 py-3 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!isValid}
        className={`w-full mt-8 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
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
