import { Badge } from '@/components/ui/badge';
import { X, TrendingUp } from 'lucide-react';

export const Problem = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="mb-4">The Problem</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              90% of startups fail because founders skip validation
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              The "build it and they will come" approach wastes months and thousands of dollars. Most founders can't distinguish between a validated idea and their own confirmation bias.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <X className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Running biased surveys that tell you what you want to hear</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Misreading landing page metrics without industry context</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Confusing polite interest with real purchase intent</span>
              </li>
            </ul>
          </div>
          <div className="bg-card rounded-2xl p-8 shadow-lg border">
            <div className="text-center">
              <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-10 h-10 text-destructive rotate-180" />
              </div>
              <div className="text-5xl font-bold text-destructive mb-2">$35B+</div>
              <p className="text-muted-foreground">wasted annually on products that fail to find market fit</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
