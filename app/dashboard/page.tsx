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
  Info,
  ExternalLink,
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { companyName, metrics, competitors, simulationResults, topics } = useOnboardingStore();
  const [selectedView, setSelectedView] = useState<string>("dashboard");
  const [visibleCompetitors, setVisibleCompetitors] = useState<Set<string>>(new Set());
  
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
      .map(([name, mentions]) => ({
        name,
        mentions,
        visibility: total > 0 ? (mentions / total) * 100 : 0,
        isYou: name.toLowerCase() === companyName.toLowerCase(),
      }))
      .sort((a, b) => b.mentions - a.mentions);
  }, [simulationResults, companyName, competitors]);

  // Generate chart data (simulated time series)
  const chartData = useMemo(() => {
    const dates = ["Oct 28", "Oct 30", "Nov 01", "Nov 03", "Nov 05", "Nov 07"];
    return dates.map((date, i) => {
      const data: Record<string, string | number> = { date };
      competitorRankings.forEach((comp, j) => {
        // Simulate some variation in data
        const baseValue = comp.visibility;
        const variation = (Math.sin(i + j) * 10) + (Math.random() * 5 - 2.5);
        data[comp.name] = Math.max(0, Math.min(100, baseValue + variation)).toFixed(1);
      });
      return data;
    });
  }, [competitorRankings]);

  // Citation share
  const citationShare = useMemo(() => {
    if (!simulationResults.length) return 0;
    const totalMentions = competitorRankings.reduce((sum, c) => sum + c.mentions, 0);
    const yourMentions = competitorRankings.find(c => c.isYou)?.mentions || 0;
    return totalMentions > 0 ? (yourMentions / totalMentions) * 100 : 0;
  }, [competitorRankings, simulationResults]);

  // Top sources
  const topSources = useMemo(() => {
    const total = simulationResults.length || 1;
    return [
      { name: "Wikipedia", domain: "wikipedia.org", citations: Math.floor(total * 0.35), icon: "W" },
      { name: "Medium", domain: "medium.com", citations: Math.floor(total * 0.25), icon: "M" },
      { name: "GitHub", domain: "github.com", citations: Math.floor(total * 0.20), icon: "G" },
      { name: "Stack Overflow", domain: "stackoverflow.com", citations: Math.floor(total * 0.12), icon: "S" },
      { name: "Reddit", domain: "reddit.com", citations: Math.floor(total * 0.08), icon: "R" },
    ];
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
      response = `AI assistants cite these sources most frequently:\n\n${topSources.map((s, i) => `${i+1}. ${s.name}: ${s.citations} citations`).join('\n')}\n\nYour priority actions:`;
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

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-neutral-200 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-neutral-100">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span className="font-semibold text-neutral-900">Lens</span>
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
              { id: "competitors", icon: Users, label: "Competitors" },
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
              <Sparkles className="w-3 h-3 ml-auto text-blue-500" />
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
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {generateSuggestions.length}
              </span>
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
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{companyName}</h1>
              <p className="text-sm text-neutral-500">AI Visibility Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50">
                Last 7 days
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
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
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
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
              <div className="grid grid-cols-5 gap-6">
                {/* Line Chart */}
                <div className="col-span-3 bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-neutral-900">Competitor Visibility</h3>
                      <p className="text-xs text-neutral-500">Visibility trend over time</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {competitorRankings.slice(0, 5).map((comp, i) => (
                        <button
                          key={comp.name}
                          onClick={() => {
                            const newSet = new Set(visibleCompetitors);
                            if (newSet.has(comp.name)) {
                              newSet.delete(comp.name);
                            } else {
                              newSet.add(comp.name);
                            }
                            setVisibleCompetitors(newSet);
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                            visibleCompetitors.has(comp.name) 
                              ? "bg-neutral-100" 
                              : "bg-neutral-50 opacity-50"
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors[i] }} />
                          <span>{comp.name}</span>
                          {comp.isYou && <span className="text-neutral-400">(You)</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#999" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#999" domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
                          formatter={(value) => [`${value}%`, ""]}
                        />
                        {competitorRankings.slice(0, 5).map((comp, i) => (
                          visibleCompetitors.has(comp.name) && (
                            <Line
                              key={comp.name}
                              type="monotone"
                              dataKey={comp.name}
                              stroke={chartColors[i]}
                              strokeWidth={comp.isYou ? 3 : 2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          )
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Rankings Table */}
                <div className="col-span-2 bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-neutral-900">Competitor Rankings</h3>
                  </div>
                  <div className="space-y-2">
                    {competitorRankings.slice(0, 6).map((comp, i) => {
                      const trend = Math.random() > 0.5 ? "up" : Math.random() > 0.5 ? "down" : "same";
                      return (
                        <div key={comp.name} className={`flex items-center gap-3 p-2.5 rounded-lg ${comp.isYou ? "bg-blue-50" : "hover:bg-neutral-50"}`}>
                          <span className="text-sm text-neutral-400 w-4">{i + 1}</span>
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: chartColors[i] || "#888" }}
                          >
                            {comp.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm truncate ${comp.isYou ? "font-semibold" : ""}`}>{comp.name}</span>
                              {comp.isYou && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">You</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {trend === "up" && <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />}
                            {trend === "down" && <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                            {trend === "same" && <Minus className="w-3.5 h-3.5 text-neutral-400" />}
                            <span className="text-sm font-medium text-neutral-700 w-14 text-right">{comp.visibility.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Citation Share Bar */}
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <h3 className="font-semibold text-neutral-900 mb-4">Citation Share by Brand</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={competitorRankings.slice(0, 5)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Visibility"]} />
                        <Bar 
                          dataKey="visibility" 
                          fill="#3B82F6"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Sources */}
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-neutral-900">Top Sources</h3>
                    <button className="text-xs text-blue-600 hover:text-blue-700">View All</button>
                  </div>
                  <div className="space-y-3">
                    {topSources.map((source, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400 w-4">{i + 1}</span>
                        <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-sm font-semibold text-neutral-600">
                          {source.icon}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-neutral-900">{source.name}</div>
                          <div className="text-xs text-neutral-400">{source.domain}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-neutral-900">{source.citations}</div>
                          <div className="text-xs text-neutral-400">citations</div>
                        </div>
                      </div>
                    ))}
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
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900">Recommended Actions</h2>
                <p className="text-sm text-neutral-500">Data-driven suggestions to improve your AI visibility</p>
              </div>

              {generateSuggestions.map((suggestion, i) => (
                <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-neutral-900">{suggestion}</p>
                  </div>
                  <button className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors">
                    Take Action
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Prompts View */}
          {selectedView === "prompts" && (
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900">AI Responses</h2>
                <p className="text-sm text-neutral-500">{simulationResults.length} simulated prompts</p>
              </div>

              {simulationResults.map((result, i) => (
                <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      result.yourBrandMentioned ? "bg-green-100" : "bg-neutral-100"
                    }`}>
                      {result.yourBrandMentioned ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-neutral-900 truncate">{result.query}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          result.yourBrandMentioned 
                            ? "bg-green-100 text-green-700" 
                            : "bg-neutral-100 text-neutral-600"
                        }`}>
                          {result.yourBrandMentioned ? `#${result.yourBrandPosition} Mentioned` : "Not Mentioned"}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 line-clamp-2 mb-3">{result.response}</p>
                      {result.mentionedBrands?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-neutral-500">Brands:</span>
                          {result.mentionedBrands.map((brand, j) => (
                            <span 
                              key={j} 
                              className={`px-2 py-1 rounded text-xs ${
                                brand.name.toLowerCase() === companyName.toLowerCase()
                                  ? "bg-blue-100 text-blue-700 font-medium"
                                  : "bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              {brand.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Topics View */}
          {selectedView === "topics" && (
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900">Topic Coverage</h2>
                <p className="text-sm text-neutral-500">Where you appear vs where you don't</p>
              </div>

              {topicCoverage.map((topic, i) => (
                <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-neutral-900 mb-1">{topic.topic}</h3>
                      <div className="flex items-center gap-4 text-sm text-neutral-500">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          {topic.appeared} appeared
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          {topic.missed} missed
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-neutral-900">{topic.coverage.toFixed(0)}%</div>
                      <div className="text-xs text-neutral-500">coverage</div>
                    </div>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${topic.coverage}%` }} />
                  </div>
                  {topic.dominantCompetitor && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                      <span><strong>{topic.dominantCompetitor}</strong> dominates when you're absent</span>
                    </div>
                  )}
                </div>
              ))}
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

          {/* Sources View */}
          {selectedView === "sources" && (
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900">Citation Sources</h2>
                <p className="text-sm text-neutral-500">Where AI gets its information</p>
              </div>

              {topSources.map((source, i) => (
                <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-neutral-300">#{i + 1}</div>
                      <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-lg font-bold text-neutral-600">
                        {source.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900">{source.name}</h3>
                        <a href={`https://${source.domain}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                          {source.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-neutral-900">{source.citations}</div>
                      <div className="text-sm text-neutral-500">citations</div>
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
