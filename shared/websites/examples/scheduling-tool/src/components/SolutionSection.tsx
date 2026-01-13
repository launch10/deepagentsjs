import React from 'react';
import { Link, Settings, Wand } from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: Link,
    title: "Connect Your Calendar",
    description: "Link your Google Calendar, Outlook, or any calendar in 60 seconds. We sync your availability automatically."
  },
  {
    number: 2,
    icon: Settings,
    title: "Set Your Preferences Once",
    description: "Tell us your working hours, time zone, and meeting preferences. Never repeat yourself again."
  },
  {
    number: 3,
    icon: Wand,
    title: "We Find the Perfect Time",
    description: "Our AI instantly analyzes everyone's availability across all time zones and suggests optimal meeting times. Your team just clicks 'yes.' Done."
  }
];

export function SolutionSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-20 lg:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            How It Works{' '}
            <span className="text-primary">(Seriously, It's This Simple)</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Three steps to never play calendar tetris again.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
            {/* Connection lines for desktop */}
            <div className="hidden md:block absolute top-16 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-accent" style={{ top: '4rem' }} />
            
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div 
                  key={index}
                  className="relative text-center animate-zoom-in"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {/* Step number badge */}
                  <div className="relative inline-flex items-center justify-center w-16 h-16 bg-primary text-primary-foreground rounded-full font-bold text-2xl mb-6 shadow-lg z-10">
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-10 h-10 text-accent" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl md:text-2xl font-bold mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12 md:mt-16">
          <p className="text-lg text-muted-foreground mb-6">
            That's it. No complicated setup. No training required.
          </p>
          <a 
            href="#cta"
            className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all"
          >
            Try it free for 14 days
            <span className="text-xl">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
