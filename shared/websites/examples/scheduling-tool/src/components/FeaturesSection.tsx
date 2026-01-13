import React from 'react';
import { Globe, Blend, Wand, Check, Merge } from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: "Smart Time Zone Detection",
    description: "Automatically converts and displays meeting times in each participant's local time zone. No more mental math or embarrassing no-shows."
  },
  {
    icon: Blend,
    title: "Team Availability Overlay",
    description: "See everyone's availability at a glance with visual overlays that highlight when your entire team is free—across continents."
  },
  {
    icon: Wand,
    title: "Instant Optimal Suggestions",
    description: "Our algorithm considers time zones, working hours, meeting preferences, and calendar conflicts to suggest the best times in seconds, not days."
  },
  {
    icon: Check,
    title: "One-Click Scheduling",
    description: "No more back-and-forth. Share a link, team members vote on suggested times, and the meeting auto-schedules when consensus is reached."
  },
  {
    icon: Merge,
    title: "Integrates With Everything",
    description: "Works seamlessly with Google Calendar, Outlook, Slack, Microsoft Teams, and Zoom. Fits right into your existing workflow."
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 md:py-20 lg:py-24 bg-muted relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to{' '}
            <span className="text-primary">Schedule Smarter</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features that eliminate the scheduling chaos—without the complexity.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="bg-card rounded-3xl p-6 md:p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-card-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Integration logos placeholder */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-8">
            Trusted integrations with the tools you already use
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
            <div className="text-2xl font-bold text-muted-foreground">Google Calendar</div>
            <div className="text-2xl font-bold text-muted-foreground">Outlook</div>
            <div className="text-2xl font-bold text-muted-foreground">Slack</div>
            <div className="text-2xl font-bold text-muted-foreground">Zoom</div>
            <div className="text-2xl font-bold text-muted-foreground">Teams</div>
          </div>
        </div>
      </div>
    </section>
  );
}
