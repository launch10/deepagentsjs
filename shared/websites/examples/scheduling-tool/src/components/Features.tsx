import React from 'react';
import { Globe, Layers, Zap, MousePointer, Plug } from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: "Smart Time Zone Detection",
    description: "Automatically converts and displays meeting times in each participant's local time zone. No more mental math or embarrassing no-shows."
  },
  {
    icon: Layers,
    title: "Team Availability Overlay",
    description: "See everyone's availability at a glance with visual overlays that highlight when your entire team is free—across continents."
  },
  {
    icon: Zap,
    title: "Instant Optimal Suggestions",
    description: "Our algorithm considers time zones, working hours, meeting preferences, and calendar conflicts to suggest the best times in seconds, not days."
  },
  {
    icon: MousePointer,
    title: "One-Click Scheduling",
    description: "No more back-and-forth. Share a link, team members vote on suggested times, and the meeting auto-schedules when consensus is reached."
  },
  {
    icon: Plug,
    title: "Integrates With Everything",
    description: "Works seamlessly with Google Calendar, Outlook, Slack, Microsoft Teams, and Zoom. Fits right into your existing workflow."
  }
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-24 lg:py-32 bg-muted">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Everything You Need to Schedule Smarter
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features that eliminate the scheduling chaos—without the learning curve.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-3xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group animate-zoom-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold text-card-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Additional emphasis */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground text-lg">
            And that's just the beginning. We're constantly adding features based on what distributed teams actually need.
          </p>
        </div>
      </div>
    </section>
  );
}
