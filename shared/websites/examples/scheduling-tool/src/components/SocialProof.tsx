import React from 'react';
import { Users, TrendingDown, Clock } from 'lucide-react';

const stats = [
  {
    icon: Users,
    number: '2,000+',
    label: 'Distributed teams coordinating effortlessly',
  },
  {
    icon: TrendingDown,
    number: '80%',
    label: 'Less time spent on meeting coordination',
  },
  {
    icon: Clock,
    number: '15 hrs/week',
    label: 'Average time saved per company',
  },
];

export function SocialProof() {
  return (
    <section className="py-20 md:py-24 lg:py-28 bg-background">
      <div className="container px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
            Trusted by teams who{' '}
            <span className="text-[#264653]">value their time</span>
          </h2>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E9C46A] mb-4">
                  <Icon className="w-8 h-8 text-[#264653]" />
                </div>
                <div className="text-4xl md:text-5xl font-bold text-[#264653] mb-2">
                  {stat.number}
                </div>
                <p className="text-muted-foreground text-sm md:text-base">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Testimonial */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-card rounded-3xl p-8 md:p-10 shadow-lg border-l-4 border-[#2A9D8F]">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2A9D8F] flex items-center justify-center text-white font-bold text-xl">
                S
              </div>
              <div>
                <p className="text-lg md:text-xl text-card-foreground mb-4 leading-relaxed italic">
                  "We used to waste entire mornings just finding meeting times across time zones. Now scheduling happens in seconds, and my team actually has time to do their real work."
                </p>
                <div>
                  <p className="font-semibold text-card-foreground">Sarah Chen</p>
                  <p className="text-sm text-muted-foreground">Project Manager at TechCorp</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
