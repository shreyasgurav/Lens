"use client";

import { useOnboardingStore } from "@/lib/store";
import { Check } from "lucide-react";

const steps = [
  { num: 1, label: "Website" },
  { num: 2, label: "Description" },
  { num: 3, label: "Topics" },
  { num: 4, label: "Competitors" },
  { num: 5, label: "Analysis" },
];

export default function Sidebar() {
  const { currentStep, completedSteps } = useOnboardingStore();

  return (
    <aside className="w-64 bg-white border-r border-neutral-200 p-6 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">L</span>
        </div>
        <span className="font-semibold text-neutral-900">Lens</span>
      </div>

      {/* Steps */}
      <div className="flex-1">
        <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-4">Setup</p>
        <div className="space-y-1">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.num);
            const isCurrent = currentStep === step.num;

            return (
              <div
                key={step.num}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isCurrent
                    ? "bg-neutral-100"
                    : "hover:bg-neutral-50"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    isCompleted
                      ? "bg-neutral-900 text-white"
                      : isCurrent
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    step.num
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isCurrent
                      ? "font-medium text-neutral-900"
                      : isCompleted
                      ? "text-neutral-700"
                      : "text-neutral-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-neutral-100">
        <p className="text-xs text-neutral-400">
          Step {currentStep} of {steps.length}
        </p>
      </div>
    </aside>
  );
}
