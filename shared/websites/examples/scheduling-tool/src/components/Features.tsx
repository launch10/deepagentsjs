import { Globe, Users, Brain, Calendar, Zap, Clock } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart Timezone Detection",
      description: "Automatically converts times to each participant's local timezone. No more confusion."
    },
    {
      icon: Users,
      title: "Team Availability Overlay",
      description: "See everyone's free slots at a glance. Find the overlap instantly."
    },
    {
      icon: Brain,
      title: "Preference Learning",
      description: "We learn your team's patterns and suggest times that historically work best."
    },
    {
      icon: Calendar,
      title: "Calendar Sync",
      description: "Two-way sync with Google, Outlook, Apple Calendar, and more. Always up-to-date."
    },
    {
      icon: Zap,
      title: "One-Click Scheduling",
      description: "Share a link, get responses, meeting booked. That's it."
    },
    {
      icon: Clock,
      title: "Buffer Time Protection",
      description: "Automatically add buffer time between meetings so you're not back-to-back all day."
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Built for Distributed Teams
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to coordinate across continents
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl shadow-md p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-card-foreground">
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
