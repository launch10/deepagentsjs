import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles } from 'lucide-react';

export const Methodology = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-card rounded-2xl p-8 lg:p-12 border-2 shadow-lg">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">Our Methodology</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Transparent validation scoring
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                We publish exactly how we calculate your Validation Score. No black boxes—just clear, reproducible methodology you can trust.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Market Signal Analysis</span>
                    <p className="text-sm text-muted-foreground">Search trends, competitor funding, and market timing indicators</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Demand Validation</span>
                    <p className="text-sm text-muted-foreground">Landing page conversions benchmarked against 10,000+ experiments</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Competitive Positioning</span>
                    <p className="text-sm text-muted-foreground">Gap analysis and differentiation opportunity scoring</p>
                  </div>
                </li>
              </ul>
              <Button variant="outline" className="mt-6">
                View Full Methodology <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
            <div className="bg-muted rounded-xl p-6">
              <div className="text-center mb-6">
                <div className="text-6xl font-bold text-primary mb-2">73</div>
                <div className="text-lg font-medium">Validation Score</div>
                <p className="text-sm text-muted-foreground">Strong signal — consider proceeding</p>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Market Opportunity</span>
                    <span className="font-medium">82/100</span>
                  </div>
                  <div className="h-2 bg-background rounded-full">
                    <div className="h-2 bg-secondary rounded-full" style={{ width: '82%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Demand Signals</span>
                    <span className="font-medium">71/100</span>
                  </div>
                  <div className="h-2 bg-background rounded-full">
                    <div className="h-2 bg-secondary rounded-full" style={{ width: '71%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Competitive Position</span>
                    <span className="font-medium">68/100</span>
                  </div>
                  <div className="h-2 bg-background rounded-full">
                    <div className="h-2 bg-secondary rounded-full" style={{ width: '68%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Founder-Market Fit</span>
                    <span className="font-medium">74/100</span>
                  </div>
                  <div className="h-2 bg-background rounded-full">
                    <div className="h-2 bg-secondary rounded-full" style={{ width: '74%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
