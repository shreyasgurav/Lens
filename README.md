# Lens - Show your brand in AI responses.

Track how your brand appears in AI-generated responses (ChatGPT, Claude, Perplexity).

## Features

- **Website Scraping**: Automatically extracts business information from your website
- **AI-Generated Description**: Creates a canonical business description
- **Topic Discovery**: Identifies relevant AI search topics for your business
- **Competitor Analysis**: Finds and tracks your competitors
- **AI Search Simulation**: Simulates how AI assistants respond to queries about your space
- **Visibility Metrics**: Tracks brand visibility percentage, ranking, and share of voice

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **State**: Zustand
- **AI**: OpenAI GPT-4
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Add your OpenAI API key to .env
# OPENAI_API_KEY=sk-your-key-here

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start the onboarding flow.

## Project Structure

```
Result/
├── app/
│   ├── api/
│   │   ├── generate-description/   # Scrapes website, generates description
│   │   ├── generate-topics/        # Generates AI search topics
│   │   ├── generate-competitors/   # Identifies competitors
│   │   └── simulate-search/        # Runs AI search simulations
│   ├── dashboard/                  # Dashboard with metrics
│   ├── onboarding/                 # Multi-step onboarding flow
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Sidebar.tsx                 # Onboarding progress sidebar
│   └── steps/
│       ├── StepWebsite.tsx         # Step 1: Company info input
│       ├── StepDescription.tsx     # Step 2: Edit description
│       ├── StepTopics.tsx          # Step 3: Select topics
│       ├── StepCompetitors.tsx     # Step 4: Add competitors
│       └── StepAnalysis.tsx        # Step 5: View simulation results
└── lib/
    ├── store.ts                    # Zustand state management
    └── types.ts                    # TypeScript types
```

## Flow

1. **Website Input** → Enter company name and website URL
2. **Description** → AI scrapes site and generates description (editable)
3. **Topics** → Select 3+ topics you want to rank for in AI responses
4. **Competitors** → Review and edit auto-suggested competitors
5. **Simulation** → View AI search results and see where you appear
6. **Dashboard** → Track visibility metrics over time

## API Endpoints

- `POST /api/generate-description` - Scrapes website and generates description
- `POST /api/generate-topics` - Generates relevant AI search topics
- `POST /api/generate-competitors` - Identifies competitors
- `POST /api/simulate-search` - Simulates AI searches and extracts mentions

## License

MIT
