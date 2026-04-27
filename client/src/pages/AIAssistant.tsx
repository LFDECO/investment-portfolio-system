import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Loader2 } from 'lucide-react';

interface Message {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'assistant',
      content: `Hello! I'm your Portfolio AI Assistant. I can help you analyze your investment portfolio, provide insights on your holdings, suggest rebalancing strategies, and discuss risk management. 

Based on your current portfolio:
- **Total Value**: ₹1,25,430.50
- **Diversification Score**: 8.5/10
- **Risk Level**: Medium
- **YTD Performance**: +12.5%

What would you like to know about your portfolio?`,
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        `Based on your portfolio composition, I notice that Technology represents 35% of your holdings. While this provides good growth potential, consider increasing your Healthcare and Energy allocations to improve diversification. Your current Sharpe ratio of 1.45 is solid, indicating good risk-adjusted returns.`,
        `Your portfolio has performed well with a +12.5% YTD return. The diversification across five asset classes is excellent. I'd recommend monitoring your Technology sector exposure and considering a small rebalancing toward defensive assets like Healthcare to reduce volatility during market downturns.`,
        `Looking at your risk metrics, your portfolio volatility of 13.2% is moderate. Your Beta of 0.95 suggests your portfolio moves slightly less than the market. For long-term growth, this is a balanced approach. Consider your investment timeline and risk tolerance before making major changes.`,
        `Your holdings show strong performance, particularly GOOGL (+40.25%) and MSFT (+22.05%). However, TSLA is down -2.99%. I'd suggest reviewing your position sizes to ensure they align with your risk tolerance and investment goals.`,
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      const assistantMessage: Message = {
        id: messages.length + 2,
        type: 'assistant',
        content: randomResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const quickQuestions = [
    'How can I improve my portfolio diversification?',
    'What are the key risk metrics I should monitor?',
    'Should I rebalance my portfolio?',
    'How is my portfolio performing compared to benchmarks?',
  ];

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">AI Portfolio Assistant</h1>
        </div>
        <p className="text-muted-foreground">Get intelligent insights and recommendations for your investment portfolio</p>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 p-6 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md lg:max-w-2xl px-4 py-3 rounded-lg ${message.type === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted text-foreground rounded-bl-none'
                    }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-2 ${message.type === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground px-4 py-3 rounded-lg rounded-bl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analyzing your portfolio...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length === 1 && (
            <div className="mb-6 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Quick Questions</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInput(question);
                    }}
                    className="text-left text-sm p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Ask me anything about your portfolio..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-accent/5 border-accent">
        <h3 className="font-semibold text-foreground mb-2">About the AI Assistant</h3>
        <p className="text-sm text-muted-foreground">
          This AI assistant analyzes your portfolio composition, risk metrics, and holdings to provide personalized insights and recommendations. It can help you understand your portfolio performance, suggest rebalancing strategies, and discuss risk management approaches tailored to your investment goals.
        </p>
      </Card>
    </div>
  );
}
