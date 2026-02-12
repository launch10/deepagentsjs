import { Globe, Settings, Zap, Calendar } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart Time Zone Detection",
      description: "Automatically converts and suggests times that work across continents. No more mental math or timezone converters."
    },
    {
      icon: Settings,
      title: "Availability Preferences",
      description: "Set your working hours, focus time, and meeting preferences once. We respect them every time."
    },
    {
      icon: Zap,
      title: "One-Click Scheduling",
      description: "Share a link. Your team sees options that work for everyone. They click yes. Meeting scheduled. Done."
    },
    {
      icon: Calendar,
      title: "Calendar Integration",
      description: "Works with Google Calendar, Outlook, and Apple Calendar. Syncs in real-time so you're never double-booked."
    }
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Scheduling That Actually Works
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Connect your calendar once. We handle the complexity of time zones, availability preferences, and team coordination.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group p-6 md:p-8 rounded-2xl bg-card border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className="mb-4">
                  <Icon size={32} className="text-secondary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">
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
