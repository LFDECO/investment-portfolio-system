import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { TrendingUp, BarChart3, Shield, Zap, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";

/* ─────────────────────────────────────
   Animated stock-chart canvas background
   ───────────────────────────────────── */
function StockCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    // Stock line data — multiple animated lines
    const lines: {
      points: number[];
      speed: number;
      color: string;
      lineWidth: number;
      opacity: number;
      yOffset: number;
    }[] = [];

    function resize() {
      width = canvas!.width = canvas!.offsetWidth * window.devicePixelRatio;
      height = canvas!.height = canvas!.offsetHeight * window.devicePixelRatio;
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio);
      initLines();
    }

    function initLines() {
      lines.length = 0;
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      const configs = [
        { color: "oklch(0.55 0.22 259)", lineWidth: 2.5, opacity: 0.5, speed: 0.3, yCenter: h * 0.35 },
        { color: "oklch(0.65 0.20 150)", lineWidth: 2, opacity: 0.35, speed: 0.25, yCenter: h * 0.50 },
        { color: "oklch(0.55 0.22 259)", lineWidth: 1.5, opacity: 0.2, speed: 0.35, yCenter: h * 0.65 },
        { color: "oklch(0.70 0.18 259)", lineWidth: 1, opacity: 0.15, speed: 0.2, yCenter: h * 0.45 },
      ];
      const numPoints = Math.ceil(w / 6) + 2;
      for (const cfg of configs) {
        const pts: number[] = [];
        for (let i = 0; i < numPoints; i++) {
          pts.push(cfg.yCenter + (Math.random() - 0.5) * h * 0.25);
        }
        lines.push({ points: pts, speed: cfg.speed, color: cfg.color, lineWidth: cfg.lineWidth, opacity: cfg.opacity, yOffset: cfg.yCenter });
      }
    }

    function draw() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, w, h);

      for (const line of lines) {
        // Shift points left and add new point on right
        line.points.shift();
        const last = line.points[line.points.length - 1];
        const next = last + (Math.random() - 0.5) * 12;
        const clamped = Math.max(line.yOffset - h * 0.18, Math.min(line.yOffset + h * 0.18, next));
        line.points.push(clamped);

        // Draw the line
        ctx!.beginPath();
        ctx!.strokeStyle = line.color;
        ctx!.lineWidth = line.lineWidth;
        ctx!.globalAlpha = line.opacity;
        ctx!.lineJoin = "round";
        ctx!.lineCap = "round";

        for (let i = 0; i < line.points.length; i++) {
          const x = (i / (line.points.length - 1)) * w;
          if (i === 0) ctx!.moveTo(x, line.points[i]);
          else {
            const prevX = ((i - 1) / (line.points.length - 1)) * w;
            const cpx = (prevX + x) / 2;
            ctx!.quadraticCurveTo(prevX + (x - prevX) * 0.5, line.points[i - 1], cpx, (line.points[i - 1] + line.points[i]) / 2);
          }
        }
        ctx!.stroke();

        // Draw gradient fill under the line
        ctx!.globalAlpha = line.opacity * 0.15;
        ctx!.lineTo(w, h);
        ctx!.lineTo(0, h);
        ctx!.closePath();
        const grad = ctx!.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, line.color);
        grad.addColorStop(1, "transparent");
        ctx!.fillStyle = grad;
        ctx!.fill();

        ctx!.globalAlpha = 1;
      }

      // Draw subtle grid
      ctx!.globalAlpha = 0.05;
      ctx!.strokeStyle = "currentColor";
      ctx!.lineWidth = 0.5;
      const gridSpacing = 60;
      for (let x = 0; x < w; x += gridSpacing) {
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, h);
        ctx!.stroke();
      }
      for (let y = 0; y < h; y += gridSpacing) {
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(w, y);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}

/* ─────────────────────────────────────
   Floating particles (dots)
   ───────────────────────────────────── */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/30 animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────
   3D tilt card component
   ───────────────────────────────────── */
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale3d(1, 1, 1)";
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-300 ease-out ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────
   Main Home page
   ───────────────────────────────────── */
