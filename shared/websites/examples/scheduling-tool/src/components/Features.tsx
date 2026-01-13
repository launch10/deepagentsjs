import React from 'react';
import { Globe, CalendarSync, Settings, Zap } from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'Smart Time Zone Magic',
    description: 'Automatically converts and compares time zones to find slots that work for everyone. No more mental math or accidentally scheduling 3am meetings for your Tokyo teammates.',
  },
  {
    icon: CalendarSync,
    title: 'Works With Your Calendar',
    description: 'Syncs seamlessly with Google Calendar, Outlook, and Apple Calendar. No duplicate entries, no switching apps—just one source of truth for your entire team\'s availability.',
  },
  {
    icon: Settings,
    title: 'Set It Once, Forget It',
    description: 'Define your working hours and preferences one time. The system respects everyone\'s boundaries automatically, so you\'ll never get meeting requests during your off-hours again.',
  },
  {
    icon: Zap,
    title: 'Instant Meeting Time Suggestions',
    description: 'Get optimal time slots in seconds based on everyone\'s real availability. Share a link, let teammates pick their preference, and you\'re done—no endless email chains required.',
  },
];

export function Features() {
  return (
    <section className="py-20 md:py-24 lg:py-28 bg-muted">
      <div className="container px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
            Schedule Meetings{' '}
            <span className="text-[#264653]">Without The Headache</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground">
            Stop playing email ping-pong across time zones. Find the perfect meeting time for everyone in seconds, not hours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group bg-card rounded-3xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#264653] mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-[#E9C46A]" />
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-3 text-card-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
