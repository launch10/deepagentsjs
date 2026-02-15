import { Zap, Link, Calendar, CheckCircle } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Zap,
      title: "Smart Time Zone Detection",
      description: "Automatically suggests times that work for everyone, no matter where they are."
    },
    {
      icon: Link,
      title: "One-Click Availability",
      description: "Share your availability with a link. No account required for participants."
    },
    {
      icon: Calendar,
      title: "Calendar Integration",
      description: "Syncs with Google Calendar, Outlook, and Apple Calendar in real-time."
    },
    {
      icon: CheckCircle,
      title: "Instant Confirmations",
      description: "Everyone clicks yes, meeting is booked. No coordinator needed."
    }
  ];

  return (
    <section className="bg-background py-20 md:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Scheduling That Just Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect your calendar. Set your preferences. Let us handle the rest.
          </p>
        </div>

        {/* Two-column asymmetric layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Left: Large prominent image */}
          <div className="flex justify-center lg:justify-end order-2 lg:order-1">
            <div className="relative group">
              <img
                src="https://pub-c8c4c20c38d9404e9f0b5b62b1b2a165.r2.dev/21b36cfc-f657-471f-8256-d36bea9689fc.png"
                alt="Scheduling illustration"
                className="max-w-md w-full h-auto transition-all duration-500 ease-out group-hover:scale-105 group-hover:-translate-y-2"
              />
              {/* Subtle glow effect on hover */}
              <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
            </div>
          </div>

          {/* Right: Feature list */}
          <div className="space-y-8 order-1 lg:order-2">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="flex gap-4 group transition-all duration-300 hover:translate-x-2"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
