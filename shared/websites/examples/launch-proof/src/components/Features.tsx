import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  FlaskConical,
  BarChart3,
  Shield,
  BookOpen,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: Target,
    title: "Idea Stress Test",
    description: "AI interrogates your concept from multiple angles—market size, timing, differentiation, founder-market fit—and surfaces blind spots you haven't considered."
  },
  {
    icon: FlaskConical,
    title: "Landing Page Lab",
    description: "Spin up conversion-optimized test pages in minutes. Built-in A/B testing and fake-door experiments to measure real demand before you build."
  },
  {
    icon: BarChart3,
    title: "Signal Dashboard",
    description: "Aggregate real demand signals: waitlist conversions, time-on-page, scroll depth, email open rates, and CTR—all mapped against industry benchmarks."
  },
  {
    icon: Shield,
    title: "Competitive Moat Analysis",
    description: "Automated research on existing players, their pricing, positioning gaps, and customer complaints you could exploit for differentiation."
  },
  {
    icon: BookOpen,
    title: "Validation Playbooks",
    description: "Step-by-step experiments including Mom Test interviews, smoke tests, and concierge MVPs with templates and scoring rubrics."
  },
  {
    icon: Zap,
    title: "Instant Validation Score",
    description: "A single, data-driven score that tells you whether to pivot, persist, or kill an idea. No more guessing—just clarity."
  }
];

export const Features = () => {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need to validate with confidence
          </h2>
          <p className="text-lg text-muted-foreground">
            Combine landing page experiments, audience signal analysis, and competitive intelligence into actionable insights.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
