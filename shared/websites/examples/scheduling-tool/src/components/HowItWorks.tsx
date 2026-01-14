import React from 'react';
import { Calendar, Settings, Sparkles } from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: Calendar,
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
    icon: Sparkles,
    title: "We Find the Perfect Time",
    description: "Our AI instantly analyzes everyone's availability across all time zones and suggests optimal meeting times. Your team just clicks 'yes.' Done."
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            How It Works <span className="text-primary">(Seriously, It's This Simple)</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Three steps to never play calendar tetris again.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className="relative animate-slide-up"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  {/* Connector line (hidden on mobile) */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-12 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-primary/50 to-primary/20" />
                  )}

                  <div className="relative bg-card rounded-3xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary/20">
                    {/* Step number badge */}
                    <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg">
                      {step.number}
                    </div>

                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 mt-4">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>

                    <h3 className="text-xl font-bold text-card-foreground mb-4">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visual emphasis */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm font-semibold text-primary">
              Average setup time: 2 minutes
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
