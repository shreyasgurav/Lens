"use client";

import { useOnboardingStore } from "@/lib/store";
import StepWebsite from "@/components/steps/StepWebsite";
import StepDescription from "@/components/steps/StepDescription";
import StepTopics from "@/components/steps/StepTopics";
import StepCompetitors from "@/components/steps/StepCompetitors";
import StepAnalysis from "@/components/steps/StepAnalysis";

const steps = [
  { id: 1, label: "Website" },
  { id: 2, label: "Description" },
  { id: 3, label: "Topics" },
  { id: 4, label: "Competitors" },
  { id: 5, label: "Analysis" },
];

export default function OnboardingPage() {
  const { currentStep } = useOnboardingStore();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepWebsite />;
      case 2:
        return <StepDescription />;
      case 3:
        return <StepTopics />;
      case 4:
        return <StepCompetitors />;
      case 5:
        return <StepAnalysis />;
      default:
        return <StepWebsite />;
    }
  };

  return (
    <div className="min-h-screen bg-white flex justify-center">
      {/* Progress Indicator - Absolute Left */}
      <div className="fixed left-12 top-1/2 -translate-y-1/2">
        <div className="relative" style={{ height: '320px' }}>
          {/* Background Line */}
          <div className="absolute left-1 top-0 bottom-0 w-1 bg-neutral-200 rounded-full" />
          
          {/* Progress Line - Fills as steps complete */}
          <div 
            className="absolute left-1 top-0 w-1 bg-neutral-900 rounded-full transition-all duration-500 ease-out"
            style={{ 
              height: `${((currentStep - 1) / (steps.length - 1)) * 100}%` 
            }}
          />
          
          {/* Step Dots with Labels */}
          <div className="relative flex flex-col justify-between h-full">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-3"
              >
                {/* Oval/Curved Dot blending with line */}
                <div className="relative">
                  <div
                    className={`w-3 h-5 rounded-full transition-all ${
                      step.id < currentStep
                        ? "bg-neutral-900"
                        : step.id === currentStep
                        ? "bg-neutral-900"
                        : "bg-neutral-200"
                    }`}
                  />
                  {step.id === currentStep && (
                    <div className="absolute inset-0 rounded-full bg-neutral-900 opacity-20 animate-pulse" />
                  )}
                </div>
                <span className={`text-sm transition-colors whitespace-nowrap ${
                  step.id === currentStep
                    ? "text-neutral-900 font-medium"
                    : step.id < currentStep
                    ? "text-neutral-500"
                    : "text-neutral-400"
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Perfectly Centered */}
      <main className="flex items-center justify-center px-8 py-12 w-full">
        <div className="w-full max-w-md">
          {renderStep()}
        </div>
      </main>
    </div>
  );
}
