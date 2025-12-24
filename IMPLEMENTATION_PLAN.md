# Source-Based Competitor Analysis - Implementation Plan

## Goal
Understand WHY competitors appear in ChatGPT responses and give users actionable steps to compete.

---

## Phase 1: Enhanced Source Tracking (Backend)

### 1.1 Update `/api/simulate-search/route.ts`

**Current state:**
- Generates question from topic ✅
- Gets ChatGPT response ✅
- Extracts brands ✅
- Generates plausible sources ✅

**Add:**
```typescript
// After extracting brands, analyze which brands appear in which sources
interface BrandSourceMapping {
  brand: string;
  mentionedInSources: string[]; // URLs where this brand appears
  contentType: 'comparison' | 'review' | 'list' | 'tutorial' | 'general';
  prominence: 'high' | 'medium' | 'low'; // based on position in response
}

// New analysis step
const brandSourceAnalysis = await analyzeBrandSources(response, mentionedBrands, sources);
```

**Return enhanced data:**
```typescript
{
  query: string;
  response: string;
  mentionedBrands: [...],
  sources: [...],
  brandSourceMappings: BrandSourceMapping[]; // NEW
}
```

---

### 1.2 Create `/api/analyze-competitor/route.ts`

**Purpose:** Deep analysis of why a specific competitor wins

**Input:**
```typescript
{
  competitorName: string;
  yourBrand: string;
  simulationResults: SimulationResult[];
  topics: Topic[];
}
```

