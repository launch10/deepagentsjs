import { Globe, Calendar, Users, Zap, BarChart3, MessageSquare } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart Timezone Detection",
      description: "Automatically accounts for daylight saving and timezone changes"
    },
    {
      icon: Calendar,
      title: "Availability Sync",
      description: "Real-time calendar integration across all platforms"
    },
    {
      icon: Users,
      title: "Team Preferences",
      description: "Respect everyone's working hours and meeting preferences"
    },
    {
      icon: Zap,
      title: "One-Click Scheduling",
      description: "No more polls or endless email chains"
    },
    {
      icon: BarChart3,
      title: "Meeting Analytics",
      description: "See patterns and optimize your team's schedule"
    },
    {
      icon: MessageSquare,
      title: "Slack Integration",
      description: "Schedule directly from your team channels"
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16">
          Built for Global Teams
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
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
