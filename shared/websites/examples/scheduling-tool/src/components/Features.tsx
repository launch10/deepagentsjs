import { Globe, Calendar, Zap, Settings, MousePointer, BarChart3 } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: 'Smart Time Zone Detection',
      description: 'Automatically converts and suggests times that work for everyone, no matter where they are',
    },
    {
      icon: Calendar,
      title: 'Calendar Integration',
      description: 'Connects with Google Calendar, Outlook, and more. See everyone\'s availability in one place',
    },
    {
      icon: Zap,
      title: 'Instant Suggestions',
      description: 'AI-powered recommendations find the optimal meeting time in seconds, not hours',
    },
    {
      icon: Settings,
      title: 'Team Preferences',
      description: 'Set working hours, buffer times, and meeting preferences once. We remember',
    },
    {
      icon: MousePointer,
      title: 'One-Click Booking',
      description: 'Team members just click \'yes\' - no back-and-forth required',
    },
    {
      icon: BarChart3,
      title: 'Meeting Analytics',
      description: 'Track coordination time saved and optimize your team\'s schedule',
    },
  ];

  return (
    <section id="features" className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Scheduling That Actually Works
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to coordinate meetings across continents
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl shadow-lg p-6 md:p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                {/* Icon */}
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold mb-3">
                  {feature.title}
                </h3>

                {/* Description */}
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
