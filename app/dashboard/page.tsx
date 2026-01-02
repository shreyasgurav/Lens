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
  ChevronRight,
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
  ArrowUp,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  Check,
  Copy
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
  const { 
    companyName, 
    websiteUrl, 
    description,
    metrics, 
    competitors, 
    simulationResults, 
    topics, 
    actions, 
    actionsSummary, 
    toggleActionComplete, 
    setTopics, 
    toggleTopic, 
    addCompetitor, 
    removeCompetitor,
    contentRecommendations,
    outreachRecommendations,
    setContentRecommendations,
    toggleContentComplete,
    toggleOutreachComplete,
    isExtractingClaims,
    setIsExtractingClaims,
  } = useOnboardingStore();
  const [selectedView, setSelectedView] = useState<string>("dashboard");
  const [visibleCompetitors, setVisibleCompetitors] = useState<Set<string>>(new Set());
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const [expandedOutreach, setExpandedOutreach] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  
  // Agent Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedItemId) {
      const timer = setTimeout(() => {
        setCopiedItemId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedItemId]);

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

  // Auto-select first content idea when opening content view
  useEffect(() => {
    if (selectedView === "content" && contentRecommendations.length > 0) {
      setExpandedContent(contentRecommendations[0].id);
    }
  }, [selectedView, contentRecommendations]);

  // Auto-select first outreach when opening outreach view
  useEffect(() => {
    if (selectedView === "outreach" && outreachRecommendations.length > 0) {
      setExpandedOutreach(outreachRecommendations[0].id);
    }
  }, [selectedView, outreachRecommendations]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Maximum height in pixels
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [chatInput]);

  // Claims are now extracted automatically in StepAnalysis after simulations complete
  // Manual refresh is still available via the Refresh button

  const extractClaims = async () => {
    if (isExtractingClaims || simulationResults.length === 0) return;
    
    setIsExtractingClaims(true);
    try {
      const response = await fetch('/api/extract-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationResults,
          companyName,
          competitors,
          description,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setContentRecommendations(data.contentRecommendations || [], data.outreachRecommendations || []);
      }
    } catch (error) {
      console.error('Failed to extract claims:', error);
    } finally {
      setIsExtractingClaims(false);
    }
  };


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
      // Count your brand
      if (result.yourBrandMentioned) {
        mentionCounts.set(companyName, (mentionCounts.get(companyName) || 0) + 1);
      }
      
      // Count each competitor brand only ONCE per result (even if mentioned multiple times)
      // Exclude your brand since it's already counted above
      const uniqueBrandsInResult = new Set<string>();
      result.mentionedBrands?.forEach(brand => {
        // Skip your brand to avoid double counting
        if (mentionCounts.has(brand.name) && brand.name.toLowerCase() !== companyName.toLowerCase()) {
          uniqueBrandsInResult.add(brand.name);
        }
      });
      
      // Increment count for each unique brand
      uniqueBrandsInResult.forEach(brandName => {
        mentionCounts.set(brandName, (mentionCounts.get(brandName) || 0) + 1);
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
    
    // Build comprehensive context from dashboard data
    const yourRanking = competitorRankings.findIndex(c => c.isYou) + 1;
    const topCompetitor = competitorRankings.find(c => !c.isYou);
    const yourVisibility = metrics?.visibilityPercentage.toFixed(1) || '0.0';
    const totalCompetitors = competitorRankings.length;
    const lowCoverageTopics = topicCoverage.filter(t => t.coverage < 50);
    const completedContent = contentRecommendations.filter(c => c.completed).length;
    const totalContent = contentRecommendations.length;
    const completedOutreach = outreachRecommendations.filter(o => o.completed).length;
    const totalOutreach = outreachRecommendations.length;
    const incompleteContent = contentRecommendations.filter(c => !c.completed);
    const incompleteOutreach = outreachRecommendations.filter(o => !o.completed);
    
    // Generate natural, context-aware response
    let response = "";
    let suggestions: string[] = [];

    // Check for specific topics
    if (lowerMessage.includes("competitor") || lowerMessage.includes("competition") || competitors.some(c => lowerMessage.includes(c.name.toLowerCase()))) {
      const mentionedCompetitor = competitors.find(c => lowerMessage.includes(c.name.toLowerCase()));
      if (mentionedCompetitor) {
        const compRanking = competitorRankings.find(c => c.name.toLowerCase() === mentionedCompetitor.name.toLowerCase());
        response = `${mentionedCompetitor.name} has ${compRanking?.visibility.toFixed(1) || '0'}% visibility compared to your ${yourVisibility}%. `;
        if (compRanking && compRanking.visibility > parseFloat(yourVisibility)) {
          response += `They're outperforming you by ${(compRanking.visibility - parseFloat(yourVisibility)).toFixed(1)} percentage points. `;
        }
        response += `To compete, focus on creating comparison content and targeting the same high-authority sources they're using.`;
      suggestions = [
          `Create a "${companyName} vs ${mentionedCompetitor.name}" comparison page`,
          "Analyze their content strategy and identify gaps",
          "Target the same sources they're being cited on"
        ];
      } else {
        response = `You're currently ranked #${yourRanking} out of ${totalCompetitors} competitors. `;
        if (topCompetitor) {
          response += `Your top competitor is ${topCompetitor.name} with ${topCompetitor.visibility.toFixed(1)}% visibility. `;
          if (topCompetitor.visibility > parseFloat(yourVisibility)) {
            response += `They're ahead by ${(topCompetitor.visibility - parseFloat(yourVisibility)).toFixed(1)} percentage points. `;
          }
        }
        response += `I can help you analyze specific competitors or create a strategy to outrank them.`;
      suggestions = [
          `Analyze ${topCompetitor?.name || 'top competitor'}'s strategy`,
          "See all competitors and their visibility",
          "Create comparison content to compete"
        ];
      }
    } else if (lowerMessage.includes("content") || lowerMessage.includes("blog") || lowerMessage.includes("article") || lowerMessage.includes("write")) {
      if (contentRecommendations.length > 0) {
        response = `You have ${totalContent} content ideas, with ${completedContent} completed. `;
        if (incompleteContent.length > 0) {
          response += `Here are your top priorities:\n\n`;
          incompleteContent.slice(0, 3).forEach((rec, i) => {
            response += `${i + 1}. ${rec.recommendedContent?.[0]?.title || rec.missingClaim}\n`;
          });
          response += `\nThese content pieces will help establish your authority in areas where competitors are currently dominating.`;
        } else {
          response += `Great job completing all your content ideas! Consider running more simulations to discover new opportunities.`;
        }
        suggestions = [
          "View all content ideas in the Content Ideas section",
          "Get detailed outlines for each piece",
          "Mark completed items as done"
        ];
      } else {
        response = `You don't have any content ideas yet. Run simulations to discover content opportunities based on where competitors are being mentioned. Once you have data, I can help you prioritize which content to create first.`;
        suggestions = [
          "Complete onboarding to generate content ideas",
          "Run more simulations to discover opportunities"
        ];
      }
    } else if (lowerMessage.includes("outreach") || lowerMessage.includes("email") || lowerMessage.includes("contact") || lowerMessage.includes("source")) {
      if (outreachRecommendations.length > 0) {
        response = `You have ${totalOutreach} outreach opportunities, with ${completedOutreach} completed. `;
        if (incompleteOutreach.length > 0) {
          response += `Here are platforms you should reach out to:\n\n`;
          incompleteOutreach.slice(0, 3).forEach((rec, i) => {
            response += `${i + 1}. ${rec.platform} - ${rec.reason}\n`;
          });
          response += `\nThese platforms frequently cite competitors in your space. Getting featured here will significantly boost your visibility.`;
        } else {
          response += `Excellent! You've completed all outreach opportunities. Keep monitoring for new sources as you run more simulations.`;
        }
        suggestions = [
          "View all outreach opportunities in the Outreach section",
          "Use the email templates provided",
          "Track your outreach progress"
        ];
      } else if (topSources.length > 0) {
        response = `Based on your simulations, AI assistants frequently cite these sources:\n\n`;
        topSources.slice(0, 5).forEach((source, i) => {
          response += `${i + 1}. ${source.title} (${source.count} citations)\n`;
        });
        response += `\nGetting your brand featured on these high-authority sources will dramatically improve your AI visibility.`;
        suggestions = [
          "See detailed outreach recommendations",
          "Get email templates for each source",
          "Track which sources you've contacted"
        ];
      } else {
        response = `Run simulations first to identify which sources AI assistants are citing. Once you have that data, I can help you prioritize outreach.`;
      }
    } else if (lowerMessage.includes("topic") || lowerMessage.includes("query") || lowerMessage.includes("search") || lowerMessage.includes("keyword")) {
      if (lowCoverageTopics.length > 0) {
        response = `You have ${lowCoverageTopics.length} topics where your coverage is below 50%:\n\n`;
        lowCoverageTopics.slice(0, 5).forEach(t => {
          response += `• "${t.topic}": ${t.coverage.toFixed(0)}% coverage`;
          if (t.dominantCompetitor) {
            response += ` (${t.dominantCompetitor} dominates)`;
          }
          response += `\n`;
        });
        response += `\nThese are high-priority opportunities. Creating authoritative content for these topics will help you compete more effectively.`;
        suggestions = lowCoverageTopics.slice(0, 3).map(t => 
          `Create content for "${t.topic}" to compete with ${t.dominantCompetitor || 'competitors'}`
        );
      } else if (topicCoverage.length > 0) {
        response = `Great news! You have good coverage across your tracked topics. Your average coverage is ${(topicCoverage.reduce((sum, t) => sum + t.coverage, 0) / topicCoverage.length).toFixed(0)}%. Consider adding new topics to track or running more simulations to discover new opportunities.`;
      suggestions = [
          "Add new topics to track",
          "Run more simulations",
          "Analyze competitor topic coverage"
      ];
    } else {
        response = `You haven't tracked any topics yet. Add topics in the onboarding process, and I'll help you analyze your coverage and identify opportunities.`;
      }
    } else if (lowerMessage.includes("visibility") || lowerMessage.includes("appear") || lowerMessage.includes("mention") || lowerMessage.includes("ranking")) {
      response = `Your current AI visibility is ${yourVisibility}%. You appear in ${metrics?.mentionCount || 0} out of ${metrics?.totalPrompts || 0} AI responses, ranking you #${yourRanking} out of ${totalCompetitors} competitors. `;
      
      if (parseFloat(yourVisibility) < 30) {
        response += `This is relatively low. Here's what you should focus on:`;
        suggestions = [
          "Create comparison content (e.g., 'X vs Y' pages)",
          "Build authority on high-citation sources like Wikipedia",
          "Target low-coverage topics where competitors dominate"
        ];
      } else if (parseFloat(yourVisibility) < 60) {
        response += `You're making progress! To reach the next level:`;
        suggestions = [
          "Complete your content ideas to establish more authority",
          "Reach out to high-citation sources",
          "Create comprehensive FAQs and comparison pages"
        ];
      } else {
        response += `Excellent visibility! To maintain and grow:`;
        suggestions = [
          "Monitor competitor strategies",
          "Expand into new topics",
          "Maintain presence on key sources"
        ];
      }
    } else if (lowerMessage.includes("improve") || lowerMessage.includes("better") || lowerMessage.includes("help") || lowerMessage.includes("what should") || lowerMessage.includes("how can")) {
      // Generate personalized recommendations
      const recommendations: string[] = [];
      
      if (lowCoverageTopics.length > 0) {
        recommendations.push(`Focus on ${lowCoverageTopics[0].topic} - you only have ${lowCoverageTopics[0].coverage.toFixed(0)}% coverage`);
      }
      
      if (incompleteContent.length > 0) {
        recommendations.push(`Complete your content ideas - you have ${incompleteContent.length} pending`);
      }
      
      if (incompleteOutreach.length > 0) {
        recommendations.push(`Reach out to ${incompleteOutreach[0].platform} - they frequently cite competitors`);
      }
      
      if (topCompetitor && topCompetitor.visibility > parseFloat(yourVisibility)) {
        recommendations.push(`Analyze ${topCompetitor.name}'s strategy - they're ${(topCompetitor.visibility - parseFloat(yourVisibility)).toFixed(1)}% ahead`);
      }
      
      if (recommendations.length > 0) {
        response = `Based on your current data, here's what I'd prioritize:\n\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nWould you like me to dive deeper into any of these?`;
      } else {
        response = `You're doing well! Your visibility is ${yourVisibility}% and you're ranked #${yourRanking}. To continue improving, consider running more simulations to discover new opportunities, or let me know what specific area you'd like to focus on.`;
      }
      
      suggestions = [
        "Show me my content ideas",
        "What sources should I target?",
        "Analyze my competitors"
      ];
    } else {
      // Default helpful response
      response = `I'm here to help you improve your AI search visibility. Right now, you're at ${yourVisibility}% visibility and ranked #${yourRanking} out of ${totalCompetitors} competitors. `;
      
      if (totalContent > 0 || totalOutreach > 0 || lowCoverageTopics.length > 0) {
        response += `I can see you have:\n`;
        if (totalContent > 0) response += `• ${totalContent} content ideas\n`;
        if (totalOutreach > 0) response += `• ${totalOutreach} outreach opportunities\n`;
        if (lowCoverageTopics.length > 0) response += `• ${lowCoverageTopics.length} topics needing better coverage\n`;
        response += `\nWhat would you like to focus on?`;
      } else {
        response += `Ask me about your competitors, content ideas, outreach opportunities, or topics - I have access to all your dashboard data and can provide specific recommendations.`;
      }
      
      suggestions = [
        "How can I improve my visibility?",
        "What are my competitors doing?",
        "Show me content ideas",
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
      <div className="min-h-screen flex items-center justify-center bg-white">
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

  // Competitor management functions
  const handleAddCompetitor = () => {
    if (!newCompetitor.trim()) return;
    const input = newCompetitor.trim();
    
    // Extract domain and name from URL or plain text
    let domain = '';
    let competitorName = '';
    
    try {
      // Try to parse as URL
      let urlToParse = input;
      if (!input.startsWith('http://') && !input.startsWith('https://')) {
        urlToParse = 'https://' + input;
      }
      const url = new URL(urlToParse);
      domain = url.hostname.replace('www.', '');
      // Extract company name from domain (e.g., cluely.com -> Cluely)
      competitorName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    } catch {
      // If not a valid URL, treat as company name
      competitorName = input;
      domain = input.toLowerCase().replace(/\s+/g, '') + '.com';
    }
    
    addCompetitor({
      id: `comp-${Date.now()}`,
      name: competitorName,
      website: domain,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    });
    setNewCompetitor("");
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col fixed h-full" style={{ backgroundColor: '#f3f2ee' }}>
        {/* Logo */}
        <div className="p-4 pl-6 flex items-center gap-2.5 border-b border-neutral-100">
          <img 
            src="/Lens Logo.png" 
            alt="Lens"
            className="w-6 h-6 object-contain"
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
          {/* Agent */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Agent</p>
            <button
              onClick={() => setSelectedView("agent")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                selectedView === "agent" 
                  ? "text-neutral-900 font-medium" 
                  : "text-neutral-600"
              }`}
              style={{
                backgroundColor: selectedView === "agent" ? '#E5E5E5' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (selectedView !== "agent") {
                  e.currentTarget.style.backgroundColor = '#ECECEC';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedView !== "agent") {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </div>

          {/* Analytics */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Analytics</p>
            {[
              { id: "dashboard", icon: BarChart3, label: "Dashboard" },
              { id: "prompts", icon: FileText, label: "Prompts" },
              { id: "competitors", icon: Users, label: "Competitors" },
              { id: "sources", icon: ExternalLink, label: "Sources" },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                  selectedView === item.id 
                    ? "text-neutral-900 font-medium" 
                    : "text-neutral-600"
                }`}
                style={{
                  backgroundColor: selectedView === item.id ? '#E5E5E5' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (selectedView !== item.id) {
                    e.currentTarget.style.backgroundColor = '#ECECEC';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedView !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Actions</p>
            {[
              { id: "content", icon: BookOpen, label: "Content Ideas" },
              { id: "outreach", icon: Send, label: "Outreach" },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5 ${
                  selectedView === item.id 
                    ? "text-neutral-900 font-medium" 
                    : "text-neutral-600"
                }`}
                style={{
                  backgroundColor: selectedView === item.id ? '#E5E5E5' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (selectedView !== item.id) {
                    e.currentTarget.style.backgroundColor = '#ECECEC';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedView !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-neutral-100">
          <button 
            onClick={() => router.push("/onboarding")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Exit
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-56 overflow-hidden">
          {/* Dashboard View */}
          {selectedView === "dashboard" && (
          <div className="p-6">
            <div className="pt-6 space-y-6">
              <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-xl p-5 bg-neutral-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-neutral-500">Brand Visibility</span>
                    <Info className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div className="text-3xl font-bold text-neutral-900">{metrics.visibilityPercentage.toFixed(1)}%</div>
                  <p className="text-xs text-neutral-400 mt-1">Based on {metrics.totalPrompts} prompts</p>
                </div>

                <div className="rounded-xl p-5 bg-neutral-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-neutral-500">Citation Share</span>
                    <Info className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div className="text-3xl font-bold text-neutral-900">{citationShare.toFixed(1)}%</div>
                  <p className="text-xs text-neutral-400 mt-1">{metrics.mentionCount} of {competitorRankings.reduce((s, c) => s + c.mentions, 0)} citations</p>
                </div>

                <div className="rounded-xl p-5 bg-neutral-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-neutral-500">Brand Ranking</span>
                  </div>
                  <div className="text-3xl font-bold text-neutral-900">#{yourRanking}</div>
                  <p className="text-xs text-neutral-400 mt-1">{yourRanking === 1 ? "Market Leader" : `of ${competitorRankings.length} brands`}</p>
                </div>

                <div className="rounded-xl p-5 bg-neutral-100">
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
                <div className="rounded-xl p-8 bg-neutral-100">
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
                <div className="rounded-xl p-5 bg-neutral-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-neutral-900">All Competitors</h3>
                    <button 
                      onClick={() => setSelectedView("competitors")}
                      className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
                <div className="rounded-xl p-5 bg-neutral-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-neutral-900">Top Sources</h3>
                    <button 
                      onClick={() => setSelectedView("sources")}
                      className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
            </div>
          )}

          {/* Agent Chat View */}
          {selectedView === "agent" && (
            <div className="h-[100vh] flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto px-4 pt-6 pb-32 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="max-w-3xl mx-auto">
                {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
                      <div className={`max-w-[85%] rounded-[20px] px-4 py-3 ${
                      msg.role === "user" 
                        ? "bg-neutral-900 text-white" 
                        : "text-neutral-900"
                    }`} style={msg.role === "assistant" ? { backgroundColor: '#f3f2ee' } : {}}>
                      <p className="text-[15px] leading-relaxed whitespace-pre-line">{msg.content}</p>
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.suggestions.map((s, j) => (
                            <div key={j} className="flex items-start gap-2 p-2.5 bg-white bg-opacity-50 rounded-lg text-sm">
                              <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <span className="text-neutral-700">{s}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isAgentThinking && (
                    <div className="flex justify-start mb-4">
                      <div className="rounded-[20px] px-4 py-3" style={{ backgroundColor: '#f3f2ee' }}>
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
              </div>

              {/* Chat Input - ChatGPT Style */}
              <div className="fixed bottom-0 left-56 right-0 bg-white px-4 pb-6 pt-3">
                <div className="max-w-3xl mx-auto">
                  <div className="relative flex items-end rounded-3xl shadow-sm" style={{ backgroundColor: '#f3f2ee' }}>
                    <textarea
                      ref={textareaRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAgentChat(chatInput);
                        }
                      }}
                      placeholder="Ask me anything about improving your AI visibility"
                      className="flex-1 px-5 py-3.5 bg-transparent text-[15px] focus:outline-none placeholder:text-neutral-500 resize-none overflow-y-auto"
                      style={{ minHeight: '52px', maxHeight: '200px' }}
                      rows={1}
                    />
                    <button
                      onClick={() => handleAgentChat(chatInput)}
                      disabled={!chatInput.trim() || isAgentThinking}
                      className="mr-2 mb-2 p-2 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Competitors View */}
          {selectedView === "competitors" && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto pt-6 space-y-6">
              <h1 className="text-2xl font-semibold text-neutral-900">Competitors</h1>
              {/* Add Competitor - Underline Style */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                  placeholder="Add competitor"
                  className="flex-1 px-0 py-2.5 border-0 border-b-2 border-neutral-200 text-neutral-900 text-base placeholder-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors bg-transparent"
                />
                <button
                  onClick={handleAddCompetitor}
                  disabled={!newCompetitor.trim()}
                  className="px-4 py-2 text-neutral-900 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Competitors List */}
              <div className="space-y-2">
                {competitors.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                    <p className="text-neutral-500">No competitors added yet</p>
                  </div>
                ) : (
                  competitors.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between px-4 py-3 bg-neutral-100 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        {comp.favicon ? (
                          <img 
                            src={comp.favicon} 
                            alt={comp.name} 
                            className="w-6 h-6 rounded"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center" style={{ display: comp.favicon ? 'none' : 'flex' }}>
                          <span className="text-xs font-medium text-neutral-500">{comp.name[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{comp.name}</p>
                          {comp.website && (
                            <p className="text-xs text-neutral-400">{comp.website}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCompetitor(comp.id)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              </div>
            </div>
          )}

          {/* Content Ideas View - Split Layout */}
          {selectedView === "content" && (
            <div className="fixed inset-0 left-56 flex">
              {/* Left Sidebar - Content Topics List */}
              <div className="w-96 border-r border-neutral-200 flex flex-col bg-white">
                <div className="pt-6 px-3 pb-3">
                  <h1 className="text-2xl font-semibold text-neutral-900">Content Ideas</h1>
                </div>
                {isExtractingClaims && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">Generating ideas...</p>
                    </div>
                  </div>
                )}
                
                {!isExtractingClaims && contentRecommendations.length > 0 && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {[...contentRecommendations].sort((a, b) => {
                      if (a.completed === b.completed) return 0;
                      return a.completed ? 1 : -1;
                    }).map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => setExpandedContent(rec.id)}
                        className={`p-3 cursor-pointer transition-all rounded-2xl ${
                          expandedContent === rec.id ? 'bg-neutral-100 shadow-sm' : 'bg-transparent hover:bg-neutral-100/50'
                        } ${rec.completed ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-900">
                              {rec.recommendedContent?.[0]?.title || rec.missingClaim}
                            </p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {rec.recommendedContent?.[0]?.type === 'blog' ? 'Blog Post' : 
                               rec.recommendedContent?.[0]?.type === 'comparison' ? 'Comparison' : 'Page'}
                            </p>
                          </div>
                          {rec.completed && (
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {!isExtractingClaims && contentRecommendations.length === 0 && (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                      <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">No content ideas yet</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Panel - Content Details */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                {expandedContent && contentRecommendations.find(r => r.id === expandedContent) ? (
                  (() => {
                    const selectedContent = contentRecommendations.find(r => r.id === expandedContent)!;
                    const content = selectedContent.recommendedContent?.[0];
                    return (
                      <>
                        {/* Content Body */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 pt-20">
                          <div className="max-w-3xl mx-auto">
                            <div className="flex items-start justify-between gap-4 mb-6">
                              <h1 className="text-2xl font-bold text-neutral-900 flex-1">
                                {content?.title || selectedContent.missingClaim}
                              </h1>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {selectedContent.generatedBlog && (
                                <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedContent.generatedBlog || '');
                                      setCopiedItemId(`content-${selectedContent.id}`);
                                    }}
                                  className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors relative group"
                                >
                                  {copiedItemId === `content-${selectedContent.id}` ? (
                                    <Check className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <Copy className="w-5 h-5" />
                                  )}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {copiedItemId === `content-${selectedContent.id}` ? 'Copied!' : 'Copy blog'}
                                  </div>
                                </button>
                                )}
                                <button
                                  onClick={() => toggleContentComplete(selectedContent.id)}
                                  className={`p-2 rounded-lg transition-colors relative group ${
                                    selectedContent.completed 
                                      ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                                  }`}
                                >
                                  <Check className="w-5 h-5" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {selectedContent.completed ? 'Completed' : 'Mark as complete'}
                                  </div>
                                </button>
                              </div>
                            </div>
                            
                            {selectedContent.generatedBlog ? (
                              <div className="blog-content">
                                {selectedContent.generatedBlog.split('\n\n').map((paragraph, i) => {
                                  // Skip the first H1 since we already show the title at the top
                                  if (i === 0 && paragraph.startsWith('# ')) {
                                    return null;
                                  }
                                  // Handle headings
                                  if (paragraph.startsWith('# ')) {
                                    return <h1 key={i} className="text-2xl font-bold text-neutral-900 mt-8 mb-4">{paragraph.replace(/^# /, '')}</h1>;
                                  }
                                  if (paragraph.startsWith('## ')) {
                                    return <h2 key={i} className="text-xl font-semibold text-neutral-900 mt-6 mb-3">{paragraph.replace(/^## /, '')}</h2>;
                                  }
                                  if (paragraph.startsWith('### ')) {
                                    return <h3 key={i} className="text-lg font-semibold text-neutral-900 mt-4 mb-2">{paragraph.replace(/^### /, '')}</h3>;
                                  }
                                  // Handle bullet lists
                                  if (paragraph.includes('\n- ') || paragraph.startsWith('- ')) {
                                    const items = paragraph.split('\n').filter(line => line.trim().startsWith('- '));
                                    return (
                                      <ul key={i} className="list-disc list-inside mb-4 space-y-2 text-neutral-700">
                                        {items.map((item, j) => (
                                          <li key={j} className="leading-relaxed">
                                            {item.replace(/^-\s+/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  }
                                  // Regular paragraphs
                                  if (paragraph.trim()) {
                                    return (
                                      <p key={i} className="text-neutral-700 leading-relaxed mb-4" dangerouslySetInnerHTML={{
                                        __html: paragraph
                                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                          .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                      }} />
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            ) : (
                              <>
                            {content?.outline?.map((section, i) => (
                              <div key={i} className="mb-6">
                                <h2 className="text-lg font-semibold text-neutral-900 mb-2">
                                  {section}
                                </h2>
                                <p className="text-neutral-600 leading-relaxed">
                                  {i === 0 && `This section should cover the key aspects of ${selectedContent.missingClaim}. Explain why this matters for your target audience and how ${companyName} addresses this need.`}
                                  {i === 1 && `Dive deeper into the specifics. Provide examples, data points, or case studies that demonstrate your expertise in this area.`}
                                  {i === 2 && `Compare different approaches and highlight what makes your solution unique. Address common concerns your audience might have.`}
                                  {i > 2 && `Continue building your argument with supporting evidence and practical insights that establish authority.`}
                                </p>
                              </div>
                            ))}
                            
                            {!content?.outline?.length && (
                              <div className="text-neutral-600 leading-relaxed">
                                <p className="mb-4">
                                  Create content that establishes {companyName}'s expertise in "{selectedContent.missingClaim}".
                                </p>
                                <p>
                                  This is a key differentiator that competitors are being recognized for. Building authoritative content around this topic will help improve AI visibility.
                                </p>
                              </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <BookOpen className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                      <p className="text-neutral-500">Select a content idea to view details</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Outreach View - Split Layout */}
          {selectedView === "outreach" && (
            <div className="fixed inset-0 left-56 flex">
              {/* Left Sidebar - Sources List */}
              <div className="w-96 border-r border-neutral-200 flex flex-col bg-white">
                <div className="pt-6 px-3 pb-3">
                  <h1 className="text-2xl font-semibold text-neutral-900">Outreach</h1>
                </div>
                {isExtractingClaims && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">Finding sources...</p>
                    </div>
                  </div>
                )}
                
                {!isExtractingClaims && outreachRecommendations.length > 0 && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {[...outreachRecommendations].sort((a, b) => {
                      if (a.completed === b.completed) return 0;
                      return a.completed ? 1 : -1;
                    }).map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => setExpandedOutreach(rec.id)}
                        className={`p-3 cursor-pointer transition-all rounded-2xl ${
                          expandedOutreach === rec.id ? 'bg-neutral-100 shadow-sm' : 'bg-transparent hover:bg-neutral-100/50'
                        } ${rec.completed ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-900">
                              {rec.platform}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {rec.contactEmail || `contact@${rec.platform?.toLowerCase().replace(/\s+/g, '')}`}
                            </p>
                          </div>
                          {rec.completed && (
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {!isExtractingClaims && outreachRecommendations.length === 0 && (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                      <Send className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500">No sources found yet</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Panel - Email Preview */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                {expandedOutreach && outreachRecommendations.find(r => r.id === expandedOutreach) ? (
                  (() => {
                    const selectedOutreach = outreachRecommendations.find(r => r.id === expandedOutreach)!;
                    return (
                      <>
                        {/* Email Form */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 pt-20">
                          <div className="max-w-2xl mx-auto space-y-4">
                            {/* Recipient with Actions */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-medium text-neutral-500">Recipient</label>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      const subject = (selectedOutreach as any).subject || selectedOutreach.actions?.[0]?.replace('Subject: ', '') || `Partnership inquiry from ${companyName}`;
                                      const body = (selectedOutreach as any).emailBody || selectedOutreach.reason || `Hey there,\n\nI'm reaching out from ${companyName}. We noticed your platform covers ${selectedOutreach.type?.replace('_', ' ')} in our industry.\n\nBest,\n${companyName}`;
                                      const fullEmail = `Subject: ${subject}\n\n${body}`;
                                      navigator.clipboard.writeText(fullEmail);
                                      setCopiedItemId(`outreach-${selectedOutreach.id}`);
                                    }}
                                    className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors relative group"
                                  >
                                    {copiedItemId === `outreach-${selectedOutreach.id}` ? (
                                      <Check className="w-5 h-5 text-green-600" />
                                    ) : (
                                      <Copy className="w-5 h-5" />
                                    )}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                      {copiedItemId === `outreach-${selectedOutreach.id}` ? 'Copied!' : 'Copy email'}
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => toggleOutreachComplete(selectedOutreach.id)}
                                    className={`p-2 rounded-lg transition-colors relative group ${
                                      selectedOutreach.completed 
                                        ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                                        : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                                    }`}
                                  >
                                    <Check className="w-5 h-5" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                      {selectedOutreach.completed ? 'Completed' : 'Mark as complete'}
                                    </div>
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 break-all">
                                  {selectedOutreach.contactEmail || `contact@${selectedOutreach.platform?.toLowerCase().replace(/\s+/g, '')}.com`}
                                </div>
                                {(selectedOutreach as any).contactConfidence && (
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    (selectedOutreach as any).contactConfidence === 'high' 
                                      ? 'bg-green-100 text-green-700' 
                                      : (selectedOutreach as any).contactConfidence === 'medium'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-neutral-100 text-neutral-500'
                                  }`}>
                                    {(selectedOutreach as any).contactConfidence}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Claim Context */}
                            {(selectedOutreach as any).claimToEstablish && (
                              <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Claim to Establish</label>
                                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                                  {(selectedOutreach as any).claimToEstablish}
                                </div>
                              </div>
                            )}
                            
                            {/* Subject */}
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Subject Line</label>
                              <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900">
                                {(selectedOutreach as any).subject || selectedOutreach.actions?.[0]?.replace('Subject: ', '') || `Partnership inquiry from ${companyName}`}
                              </div>
                            </div>
                            
                            {/* Email Body */}
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Email Body</label>
                              <div className="px-3 py-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                                {(selectedOutreach as any).emailBody || selectedOutreach.reason || `Hey there,\n\nI'm reaching out from ${companyName}. We noticed your platform covers ${selectedOutreach.type?.replace('_', ' ')} in our industry.\n\nBest,\n${companyName}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Send className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                      <p className="text-neutral-500">Select a source to view email template</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompts View */}
          {selectedView === "prompts" && (
          <div className="p-6">
            <div className="max-w-6xl mx-auto pt-6 space-y-6">
              <h1 className="text-2xl font-semibold text-neutral-900">Prompts</h1>
              {/* Add Custom Prompt */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTopic()}
                  placeholder="Add custom prompt"
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

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">
                <div className="col-span-5">Prompt</div>
                <div className="col-span-2 text-center">Visibility</div>
                <div className="col-span-3 text-center">Top Performers</div>
                <div className="col-span-2 text-center">Sources</div>
              </div>

              {/* Table Rows */}
              <div className="space-y-1">
                {simulationResults.map((result, i) => (
                  <div 
                    key={i} 
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-neutral-50 rounded-lg transition-colors"
                  >
                    {/* Prompt */}
                    <div className="col-span-5">
                      <p className="text-sm text-neutral-900">{result.query}</p>
                    </div>

                    {/* Visibility */}
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      <span className={`text-sm font-medium ${result.yourBrandMentioned ? 'text-green-600' : 'text-neutral-400'}`}>
                        {result.yourBrandMentioned ? '100%' : '0%'}
                      </span>
                      {result.yourBrandMentioned ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>

                    {/* Top Performers */}
                    <div className="col-span-3 flex items-center justify-center">
                      <div className="relative group">
                        <div className="flex -space-x-2 cursor-pointer">
                          {result.mentionedBrands.slice(0, 4).map((brand: any, idx: number) => {
                            const competitor = competitors.find(c => c.name.toLowerCase() === brand.name.toLowerCase());
                            const isYourBrand = brand.name.toLowerCase() === companyName.toLowerCase();
                            return (
                              <div key={idx} className="relative">
                                {competitor?.favicon || isYourBrand ? (
                                  <img 
                                    src={isYourBrand && websiteUrl 
                                      ? `https://icons.duckduckgo.com/ip3/${websiteUrl.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0]}.ico`
                                      : competitor?.favicon
                                    }
                                    alt={brand.name}
                                    className="w-7 h-7 rounded-full border-2 border-white object-cover bg-neutral-100"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                                  style={{ 
                                    backgroundColor: chartColors[idx % chartColors.length] || "#888",
                                    display: (competitor?.favicon || isYourBrand) ? 'none' : 'flex'
                                  }}
                                >
                                  {brand.name[0]}
                                </div>
                              </div>
                            );
                          })}
                          {result.mentionedBrands.length > 4 && (
                            <div className="w-7 h-7 rounded-full border-2 border-white bg-neutral-200 flex items-center justify-center text-xs font-medium text-neutral-600">
                              +{result.mentionedBrands.length - 4}
                            </div>
                          )}
                        </div>
                        {/* All Performers Popup */}
                        {result.mentionedBrands.length > 0 && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-20">
                            <p className="text-xs font-medium text-neutral-500 mb-2">Top Performers</p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {result.mentionedBrands.map((brand: any, idx: number) => {
                                const competitor = competitors.find(c => c.name.toLowerCase() === brand.name.toLowerCase());
                                const isYourBrand = brand.name.toLowerCase() === companyName.toLowerCase();
                                return (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-400 w-4">#{brand.position}</span>
                                    {competitor?.favicon || isYourBrand ? (
                                      <img 
                                        src={isYourBrand && websiteUrl 
                                          ? `https://icons.duckduckgo.com/ip3/${websiteUrl.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0]}.ico`
                                          : competitor?.favicon
                                        }
                                        alt={brand.name}
                                        className="w-5 h-5 rounded-full object-cover bg-neutral-100"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div 
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                      style={{ 
                                        backgroundColor: chartColors[idx % chartColors.length] || "#888",
                                        display: (competitor?.favicon || isYourBrand) ? 'none' : 'flex'
                                      }}
                                    >
                                      {brand.name[0]}
                                    </div>
                                    <span className={`text-xs ${isYourBrand ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>
                                      {brand.name}
                                      {isYourBrand && <span className="ml-1 text-[10px] text-blue-600">(You)</span>}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sources */}
                    <div className="col-span-2 flex items-center justify-center">
                      {result.sources && result.sources.length > 0 ? (
                        <div className="relative group">
                          <span className="text-sm text-neutral-600 cursor-pointer hover:text-neutral-900">
                            {result.sources.length} source{result.sources.length !== 1 ? 's' : ''}
                          </span>
                          {/* Sources Popup */}
                          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-neutral-200 p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-20">
                            <p className="text-xs font-medium text-neutral-500 mb-2">Sources</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {result.sources.map((source: any, sidx: number) => (
                                <a
                                  key={sidx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-neutral-600 hover:text-blue-600"
                                >
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{source.title || source.url}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {simulationResults.length === 0 && (
                <p className="text-center text-sm text-neutral-400 py-8">
                  No simulations yet. Complete the onboarding to generate prompts.
                </p>
              )}
            </div>
            </div>
          )}

          {/* Sources View */}
          {selectedView === "sources" && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto pt-6 space-y-6">
              <h1 className="text-2xl font-semibold text-neutral-900">Sources</h1>
              <div className="space-y-2">
                {topSources.length > 0 ? topSources.map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 bg-neutral-100 rounded-2xl"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ExternalLink className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">{source.title}</p>
                        <p className="text-xs text-neutral-400 truncate">{source.domain}</p>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500 flex-shrink-0 ml-3">
                      {source.count} citation{source.count !== 1 ? 's' : ''}
                    </div>
                  </a>
                )) : (
                  <div className="text-center py-12">
                    <ExternalLink className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                    <p className="text-neutral-500">No sources yet. Run simulations to see sources.</p>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

      </main>
    </div>
  );
}
