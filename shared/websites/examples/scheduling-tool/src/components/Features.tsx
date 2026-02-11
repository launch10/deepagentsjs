import { Globe, Settings, MousePointer, Calendar } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart Time Zone Detection",
      description: "Automatically accounts for every team member's location and suggests times that are reasonable for everyone."
    },
    {
      icon: Settings,
      title: "Preference Learning",
      description: "Set your working hours, no-meeting days, and focus time once. We remember and respect your boundaries."
    },
    {
      icon: MousePointer,
      title: "One-Click Scheduling",
      description: "Share a link, get instant availability. No account required for guests. Meetings booked in seconds, not hours."
    },
    {
      icon: Calendar,
      title: "Calendar Sync",
      description: "Works with Google Calendar, Outlook, and Apple Calendar. Real-time availability, zero double-bookings."
    }
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16">
          Scheduling That Just Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl shadow-md p-6 md:p-8 transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-semibold mb-2 text-card-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
