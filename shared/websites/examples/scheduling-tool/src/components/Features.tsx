import { Globe, Users, Calendar, Clock, Link, MessageSquare } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart Time Zone Detection",
      description: "Automatically converts and displays times in everyone's local timezone. No more mental math.",
      iconColor: "text-primary"
    },
    {
      icon: Users,
      title: "Team Availability View",
      description: "See when your entire team is available at a glance. Visual heatmaps show optimal meeting windows.",
      iconColor: "text-secondary"
    },
    {
      icon: Calendar,
      title: "Calendar Sync",
      description: "Two-way sync with Google Calendar, Outlook, and Apple Calendar. Always up-to-date.",
      iconColor: "text-primary"
    },
    {
      icon: Clock,
      title: "Meeting Preferences",
      description: "Set buffer times, focus hours, and no-meeting days. We protect your deep work time.",
      iconColor: "text-secondary"
    },
    {
      icon: Link,
      title: "One-Click Scheduling",
      description: "Share a link, let invitees pick from pre-approved times. No back-and-forth required.",
      iconColor: "text-primary"
    },
    {
      icon: MessageSquare,
      title: "Slack Integration",
      description: "Schedule directly from Slack. Get notifications when meetings are confirmed.",
      iconColor: "text-secondary"
    }
  ];

  return (
    <section id="features" className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to Schedule Smarter
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Built for distributed teams who refuse to waste time on coordination
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl shadow-md p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className="mb-4">
                  <Icon className={`${feature.iconColor} w-8 h-8`} />
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
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
