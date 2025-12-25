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
    <div className="min-h-screen bg-white flex flex-col lg:flex-row lg:justify-center">
      {/* Mobile: Logo and Progress at Top */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-neutral-200 z-50">
        {/* Logo - Centered */}
        <div className="flex justify-center pt-4 pb-2">
          <img 
            src="/Lens Logo.png" 
            alt="Lens"
            className="w-8 h-8 object-contain"
          />
        </div>
        
        {/* Progress Bar */}
        <div className="px-6 pb-3">
          <div className="relative">
            {/* Background Line */}
            <div className="absolute top-1.5 left-0 right-0 h-px bg-neutral-200 rounded-full" />
            
            {/* Progress Line */}
            <div 
              className="absolute top-1.5 left-0 h-px bg-neutral-900 rounded-full transition-all duration-500 ease-out"
              style={{ 
                width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` 
              }}
            />
            
            {/* Step Dots */}
            <div className="relative flex justify-between">
              {steps.map((step) => (
                <div key={step.id} className="flex flex-col items-center gap-1.5">
                  {/* Dot */}
                  <div className="relative">
                    <div
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
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
                  {/* Label */}
                  <span
                    className={`text-[10px] transition-colors whitespace-nowrap ${
                      step.id === currentStep
                        ? "text-neutral-900 font-medium"
                        : step.id < currentStep
                        ? "text-neutral-500"
                        : "text-neutral-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Logo - Centered horizontally */}
      <div className="hidden lg:flex fixed top-8 left-0 right-0 justify-center z-50">
        <img 
          src="/Lens Logo.png" 
          alt="Lens"
          className="w-8 h-8 object-contain"
        />
      </div>

      {/* Desktop: Vertical Progress Indicator */}
      <div className="hidden lg:block fixed left-16 top-1/2 -translate-y-1/2">
        <div className="relative" style={{ height: '220px' }}>
          {/* Background Line */}
          <div className="absolute left-1.5 top-0 bottom-0 w-px bg-neutral-200 rounded-full" />
          
          {/* Progress Line - Fills as steps complete */}
          <div 
            className="absolute left-1.5 top-0 w-px bg-neutral-900 rounded-full transition-all duration-500 ease-out"
            style={{ 
              height: `${((currentStep - 1) / (steps.length - 1)) * 100}%` 
            }}
          />
          
          {/* Step Dots with Labels */}
          <div className="relative flex flex-col justify-between h-full">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-2.5"
              >
                {/* Circular Dot centered on line */}
                <div className="relative">
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-all ${
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
                <span className={`text-xs transition-colors whitespace-nowrap ${
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

      {/* Main Content - Responsive and Centered */}
      <main className="flex items-center justify-center px-4 sm:px-6 lg:px-8 w-full min-h-screen pt-32 pb-8 lg:pt-0 lg:pb-0">
        <div className={`w-full transition-all ${currentStep === 2 ? 'max-w-xl' : currentStep === 3 ? 'max-w-2xl' : currentStep === 5 ? 'max-w-3xl' : 'max-w-md'}`}>
          {renderStep()}
        </div>
      </main>
    </div>
  );
}
