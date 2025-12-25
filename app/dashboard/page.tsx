"use client";

import { useOnboardingStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Zap,
  FileText,
  Target,
  Settings,
  BookOpen,
  LogOut,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { companyName, websiteUrl, metrics, competitors, simulationResults, topics, actions, actionsSummary, toggleActionComplete, setTopics, toggleTopic } = useOnboardingStore();
  const [selectedView, setSelectedView] = useState<string>("dashboard");
  const [visibleCompetitors, setVisibleCompetitors] = useState<Set<string>>(new Set());
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  
  // Agent Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyName) {
      router.push("/onboarding");
    }
  }, [companyName, router]);

  // Initialize visible competitors
  useEffect(() => {
    if (competitors.length > 0) {
      const initialVisible = new Set([companyName, ...competitors.slice(0, 4).map(c => c.name)]);
      setVisibleCompetitors(initialVisible);
    }
  }, [competitors, companyName]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Calculate competitor rankings with market share
  const competitorRankings = useMemo(() => {
    if (!simulationResults.length) return [];
    const mentionCounts = new Map<string, number>();
    
    // Count mentions for your brand
    mentionCounts.set(companyName, 0);
    
    // Add all competitors
    competitors.forEach(c => {
      mentionCounts.set(c.name, 0);
    });

    simulationResults.forEach(result => {
      if (result.yourBrandMentioned) {
        mentionCounts.set(companyName, (mentionCounts.get(companyName) || 0) + 1);
      }
      result.mentionedBrands?.forEach(brand => {
        if (mentionCounts.has(brand.name)) {
          mentionCounts.set(brand.name, (mentionCounts.get(brand.name) || 0) + 1);
        }
      });
    });

    const total = simulationResults.length;
    
    return Array.from(mentionCounts.entries())
      .map(([name, mentions]) => {
        const isYourBrand = name.toLowerCase() === companyName.toLowerCase();
        const competitor = competitors.find(c => c.name.toLowerCase() === name.toLowerCase());
        
        // Get favicon: use websiteUrl for your brand, competitor favicon for others
        let favicon = null;
        if (isYourBrand && websiteUrl) {
          try {
            // Add protocol if missing
            let urlString = websiteUrl;
            if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
              urlString = 'https://' + urlString;
            }
            const url = new URL(urlString);
            const hostname = url.hostname.replace('www.', '');
            // Use DuckDuckGo for better reliability
            favicon = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
            console.log('Your brand favicon URL:', favicon);
          } catch (e) {
            console.error('Error creating favicon URL for your brand:', e);
            favicon = null;
          }
        } else {
          favicon = competitor?.favicon || null;
        }
        
        return {
          name,
          mentions,
          visibility: total > 0 ? (mentions / total) * 100 : 0,
          isYou: isYourBrand,
          favicon,
        };
      })
      .sort((a, b) => b.mentions - a.mentions);
  }, [simulationResults, companyName, competitors, websiteUrl]);

  // Generate chart data from actual simulation results
  const chartData = useMemo(() => {
    if (!simulationResults.length) return [];
    
    // For now, create mock date-based data points
    // In the future, this will use actual simulation run dates
    const today = new Date();
    const dataPoints = [];
    
    // Generate 4 data points over the last week
    for (let i = 3; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - (i * 2)); // Every 2 days
      
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const point: Record<string, string | number> = { date: dateStr };
      
      // For each competitor, calculate visibility with slight variation over time
      competitorRankings.forEach(comp => {
        // Add some random variation (±10%) to show trend
        const baseVisibility = comp.visibility;
        const variation = (Math.random() - 0.5) * 20; // -10% to +10%
        const value = Math.max(0, Math.min(100, baseVisibility + variation));
        point[comp.name] = Math.round(value * 10) / 10; // Round to 1 decimal
      });
      
      dataPoints.push(point);
    }
    
    return dataPoints;
  }, [competitorRankings]);

  // Citation share
  const citationShare = useMemo(() => {
    if (!simulationResults.length) return 0;
    const totalMentions = competitorRankings.reduce((sum, c) => sum + c.mentions, 0);
    const yourMentions = competitorRankings.find(c => c.isYou)?.mentions || 0;
    return totalMentions > 0 ? (yourMentions / totalMentions) * 100 : 0;
  }, [competitorRankings, simulationResults]);

  // Top sources - extract real sources from simulation results
  const topSources = useMemo(() => {
    const sourceCounts = new Map<string, { title: string; url: string; domain: string; count: number }>();
    
    simulationResults.forEach(result => {
      result.sources?.forEach((source: any) => {
        if (source.url) {
          try {
            const url = new URL(source.url);
            const domain = url.hostname.replace('www.', '');
            const key = domain;
            
            if (sourceCounts.has(key)) {
              sourceCounts.get(key)!.count++;
            } else {
              sourceCounts.set(key, {
                title: source.title || domain,
                url: source.url,
                domain: domain,
                count: 1
              });
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });
    });
    
    return Array.from(sourceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [simulationResults]);

  // Topic coverage
  const topicCoverage = useMemo(() => {
    const selectedTopics = topics.filter(t => t.selected);
    return selectedTopics.map(topic => {
      const topicResults = simulationResults.filter(r => 
        r.query?.toLowerCase().includes(topic.name.toLowerCase().split(' ').slice(0, 2).join(' '))
      );
      const appeared = topicResults.filter(r => r.yourBrandMentioned).length;
      const total = Math.max(topicResults.length, 1);
      
      // Find dominant competitor
      const competitorMentions: Record<string, number> = {};
      topicResults.forEach(r => {
        r.mentionedBrands?.forEach(b => {
          if (b.name.toLowerCase() !== companyName.toLowerCase()) {
            competitorMentions[b.name] = (competitorMentions[b.name] || 0) + 1;
          }
        });
      });
      const topCompetitor = Object.entries(competitorMentions).sort((a, b) => b[1] - a[1])[0];
      
      return {
        topic: topic.name,
        appeared,
        missed: total - appeared,
        total,
        coverage: (appeared / total) * 100,
        dominantCompetitor: topCompetitor ? topCompetitor[0] : null,
      };
    });
  }, [topics, simulationResults, companyName]);

  // Generate suggestions for agent
  const generateSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    
    // Low visibility topics
    topicCoverage.filter(t => t.coverage < 50).forEach(t => {
      suggestions.push(`Create content targeting "${t.topic}" - you only appear in ${t.coverage.toFixed(0)}% of these queries`);
    });
    
    // Competitor threats
    const topCompetitor = competitorRankings.find(c => !c.isYou);
    if (topCompetitor && topCompetitor.visibility > (metrics?.visibilityPercentage || 0)) {
      suggestions.push(`Analyze ${topCompetitor.name}'s content strategy - they have ${(topCompetitor.visibility - (metrics?.visibilityPercentage || 0)).toFixed(1)}% higher visibility`);
    }
    
    // Source opportunities
    suggestions.push("Improve your Wikipedia presence - it's cited in 35% of AI responses");
    suggestions.push("Create comprehensive comparison pages to appear in 'best' and 'vs' queries");
    suggestions.push("Add structured FAQ content to match question-based searches");
    
    return suggestions;
  }, [topicCoverage, competitorRankings, metrics]);

  // Agent chat handler
  const handleAgentChat = async (userMessage: string) => {
    if (!userMessage.trim()) return;
    
    const newUserMessage: ChatMessage = { role: "user", content: userMessage };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput("");
    setIsAgentThinking(true);

    // Simulate agent thinking and generate response
    await new Promise(resolve => setTimeout(resolve, 1500));

    const lowerMessage = userMessage.toLowerCase();
    let response = "";
    let suggestions: string[] = [];

    if (lowerMessage.includes("visibility") || lowerMessage.includes("appear")) {
      response = `Your current visibility is ${metrics?.visibilityPercentage.toFixed(1)}%. You appear in ${metrics?.mentionCount || 0} out of ${metrics?.totalPrompts || 0} AI responses.\n\nTo improve this:`;
      suggestions = [
        "Create more comparison content (e.g., 'X vs Y' pages)",
        "Add comprehensive FAQs that match natural language queries",
        "Ensure your product information is on authoritative sources like Wikipedia and GitHub"
      ];
    } else if (lowerMessage.includes("competitor") || lowerMessage.includes(competitorRankings[0]?.name.toLowerCase())) {
      const topComp = competitorRankings.find(c => !c.isYou);
      response = `Your top competitor is ${topComp?.name} with ${topComp?.visibility.toFixed(1)}% visibility.\n\nHere's what they're doing better:`;
      suggestions = [
        `${topComp?.name} appears more frequently in "best tool" queries - create comparison content`,
        "They likely have better coverage on high-authority domains",
        "Consider creating direct comparison pages: 'Your Brand vs " + topComp?.name + "'"
      ];
    } else if (lowerMessage.includes("improve") || lowerMessage.includes("better") || lowerMessage.includes("help")) {
      response = `Based on your data, here are the top actions to improve your AI visibility:`;
      suggestions = generateSuggestions.slice(0, 4);
    } else if (lowerMessage.includes("topic") || lowerMessage.includes("query") || lowerMessage.includes("search")) {
      const lowTopics = topicCoverage.filter(t => t.coverage < 50);
      response = `You have ${lowTopics.length} topics with less than 50% coverage:\n\n${lowTopics.map(t => `• "${t.topic}": ${t.coverage.toFixed(0)}%`).join('\n')}\n\nFocus on these first:`;
      suggestions = lowTopics.slice(0, 3).map(t => 
        `Create authoritative content for "${t.topic}" - ${t.dominantCompetitor ? `${t.dominantCompetitor} dominates this space` : 'opportunity to lead'}`
      );
    } else if (lowerMessage.includes("source") || lowerMessage.includes("citation")) {
      response = topSources.length > 0 
        ? `AI assistants cite these sources most frequently:\n\n${topSources.map((s, i) => `${i+1}. ${s.title}: ${s.count} citations`).join('\n')}\n\nYour priority actions:`
        : `No sources data yet. Run simulations to see which sources AI assistants cite.\n\nYour priority actions:`;
      suggestions = [
        "Ensure your brand has accurate Wikipedia coverage",
        "Publish technical content on GitHub and Stack Overflow",
        "Create guest posts on Medium with product mentions"
      ];
    } else {
      response = `I can help you improve your AI search visibility. Here's your current status:\n\n• Visibility: ${metrics?.visibilityPercentage.toFixed(1)}%\n• Ranking: #${competitorRankings.findIndex(c => c.isYou) + 1} in your market\n• Top competitor: ${competitorRankings.find(c => !c.isYou)?.name}\n\nWhat would you like to know more about?`;
      suggestions = [
        "How can I improve my visibility?",
        "What are my competitors doing?",
        "Which topics should I focus on?",
        "What sources should I target?"
      ];
    }

    const agentMessage: ChatMessage = { role: "assistant", content: response, suggestions };
    setChatMessages(prev => [...prev, agentMessage]);
    setIsAgentThinking(false);
  };

  // Colors for chart lines
  const chartColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"];

  if (!metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" />
          <p className="text-neutral-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const topCompetitor = competitorRankings.find(c => !c.isYou);
  const yourRanking = competitorRankings.findIndex(c => c.isYou) + 1;

  // Topic management functions
  const handleAddTopic = () => {
    if (!newTopic.trim()) return;
    const newTopicObj = {
      id: `topic-custom-${Date.now()}`,
      name: newTopic.trim(),
      selected: true,
    };
    setTopics([...topics, newTopicObj]);
    setNewTopic("");
  };

  const handleRemoveTopic = (id: string) => {
    setTopics(topics.filter(t => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-neutral-200 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-4 pl-6 flex items-center gap-2.5 border-b border-neutral-100">
          <img 
            src="/Lens Logo.png" 
            alt="Lens"
            className="w-8 h-8 object-contain"
          />
          
          {websiteUrl && (
            <>
              <div className="w-px h-5 bg-neutral-200" />
              {(() => {
                try {
                  // Add protocol if missing
                  let urlString = websiteUrl;
                  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
                    urlString = 'https://' + urlString;
                  }
                  const url = new URL(urlString);
                  const hostname = url.hostname.replace('www.', '');
                  // Use DuckDuckGo favicon service - often more reliable
                  const favicon = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
                  return (
                    <div className="relative">
                      <img 
                        src={favicon} 
                        alt={companyName}
                        className="w-6 h-6 rounded bg-white"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          // Try Google as fallback if DuckDuckGo fails
                          if (target.src.includes('duckduckgo')) {
                            target.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
                          } else {
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }
                        }}
                      />
                      <div 
                        className="w-6 h-6 bg-neutral-200 rounded flex items-center justify-center text-neutral-600 text-xs font-bold"
                        style={{ display: 'none' }}
                      >
                        {companyName[0]}
                      </div>
                    </div>
                  );
                } catch (e) {
                  console.error('Error loading sidebar favicon:', e);
                  return (
                    <div className="w-6 h-6 bg-neutral-200 rounded flex items-center justify-center text-neutral-600 text-xs font-bold">
                      {companyName[0]}
                    </div>
                  );
                }
              })()}
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Analytics */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Analytics</p>
            {[
              { id: "dashboard", icon: BarChart3, label: "Dashboard" },
              { id: "prompts", icon: MessageSquare, label: "Prompts" },
              { id: "topics", icon: FileText, label: "Topics" },
              { id: "sources", icon: ExternalLink, label: "Sources" },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                  selectedView === item.id 
                    ? "bg-neutral-100 text-neutral-900 font-medium" 
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Action */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Action</p>
            <button
              onClick={() => setSelectedView("agent")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                selectedView === "agent" 
                  ? "bg-blue-50 text-blue-700 font-medium" 
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Bot className="w-4 h-4" />
              AI Agent
            </button>
            <button
              onClick={() => setSelectedView("actions")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedView === "actions" 
                  ? "bg-neutral-100 text-neutral-900 font-medium" 
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Zap className="w-4 h-4" />
              Action Center
              {actions.filter(a => a.priority === 'high').length > 0 && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {actions.filter(a => a.priority === 'high').length}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-neutral-100">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg">
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button 
            onClick={() => router.push("/onboarding")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            New Analysis
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-56">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-neutral-900">{companyName}</h1>
          </div>
        </header>

        <div className="p-6">
          {/* Dashboard View */}
          {selectedView === "dashboard" && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-neutral-500">Brand Visibility</span>
                    <Info className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div className="text-3xl font-bold text-neutral-900">{metrics.visibilityPercentage.toFixed(1)}%</div>
                  <p className="text-xs text-neutral-400 mt-1">Based on {metrics.totalPrompts} prompts</p>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-neutral-500">Citation Share</span>
                    <Info className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div className="text-3xl font-bold text-neutral-900">{citationShare.toFixed(1)}%</div>
                  <p className="text-xs text-neutral-400 mt-1">{metrics.mentionCount} of {competitorRankings.reduce((s, c) => s + c.mentions, 0)} citations</p>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-neutral-500">Brand Ranking</span>
                  </div>
                  <div className="text-3xl font-bold text-neutral-900">#{yourRanking}</div>
                  <p className="text-xs text-neutral-400 mt-1">{yourRanking === 1 ? "Market Leader" : `of ${competitorRankings.length} brands`}</p>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-neutral-500">Top Competitor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {topCompetitor?.favicon ? (
                      <img 
                        src={topCompetitor.favicon} 
                        alt={topCompetitor.name}
                        className="w-8 h-8 rounded-lg object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center ${topCompetitor?.favicon ? 'hidden' : ''}`}>
                      <span className="text-emerald-600 font-bold text-sm">{topCompetitor?.name[0] || "?"}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-900">{topCompetitor?.name || "None"}</div>
                      <div className="text-xs text-neutral-400">{topCompetitor?.mentions || 0} mentions</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 gap-6">
                {/* Line Chart */}
                <div className="bg-white rounded-xl border border-neutral-200 p-8">
                  <div className="flex items-center gap-2 mb-8">
                    <h2 className="text-lg font-semibold text-neutral-900 m-0">Competitor Visibility</h2>
                    <button className="text-neutral-400 hover:text-neutral-600 transition-colors">
                      <Info size={20} />
                    </button>
                  </div>
                  
                  <div className="w-full h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#dbeafe" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#dbeafe" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        
                        <CartesianGrid
                          strokeDasharray="0"
                          stroke="#F3F4F6"
                          vertical={false}
                        />
                        
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#9CA3AF', fontSize: 14 }}
                          dy={10}
                        />
                        
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#9CA3AF', fontSize: 14 }}
                          ticks={[0, 25, 50, 75, 100]}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                          dx={-10}
                        />
                        
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[240px]">
                                  <div className="mb-3 text-gray-900 font-semibold text-sm">
                                    Visibility • {label}
                                  </div>
                                  <div className="space-y-2">
                                    {payload.map((entry: any, index: number) => {
                                      const comp = competitorRankings.find(c => c.name === entry.name);
                                      return (
                                        <div key={index} className="flex items-center gap-2">
                                          <div
                                            className="w-1 h-4 rounded"
                                            style={{ backgroundColor: entry.color }}
                                          />
                                          <span className="text-gray-700 text-sm flex items-center gap-1.5">
                                            {comp?.favicon && (
                                              <img 
                                                src={comp.favicon} 
                                                alt={entry.name}
                                                className="w-4 h-4 rounded"
                                              />
                                            )}
                                            <span>
                                              {entry.name} {comp?.isYou && '(You)'}: {entry.value}%
                                            </span>
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                          cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }}
                        />

                        {competitorRankings.slice(0, 5).map((comp, i) => (
                          <Line
                            key={comp.name}
                            type="monotone"
                            dataKey={comp.name}
                            stroke={chartColors[i]}
                            strokeWidth={comp.isYou ? 3 : 2.5}
                            dot={{
                              fill: chartColors[i],
                              strokeWidth: 2,
                              r: 5,
                              stroke: 'white',
                            }}
                            activeDot={{
                              r: 6,
                              strokeWidth: 2,
                              stroke: 'white',
                            }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* All Competitors */}
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-neutral-900">All Competitors</h3>
                    <span className="text-xs text-neutral-500">{competitorRankings.length} brands</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                    {competitorRankings.map((comp, i) => (
                      <div key={comp.name} className={`flex items-center gap-3 p-2 rounded-lg ${comp.isYou ? "bg-blue-50" : "hover:bg-neutral-50"}`}>
                        <span className="text-xs text-neutral-400 w-4">{i + 1}</span>
                        <div className="relative">
                          {comp.favicon ? (
                            <img 
                              src={comp.favicon} 
                              alt={comp.name}
                              className="w-7 h-7 rounded-lg object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                            style={{ 
                              backgroundColor: chartColors[i % chartColors.length] || "#888",
                              display: comp.favicon ? 'none' : 'flex'
                            }}
                          >
                            {comp.name[0]}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm truncate ${comp.isYou ? "font-semibold" : ""}`}>{comp.name}</span>
                            {comp.isYou && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">You</span>}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-neutral-700">{comp.visibility.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Sources */}
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-neutral-900">Top Sources</h3>
                    <button className="text-xs text-blue-600 hover:text-blue-700">View All</button>
                  </div>
                  <div className="space-y-3">
                    {topSources.length > 0 ? topSources.map((source, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400 w-4">{i + 1}</span>
                        <div className="relative">
                          <img 
                            src={`https://icons.duckduckgo.com/ip3/${source.domain}.ico`}
                            alt={source.title}
                            className="w-8 h-8 rounded-lg object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src.includes('duckduckgo')) {
                                target.src = `https://www.google.com/s2/favicons?domain=${source.domain}&sz=64`;
                              } else {
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }
                            }}
                          />
                          <div 
                            className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-sm font-semibold text-neutral-600"
                            style={{ display: 'none' }}
                          >
                            {source.domain[0].toUpperCase()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-900 truncate">{source.title}</div>
                          <div className="text-xs text-neutral-400 truncate">{source.domain}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-neutral-900">{source.count}</div>
                          <div className="text-xs text-neutral-400">citations</div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-neutral-400 text-center py-4">No sources yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Chat View */}
          {selectedView === "agent" && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden h-[calc(100vh-180px)] flex flex-col">
                {/* Chat Header */}
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-neutral-900">AI Visibility Agent</h2>
                    <p className="text-xs text-neutral-500">Ask me how to improve your AI search presence</p>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-blue-500" />
                      </div>
                      <h3 className="font-semibold text-neutral-900 mb-2">How can I help you today?</h3>
                      <p className="text-sm text-neutral-500 mb-6">Ask me anything about improving your AI visibility</p>
                      <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                        {[
                          "How can I improve my visibility?",
                          "What are my competitors doing?",
                          "Which topics should I focus on?",
                          "What sources should I target?"
                        ].map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleAgentChat(q)}
                            className="p-3 text-left text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                      <div className={`max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
                        <div className={`rounded-xl px-4 py-3 ${
                          msg.role === "user" 
                            ? "bg-neutral-900 text-white" 
                            : "bg-neutral-100 text-neutral-900"
                        }`}>
                          <p className="text-sm whitespace-pre-line">{msg.content}</p>
                        </div>
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {msg.suggestions.map((s, j) => (
                              <div key={j} className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg text-sm">
                                <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <span className="text-neutral-700">{s}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 bg-neutral-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <User className="w-4 h-4 text-neutral-600" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isAgentThinking && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="bg-neutral-100 rounded-xl px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-neutral-100">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAgentChat(chatInput)}
                      placeholder="Ask about improving your AI visibility..."
                      className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleAgentChat(chatInput)}
                      disabled={!chatInput.trim() || isAgentThinking}
                      className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions View */}
          {selectedView === "actions" && (
            <div className="space-y-6">
              {/* Header with Summary */}
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Action Center</h2>
                {actionsSummary && (
                  <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                    {actionsSummary.strategySummary}
                  </p>
                )}
              </div>

              {/* Actions List */}
              {actions.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
                  <Zap className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500">Run a simulation to get personalized action recommendations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* High Priority */}
                  {actions.filter(a => a.priority === 'high').length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">Priority Actions</h3>
                      {actions.filter(a => a.priority === 'high').map(action => (
                        <div 
                          key={action.id} 
                          onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                          className="bg-red-50 hover:bg-red-100 rounded-xl p-5 mb-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-neutral-900 mb-2">{action.title}</h4>
                              <p className="text-sm text-neutral-600 leading-relaxed">{action.description}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={action.completed || false}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleActionComplete(action.id);
                              }}
                              className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-neutral-900 cursor-pointer flex-shrink-0"
                            />
                          </div>

                          {/* Expanded Details */}
                          {expandedAction === action.id && (
                            <div className="space-y-5 border-t border-red-200 pt-5 mt-4">
                              {/* Evidence */}
                              <div>
                                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Why this matters</p>
                                <div className="bg-white/60 p-4 rounded-lg space-y-3 text-sm">
                                  {action.evidence.competitorExamples && action.evidence.competitorExamples.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <Users className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <span className="text-neutral-600">Competitors doing this: </span>
                                        <span className="font-medium text-neutral-900">{action.evidence.competitorExamples.join(', ')}</span>
                                      </div>
                                    </div>
                                  )}
                                  {action.evidence.sourceUrls && action.evidence.sourceUrls.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <ExternalLink className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <span className="text-neutral-600">Key sources: </span>
                                        {action.evidence.sourceUrls.map((url, i) => (
                                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">
                                            {url}
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {action.evidence.queryExamples && action.evidence.queryExamples.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <MessageSquare className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <span className="text-neutral-600">Example queries: </span>
                                        <div className="space-y-1 mt-1">
                                          {action.evidence.queryExamples.slice(0, 3).map((q, i) => (
                                            <div key={i} className="text-xs bg-white px-2 py-1 rounded border border-neutral-200">"{q}"</div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {(action.evidence.mentionCount || action.evidence.frequency) && (
                                    <div className="flex items-start gap-2">
                                      <BarChart3 className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <span className="text-neutral-600">Frequency: </span>
                                        <span className="font-medium text-neutral-900">
                                          {action.evidence.mentionCount || action.evidence.frequency} times in analysis
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Steps */}
                              <div>
                                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Action Steps</p>
                                <ol className="space-y-3">
                                  {action.steps.map((step, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm">
                                      <span className="w-6 h-6 bg-neutral-900 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                        {i + 1}
                                      </span>
                                      <span className="text-neutral-700 pt-0.5 leading-relaxed">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Medium Priority */}
                  {actions.filter(a => a.priority === 'medium').length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3 mt-6">Additional Actions</h3>
                      {actions.filter(a => a.priority === 'medium').map(action => (
                        <div 
                          key={action.id} 
                          onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                          className="bg-amber-50 hover:bg-amber-100 rounded-xl p-5 mb-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-neutral-900 mb-2">{action.title}</h4>
                              <p className="text-sm text-neutral-600 leading-relaxed">{action.description}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={action.completed || false}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleActionComplete(action.id);
                              }}
                              className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-neutral-900 cursor-pointer flex-shrink-0"
                            />
                          </div>

                          {expandedAction === action.id && (
                            <div className="space-y-5 border-t border-amber-200 pt-5 mt-4">
                              <div>
                                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Action Steps</p>
                                <ol className="space-y-3">
                                  {action.steps.map((step, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm">
                                      <span className="w-6 h-6 bg-neutral-900 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                        {i + 1}
                                      </span>
                                      <span className="text-neutral-700 pt-0.5 leading-relaxed">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prompts View */}
          {selectedView === "prompts" && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Simulations List */}
              <div className="space-y-3">
                {simulationResults.map((result, i) => (
                  <div key={i} className="border-b border-neutral-200 pb-4">
                    {/* Prompt Header */}
                    <button
                      onClick={() => setExpandedSource(expandedSource === i ? null : i)}
                      className="w-full flex items-start gap-3 text-left group py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base text-neutral-900 group-hover:text-neutral-700 transition-colors font-medium">{result.query}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-sm text-neutral-500">
                            {result.yourBrandMentioned ? `Position #${result.yourBrandPosition}` : "Not mentioned"}
                          </p>
                          <span className="text-sm text-neutral-300">•</span>
                          <p className="text-sm text-neutral-500">
                            {result.mentionedBrands.length} brand{result.mentionedBrands.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {expandedSource === i ? (
                        <ChevronUp className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-1" />
                      )}
                    </button>

                    {/* Expanded Content */}
                    {expandedSource === i && (
                      <div className="space-y-4 mt-4 pl-2">
                        {/* ChatGPT Response */}
                        <div className="pt-2">
                          <p className="text-sm font-medium text-neutral-700 mb-2">ChatGPT Response:</p>
                          <p className="text-sm text-neutral-600 leading-relaxed">{result.response}</p>
                        </div>

                        {/* Mentioned Brands */}
                        {result.mentionedBrands.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-neutral-700 mb-2">Mentioned Brands:</p>
                            <div className="flex flex-wrap gap-2">
                              {result.mentionedBrands.map((brand: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`px-3 py-1.5 rounded-full text-sm ${
                                    brand.name.toLowerCase() === companyName.toLowerCase()
                                      ? "bg-neutral-900 text-white"
                                      : "bg-neutral-100 text-neutral-700"
                                  }`}
                                >
                                  #{brand.position} {brand.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Source Links */}
                        {result.sources && result.sources.length > 0 && (
                          <div className="pt-2 border-t border-neutral-100">
                            <p className="text-sm font-medium text-neutral-700 mb-2">Sources</p>
                            <div className="space-y-2">
                              {result.sources.map((source: any, sidx: number) => (
                                <a
                                  key={sidx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-2 text-sm text-neutral-600 hover:text-blue-600 transition-colors group"
                                >
                                  <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5 text-neutral-400 group-hover:text-blue-600" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium group-hover:underline">{source.title}</p>
                                    <p className="text-neutral-400 text-xs truncate mt-0.5">{source.url}</p>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {simulationResults.length === 0 && (
                <p className="text-center text-sm text-neutral-400 py-8">
                  No simulations yet. Complete the onboarding to generate prompts.
                </p>
              )}
            </div>
          )}

          {/* Topics View */}
          {selectedView === "topics" && (
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Add Custom Topic */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
                  placeholder="Add custom topic"
                  className="flex-1 px-0 py-2.5 border-0 border-b-2 border-neutral-200 text-neutral-900 text-base placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors bg-transparent"
                />
                <button
                  onClick={handleAddTopic}
                  disabled={!newTopic.trim()}
                  className="px-4 py-2 text-neutral-900 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Topics Pills */}
              <div className="flex flex-wrap gap-2.5 justify-center">
                {topics.slice(0, 10).map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => toggleTopic(topic.id)}
                    className={`px-4 py-2 rounded-full text-sm transition-all whitespace-nowrap ${
                      topic.selected
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {topic.name}
                    {topic.id.startsWith('topic-custom-') && topic.selected && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTopic(topic.id);
                        }}
                        className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {topics.length === 0 && (
                <p className="text-center text-sm text-neutral-400">
                  No topics yet. Add your first topic above.
                </p>
              )}

              {topics.length > 10 && (
                <p className="text-center text-xs text-neutral-400">
                  Showing first 10 topics
                </p>
              )}
            </div>
          )}

          {/* Sources View */}
          {selectedView === "sources" && (
            <div className="max-w-3xl mx-auto">
              <div className="space-y-3">
                {topSources.length > 0 ? topSources.map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border-b border-neutral-200 pb-4 hover:bg-neutral-50 transition-colors rounded-lg p-3 -m-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-neutral-400 mt-1">{i + 1}</span>
                      <div className="relative flex-shrink-0">
                        <img 
                          src={`https://icons.duckduckgo.com/ip3/${source.domain}.ico`}
                          alt={source.title}
                          className="w-10 h-10 rounded-lg object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src.includes('duckduckgo')) {
                              target.src = `https://www.google.com/s2/favicons?domain=${source.domain}&sz=64`;
                            } else {
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }
                          }}
                        />
                        <div 
                          className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center text-base font-semibold text-neutral-600"
                          style={{ display: 'none' }}
                        >
                          {source.domain[0].toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-neutral-900 mb-1 group-hover:text-blue-600">
                          {source.title}
                        </h3>
                        <p className="text-sm text-neutral-500 truncate mb-2">{source.domain}</p>
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                          <span>{source.count} citation{source.count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-1" />
                    </div>
                  </a>
                )) : (
                  <div className="text-center py-12">
                    <ExternalLink className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <p className="text-neutral-500">No sources yet. Run simulations to see sources.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Competitors View */}
          {selectedView === "competitors" && (
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900">Competitor Analysis</h2>
                <p className="text-sm text-neutral-500">{competitorRankings.length} brands tracked</p>
              </div>

              {competitorRankings.map((comp, i) => (
                <div key={i} className={`border rounded-xl p-5 ${
                  comp.isYou ? "bg-blue-50 border-blue-200" : "bg-white border-neutral-200"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-neutral-300">#{i + 1}</div>
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: chartColors[i] || "#888" }}
                      >
                        {comp.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-neutral-900">{comp.name}</h3>
                          {comp.isYou && <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">You</span>}
                        </div>
                        <p className="text-sm text-neutral-500">{comp.mentions} mentions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-neutral-900">{comp.visibility.toFixed(1)}%</div>
                      <div className="text-sm text-neutral-500">visibility</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
