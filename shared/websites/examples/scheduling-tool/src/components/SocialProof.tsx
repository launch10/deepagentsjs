import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingDown, Clock } from 'lucide-react';

const stats = [
  {
    icon: Users,
    number: '2,000+',
    label: 'Distributed Teams Trust Us',
  },
  {
    icon: TrendingDown,
    number: '80%',
    label: 'Less Time Coordinating Meetings',
  },
  {
    icon: Clock,
    number: '15 hrs/week',
    label: 'Saved at TechCorp Alone',
  },
];

export function SocialProof() {
  return (
    <section id="social-proof" className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Trusted by teams who've eliminated scheduling chaos
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="bg-card border-border text-center">
                <CardContent className="p-8">
                  <div className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-4xl sm:text-5xl font-bold text-foreground mb-2">
                    {stat.number}
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Testimonial */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-8 sm:p-12">
              <div className="flex flex-col items-center text-center">
                <svg
                  className="h-10 w-10 text-primary mb-6"
                  fill="currentColor"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
                </svg>
                <blockquote className="text-xl sm:text-2xl text-foreground font-medium mb-6 leading-relaxed">
                  "We used to waste entire afternoons playing email ping-pong just to find one meeting slot. Now our team gets those hours back to actually build product."
                </blockquote>
                <div>
                  <div className="font-semibold text-foreground text-lg">Sarah Chen</div>
                  <div className="text-muted-foreground">Senior Project Manager, TechCorp</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