**Logic:**
1. Filter results where competitor appears
2. Identify:
   - Topics they dominate (appear but you don't)
   - Sources they're strong in (Wikipedia, G2, etc.)
   - Content patterns (comparison pages, "best X" lists)
   - Query types (branded vs non-branded)

**Output:**
```typescript
{
  competitor: string;
  analysis: {
    visibilityGap: number; // % difference
    mentionFrequency: { them: number; you: number };
    
    topicsTheyWin: {
      topic: string;
      theirAppearances: number;
      yourAppearances: number;
      gap: number;
    }[];
    
    sourceStrength: {
      source: string; // "Wikipedia", "G2", etc.
      url: string;
      theyAppear: boolean;
      youAppear: boolean;
      importance: 'critical' | 'high' | 'medium';
    }[];
    
    contentPatterns: {
      type: string; // "comparison", "review", "best-of-list"
      frequency: number;
      examples: string[]; // sample queries
    }[];
    
    explanation: string; // GPT-generated summary
  };
  
  recommendations: Action[];
}
```

---

### 1.3 Create `/api/generate-actions/route.ts`

**Purpose:** Turn analysis into specific, actionable tasks

**Input:**
```typescript
{
  yourBrand: string;
  competitorAnalysis: CompetitorAnalysis[];
  simulationResults: SimulationResult[];
  topics: Topic[];
}
```

**Logic:**
```typescript
// Identify gaps
const missingWikipedia = !yourBrand.hasWikipediaPage && competitors.some(c => c.hasWikipediaPage);
const missingG2 = !yourBrand.hasG2Listing && competitors.some(c => c.hasG2Listing);
const weakTopics = topics.filter(t => yourCoverage < 30%);

// Generate actions
const actions = [
  {
    id: "action-1",
    priority: "high",
    category: "source_presence",
    title: "Create Wikipedia page",
    description: "3 of your top competitors have Wikipedia pages. ChatGPT frequently cites Wikipedia.",
    impact: "+25% visibility",
    effort: "high",
    steps: [
      "Ensure your company meets Wikipedia notability guidelines",
      "Gather reliable secondary sources (press coverage, reviews)",
      "Draft article following Wikipedia style guide",
      "Submit for review"
    ],
    evidence: {
      competitorExamples: ["Notion", "Asana"],
      sourceUrls: ["wikipedia.org/wiki/Notion"],
      mentionCount: 12
    }
  },
  {
    id: "action-2",
    priority: "high",
    category: "content_creation",
    title: "Create comparison pages",
    description: "ChatGPT mentions competitors in 'X vs Y' queries. Create comparison content.",
    impact: "+15% visibility",
    effort: "medium",
    steps: [
      "Create 'YourBrand vs Notion' comparison page",
      "Create 'YourBrand vs Asana' comparison page",
      "Include feature comparison tables",
      "Add to your website's /compare/ section"
    ],
    evidence: {
      queryExamples: ["Notion vs Asana", "Best alternative to Notion"],
      competitorPages: ["notion.com/vs/asana"],
      frequency: 8
    }
  }
];
```

**Output:**
```typescript
{
  actions: Action[];
  summary: {
    totalActions: number;
    highPriority: number;
    estimatedImpact: string; // "+40% visibility"
  };
}
```

---

## Phase 2: Frontend Components

### 2.1 Update Store (`lib/store.ts`)

Add:
```typescript
interface CompetitorAnalysis {
  competitor: string;
  analysis: {...};
  recommendations: Action[];
}

interface Action {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'source_presence' | 'content_creation' | 'topic_coverage' | 'seo';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  steps: string[];
  evidence: {
    competitorExamples?: string[];
    sourceUrls?: string[];
    queryExamples?: string[];
    mentionCount?: number;
    frequency?: number;
  };
  completed?: boolean;
}

// Add to store
competitorAnalyses: CompetitorAnalysis[];
actions: Action[];
setCompetitorAnalyses: (analyses: CompetitorAnalysis[]) => void;
setActions: (actions: Action[]) => void;
toggleActionComplete: (actionId: string) => void;
```

---

### 2.2 Create `components/CompetitorInsightPanel.tsx`

**Purpose:** Show why a competitor wins when clicked

```tsx
interface Props {
  competitor: string;
  analysis: CompetitorAnalysis;
  onClose: () => void;
}

// UI Structure:
// - Header: "Why [Competitor] appears more"
// - Stats: Visibility gap, mention frequency
// - Section: "Topics they dominate"
//   - List of topics with bars showing gap
// - Section: "Where they're strong"
//   - Source cards (Wikipedia, G2, etc.) with checkmarks
// - Section: "Content patterns"
//   - Pills showing "Comparison pages", "Review sites", etc.
// - Section: "What you should do"
//   - Top 3 recommended actions
// - CTA: "View all actions" → goes to Action Center
```

---

### 2.3 Redesign Action Center (`dashboard/page.tsx`)

**Current:** Simple list of suggestions

**New structure:**
```tsx
// Group actions by priority
const highPriority = actions.filter(a => a.priority === 'high');
const mediumPriority = actions.filter(a => a.priority === 'medium');
const lowPriority = actions.filter(a => a.priority === 'low');

// Action Card UI:
<div className="action-card">
  {/* Header */}
  <div className="flex items-start gap-4">
    <PriorityBadge priority={action.priority} />
    <div>
      <h3>{action.title}</h3>
      <p>{action.description}</p>
      <div className="flex gap-2">
        <Badge>Impact: {action.impact}</Badge>
        <Badge>Effort: {action.effort}</Badge>
      </div>
    </div>
    <Checkbox checked={action.completed} />
  </div>
  
  {/* Evidence - Expandable */}
  <Collapsible>
    <div className="evidence">
      <p>Based on analysis of {evidence.mentionCount} ChatGPT responses</p>
      {evidence.competitorExamples && (
        <div>
          <strong>Competitors doing this:</strong>
          {evidence.competitorExamples.map(c => <Chip>{c}</Chip>)}
        </div>
      )}
      {evidence.sourceUrls && (
        <div>
          <strong>Example sources:</strong>
          {evidence.sourceUrls.map(url => <Link>{url}</Link>)}
        </div>
      )}
    </div>
  </Collapsible>
  
  {/* Steps - Expandable */}
  <Collapsible>
    <ol>
      {action.steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  </Collapsible>
  
  {/* CTA */}
  <Button>Mark as Complete</Button>
</div>
```

---

### 2.4 Update Competitors View

Add click handler:
```tsx
<CompetitorCard onClick={() => {
  // Fetch analysis if not already loaded
  if (!competitorAnalyses[competitor.name]) {
    fetchCompetitorAnalysis(competitor.name);
  }
  setSelectedCompetitor(competitor.name);
  setShowInsightPanel(true);
}} />

{showInsightPanel && (
  <CompetitorInsightPanel
    competitor={selectedCompetitor}
    analysis={competitorAnalyses[selectedCompetitor]}
    onClose={() => setShowInsightPanel(false)}
  />
)}
```

---

## Phase 3: Data Flow

### On Analysis Complete (StepAnalysis)

```typescript
// After simulation finishes
const results = simulationResults;

// 1. Analyze each competitor
const analyses = await Promise.all(
  competitors.map(comp => 
    fetch('/api/analyze-competitor', {
      body: JSON.stringify({
        competitorName: comp.name,
        yourBrand: companyName,
        simulationResults: results,
        topics: selectedTopics
      })
    })
  )
);

// 2. Generate actions
const actionsResponse = await fetch('/api/generate-actions', {
  body: JSON.stringify({
    yourBrand: companyName,
    competitorAnalysis: analyses,
    simulationResults: results,
    topics: selectedTopics
  })
});

// 3. Store in Zustand
setCompetitorAnalyses(analyses);
setActions(actionsResponse.actions);
```

---

## Phase 4: UI Polish

### Action Center Badge
- ✅ Make circular (done)
- Show count of HIGH priority actions only
- Pulse animation when new actions available

### AI Agent
- ✅ Remove sparkles (done)
- Keep clean, minimal

### Competitor Cards
- Add "View Insights" button on hover
- Show mini-indicator: "Strong in 3 sources"

---

## Implementation Order

1. **Week 1: Backend**
   - [ ] Update simulate-search to track brand-source mappings
   - [ ] Create analyze-competitor endpoint
   - [ ] Create generate-actions endpoint
   - [ ] Test with real simulation data

2. **Week 2: Store & Data Flow**
   - [ ] Update Zustand store with new types
   - [ ] Wire up analysis after simulation
   - [ ] Cache analyses to avoid re-computation

3. **Week 3: UI Components**
   - [ ] Build CompetitorInsightPanel
   - [ ] Redesign Action Center
   - [ ] Add click handlers to Competitors view
   - [ ] Polish and test

4. **Week 4: Polish & Launch**
   - [ ] Add loading states
   - [ ] Error handling
   - [ ] Empty states
   - [ ] User testing

---

## Success Metrics

- Users understand WHY competitors appear
- Actions are specific and actionable (not generic advice)
- Evidence is clear (show the sources, queries, data)
- Users can track progress (mark actions complete)

---

## Notes

- Keep simulation logic simple (no browsing for now)
- Focus on making insights ACTIONABLE
- Show evidence for every recommendation
- Make it easy to see "what to do next"
