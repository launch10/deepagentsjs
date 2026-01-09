import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

const steps = [
  {
    step: "01",
    title: "Describe Your Idea",
    description: "Enter your business concept in plain English. Our AI understands context, market dynamics, and founder intent."
  },
  {
    step: "02",
    title: "AI Stress Test",
    description: "Our validation engine analyzes your idea across 47 data points including market size, competition, and timing."
  },
  {
    step: "03",
    title: "Launch Experiments",
    description: "Deploy landing pages and fake-door tests in minutes. Measure real demand with actual user behavior."
  },
  {
    step: "04",
    title: "Get Your Score",
    description: "Receive a comprehensive Validation Score with clear recommendations: pivot, persist, or kill."
  }
];

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Validate in minutes, not months
          </h2>
          <p className="text-lg text-muted-foreground">
            A systematic approach to validation that removes guesswork and gives you clarity.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <div key={index} className="relative">
              <div className="text-6xl font-bold text-primary/10 mb-4">{item.step}</div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-muted-foreground">{item.description}</p>
              {index < steps.length - 1 && (
                <ChevronRight className="hidden lg:block absolute top-8 -right-4 w-8 h-8 text-primary/30" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