export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const loginUrl = getLoginUrl();

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <nav className="border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse-glow">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">Portfolio.Ai</h1>
            </div>
            <Button onClick={() => setLocation('/dashboard')}>Go to Dashboard</Button>
          </div>
        </nav>

        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
            <h2 className="text-5xl font-bold mb-6">Welcome back, {user?.name?.split(' ')[0]}</h2>
            <p className="text-xl text-muted-foreground mb-8">Your investment portfolio management platform</p>
            <Button size="lg" onClick={() => setLocation('/dashboard')} className="text-lg px-8 py-6">
              Open Dashboard
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Navigation */}
      <nav className="relative z-30 border-b border-border/30 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse-glow">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Portfolio.Ai</h1>
          </div>
          <Button
            onClick={() => loginUrl && (window.location.href = loginUrl)}
            className="rounded-xl"
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section with animated background */}
      <section className="relative min-h-[85vh] flex items-center justify-center">
        {/* Animated stock chart canvas */}
        <StockCanvasBackground />
        <FloatingParticles />

        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, var(--background) 75%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="animate-fade-in-up">
            <span className="inline-block px-4 py-1.5 mb-8 text-xs font-semibold uppercase tracking-widest text-primary bg-primary/10 rounded-full border border-primary/20">
              AI-Powered Portfolio Management
            </span>
          </div>

          <h2 className="animate-fade-in-up stagger-2 text-5xl md:text-7xl font-bold text-foreground mb-6 leading-[1.1] tracking-tight">
            Intelligent{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Portfolio
            </span>
            <br />
            Management
          </h2>

          <p className="animate-fade-in-up stagger-3 text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Analyze, track, and optimize your investments with real-time data,
            AI-powered insights, and comprehensive risk analysis.
          </p>

          <div className="animate-fade-in-up stagger-4 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => loginUrl && (window.location.href = loginUrl)}
              className="text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-lg px-8 py-6 rounded-xl"
            >
              Learn More
            </Button>
          </div>

          {/* Floating stock ticker mockup */}
          <div className="animate-fade-in-up stagger-5 mt-16 flex justify-center gap-4 flex-wrap">
            {[
              { ticker: "RELIANCE", change: "+2.34%", positive: true },
              { ticker: "TCS", change: "+1.12%", positive: true },
              { ticker: "INFY", change: "-0.45%", positive: false },
              { ticker: "HDFC", change: "+0.87%", positive: true },
            ].map((item) => (
              <div
                key={item.ticker}
                className="glass px-4 py-2 rounded-xl flex items-center gap-3 animate-float"
                style={{ animationDelay: `${Math.random() * 2}s` }}
              >
                <span className="text-sm font-bold text-foreground">{item.ticker}</span>
                <span className={`text-xs font-semibold ${item.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Features</span>
            <h3 className="text-4xl font-bold text-foreground mt-3">Powerful Tools for Smart Investing</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: TrendingUp,
                title: "Real-Time Tracking",
                description: "Monitor your portfolio with live market data and instant price updates.",
              },
              {
                icon: BarChart3,
                title: "Advanced Analytics",
                description: "Get detailed insights into performance, allocation, and market trends.",
              },
              {
                icon: Shield,
                title: "Risk Analysis",
                description: "Understand and manage portfolio risk with comprehensive metrics.",
              },
              {
                icon: Zap,
                title: "AI Assistant",
                description: "Get personalized recommendations powered by artificial intelligence.",
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <TiltCard key={index}>
                  <div className={`animate-fade-in-up stagger-${index + 1} h-full p-6 rounded-2xl bg-card border border-border/50 card-hover`}>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h4 className="text-lg font-bold text-foreground mb-2">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <TiltCard>
            <div className="text-center p-12 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-border/50 card-hover animate-fade-in-up">
              <h3 className="text-4xl font-bold text-foreground mb-4">Ready to optimize your portfolio?</h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Start managing your investments with confidence today.
              </p>
              <Button
                size="lg"
                onClick={() => loginUrl && (window.location.href = loginUrl)}
                className="text-lg px-10 py-6 rounded-xl shadow-lg shadow-primary/25"
              >
                Sign In Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-6 border-t border-border/30">
        <div className="max-w-7xl mx-auto text-center text-muted-foreground text-sm">
          <p>&copy; 2026 Portfolio.Ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
