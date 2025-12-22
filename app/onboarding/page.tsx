"use client";

import { useOnboardingStore } from "@/lib/store";
import Sidebar from "@/components/Sidebar";
import StepWebsite from "@/components/steps/StepWebsite";
import StepDescription from "@/components/steps/StepDescription";
import StepTopics from "@/components/steps/StepTopics";
import StepCompetitors from "@/components/steps/StepCompetitors";
import StepAnalysis from "@/components/steps/StepAnalysis";

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
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-xl">
          {renderStep()}
        </div>
      </main>
    </div>
  );
}
