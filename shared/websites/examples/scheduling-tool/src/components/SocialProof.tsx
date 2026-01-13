import React from 'react';

const stats = [
  {
    number: '2,000+',
    label: 'Distributed Teams',
  },
  {
    number: '80%',
    label: 'Less Coordination Time',
  },
  {
    number: '15',
    label: 'Hours Saved Weekly',
  },
];

export function SocialProof() {
  return (
    <section id="social-proof" className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-secondary-foreground">
            Trusted by Teams Who Value Time
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <div key={index} className="text-center space-y-2">
              <div className="text-5xl md:text-6xl font-bold text-accent">
                {stat.number}
              </div>
              <div className="text-lg text-secondary-foreground/80">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 max-w-3xl mx-auto">
          <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  💼
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-lg text-card-foreground italic leading-relaxed">
                  "We used to waste hours every week just trying to find a time that worked for our global team. Now it takes seconds. This tool has been a game-changer for our productivity."
                </p>
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold">Sarah Chen</span>, Project Manager at TechCorp
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
