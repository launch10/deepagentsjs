import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, Link2, Clock, CalendarCheck } from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'Smart Time Zone Magic',
    description: 'No more mental math or timezone converters. Our AI instantly finds the sweet spot that works across all continents, so your London team isn\'t meeting at midnight and your San Francisco crew isn\'t up at dawn.',
  },
  {
    icon: Link2,
    title: 'One Link, Zero Back-and-Forth',
    description: 'Share a single link and watch the magic happen. Your team sees times in their local timezone, clicks their preference, and you\'re done—no more endless Slack threads or email chains.',
  },
  {
    icon: Clock,
    title: 'Respect Everyone\'s Work Hours',
    description: 'Set your team\'s working hours and preferences once, and we\'ll never suggest a 3am meeting again. Everyone gets meeting times that fit their schedule and respect their boundaries.',
  },
  {
    icon: CalendarCheck,
    title: 'Instant Consensus, Automatic Booking',
    description: 'Once everyone responds, we automatically pick the best time and add it to all calendars. Your meeting is scheduled before you finish your coffee—no manual coordination required.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Scheduling that actually works for everyone
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Built for distributed teams who are tired of the coordination chaos
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="bg-card border-border hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-card-foreground mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
