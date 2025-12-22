import { create } from 'zustand';

export interface Competitor {
  id: string;
  name: string;
  website?: string;
  favicon?: string;
}

export interface Topic {
  id: string;
  name: string;
  selected: boolean;
}

export interface SimulationResult {
  query: string;
  response: string;
  mentionedBrands: {
    name: string;
    position: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
  yourBrandMentioned: boolean;
  yourBrandPosition: number | null;
}

export interface VisibilityMetrics {
  visibilityPercentage: number;
  totalPrompts: number;
  mentionCount: number;
  avgPosition: number;
  topSource: string;
  topSourceMentions: number;
  closestCompetitor: string;
  closestCompetitorMentions: number;
  brandRanking: number;
}

interface OnboardingState {
  // Step tracking
  currentStep: number;
  completedSteps: number[];
  
  // Step 1: Company info
  companyName: string;
  websiteUrl: string;
  
  // Step 2: Description (with scraped data)
  description: string;
  category: string;
  scrapedFeatures: string[];
  scrapedKeywords: string[];
  isGeneratingDescription: boolean;
  
  // Step 3: Topics
  topics: Topic[];
  isGeneratingTopics: boolean;
  
  // Step 4: Competitors
  competitors: Competitor[];
  isGeneratingCompetitors: boolean;
  
  // Step 5: Simulation
  simulationResults: SimulationResult[];
  isSimulating: boolean;
  simulationProgress: number;
  
  // Metrics
  metrics: VisibilityMetrics | null;
  
  // Actions
  setStep: (step: number) => void;
  completeStep: (step: number) => void;
  setCompanyInfo: (name: string, url: string) => void;
  setDescription: (desc: string) => void;
  setScrapedData: (category: string, features: string[], keywords: string[]) => void;
  setIsGeneratingDescription: (val: boolean) => void;
  setTopics: (topics: Topic[]) => void;
  toggleTopic: (id: string) => void;
  setIsGeneratingTopics: (val: boolean) => void;
  setCompetitors: (competitors: Competitor[]) => void;
  addCompetitor: (competitor: Competitor) => void;
  removeCompetitor: (id: string) => void;
  setIsGeneratingCompetitors: (val: boolean) => void;
  setSimulationResults: (results: SimulationResult[]) => void;
  setIsSimulating: (val: boolean) => void;
  setSimulationProgress: (val: number) => void;
  setMetrics: (metrics: VisibilityMetrics) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1,
  completedSteps: [],
  companyName: '',
  websiteUrl: '',
  description: '',
  category: '',
  scrapedFeatures: [] as string[],
  scrapedKeywords: [] as string[],
  isGeneratingDescription: false,
  topics: [],
  isGeneratingTopics: false,
  competitors: [],
  isGeneratingCompetitors: false,
  simulationResults: [],
  isSimulating: false,
  simulationProgress: 0,
  metrics: null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  
  setStep: (step) => set({ currentStep: step }),
  
  completeStep: (step) => set((state) => ({
    completedSteps: state.completedSteps.includes(step) 
      ? state.completedSteps 
      : [...state.completedSteps, step]
  })),
  
  setCompanyInfo: (name, url) => set({ companyName: name, websiteUrl: url }),
  
  setDescription: (desc) => set({ description: desc }),
  
  setScrapedData: (category, features, keywords) => set({ 
    category, 
    scrapedFeatures: features, 
    scrapedKeywords: keywords 
  }),
  
  setIsGeneratingDescription: (val) => set({ isGeneratingDescription: val }),
  
  setTopics: (topics) => set({ topics }),
  
  toggleTopic: (id) => set((state) => ({
    topics: state.topics.map(t => 
      t.id === id ? { ...t, selected: !t.selected } : t
    )
  })),
  
  setIsGeneratingTopics: (val) => set({ isGeneratingTopics: val }),
  
  setCompetitors: (competitors) => set({ competitors }),
  
  addCompetitor: (competitor) => set((state) => ({
    competitors: [...state.competitors, competitor]
  })),
  
  removeCompetitor: (id) => set((state) => ({
    competitors: state.competitors.filter(c => c.id !== id)
  })),
  
  setIsGeneratingCompetitors: (val) => set({ isGeneratingCompetitors: val }),
  
  setSimulationResults: (results) => set({ simulationResults: results }),
  
  setIsSimulating: (val) => set({ isSimulating: val }),
  
  setSimulationProgress: (val) => set({ simulationProgress: val }),
  
  setMetrics: (metrics) => set({ metrics }),
  
  reset: () => set(initialState),
}));
