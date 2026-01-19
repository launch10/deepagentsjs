import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';

const validationFeed = [
  { location: "Austin, TX", idea: "B2B recruiting platform", conversion: "12.4%" },
  { location: "London, UK", idea: "AI writing assistant", conversion: "8.7%" },
  { location: "Berlin, DE", idea: "Fitness subscription box", conversion: "15.2%" },
  { location: "Toronto, CA", idea: "Remote team analytics", conversion: "11.1%" },
  { location: "Sydney, AU", idea: "Sustainable fashion marketplace", conversion: "9.8%" },
  { location: "San Francisco, CA", idea: "Developer productivity tool", conversion: "18.3%" },
  { location: "New York, NY", idea: "Pet care subscription", conversion: "7.2%" },
  { location: "Seattle, WA", idea: "No-code automation", conversion: "14.6%" },
];

const LiveValidationTicker = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % validationFeed.length);
        setIsVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const current = validationFeed[currentIndex];
  
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-full px-4 py-2 inline-flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
      </span>
      <span className={`text-sm transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        Founder in <span className="font-medium">{current.location}</span> just validated a {current.idea} with <span className="font-semibold text-secondary">{current.conversion}</span> conversion
      </span>
    </div>
  );
};

export const Hero = () => {
  const [email, setEmail] = useState('');

  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-6">
            <LiveValidationTicker />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Stop Building Products
            <span className="text-primary block mt-2">Nobody Wants</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            AI-powered validation intelligence that stress-tests your business idea before you write a line of code. Get a data-driven Validation Score in minutes, not months.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto mb-8">
            <Input 
              type="email" 
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
            />
            <Button size="lg" className="h-12 px-8">
              Validate Your Idea <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Free validation included. No credit card required.
          </p>

          <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">3x</div>
              <div className="text-sm text-muted-foreground">Faster idea validation</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">$12,400</div>
              <div className="text-sm text-muted-foreground">Avg. saved per pivot</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">2,847</div>
              <div className="text-sm text-muted-foreground">Ideas validated</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
