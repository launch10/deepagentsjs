import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, Zap, Calendar, Users } from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'Smart Time Zone Matching',
    description: 'Automatically finds meeting times that respect everyone\'s working hours, no matter where they are.',
  },
  {
    icon: Zap,
    title: 'End the Scheduling Chaos',
    description: 'No more endless message threads. Get instant time suggestions that work for your entire team.',
  },
  {
    icon: Calendar,
    title: 'Seamless Calendar Sync',
    description: 'Connects with your existing calendar to show real availability and prevent double-bookings automatically.',
  },
  {
    icon: Users,
    title: 'One-Click Team Decisions',
    description: 'Share suggested times with your team. Everyone clicks yes, and the meeting is instantly scheduled.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Scheduling That Actually Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built for distributed teams who need to coordinate across time zones without the headache.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-border bg-card hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-card-foreground">
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
