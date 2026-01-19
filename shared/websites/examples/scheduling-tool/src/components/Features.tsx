import { Globe, Clock, Zap, Users, Calendar, Shield } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart Timezone Detection",
      description: "Automatically converts and displays times in each team member's local timezone. No more mental math or embarrassing 3am meeting invites."
    },
    {
      icon: Clock,
      title: "Availability Preferences",
      description: "Set your ideal meeting windows, no-meeting days, and focus time blocks. We'll only suggest times that respect everyone's boundaries."
    },
    {
      icon: Zap,
      title: "Instant Optimal Time Suggestions",
      description: "Our algorithm analyzes everyone's calendars and preferences simultaneously, suggesting the best times in seconds—not days."
    },
    {
      icon: Users,
      title: "Team Scheduling Polls",
      description: "Need to schedule with external stakeholders? Send a poll with smart time options. They pick what works, and it's automatically added to everyone's calendar."
    },
    {
      icon: Calendar,
      title: "Two-Way Calendar Sync",
      description: "Changes sync instantly across all calendars. Reschedule once, and everyone's calendar updates automatically with timezone-accurate details."
    },
    {
      icon: Shield,
      title: "Privacy-First Design",
      description: "We only see when you're busy or free—never your meeting details. Your calendar privacy stays intact while coordination gets effortless."
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16">
          Built for Teams Who Work Across Continents
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <Icon className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
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
