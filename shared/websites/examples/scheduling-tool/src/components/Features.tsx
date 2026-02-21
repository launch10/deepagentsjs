import { Globe, Shield, Zap, Users, Calendar, Bell } from "lucide-react";

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart timezone detection",
      description: "Automatically converts times to each participant's local timezone. No more mental math or conversion mistakes.",
    },
    {
      icon: Zap,
      title: "Instant availability sync",
      description: "Real-time calendar integration means your availability is always up-to-date across all platforms.",
    },
    {
      icon: Users,
      title: "Team scheduling",
      description: "Find times that work for entire teams, not just individuals. Perfect for cross-functional meetings.",
    },
    {
      icon: Calendar,
      title: "Buffer time protection",
      description: "Automatically add buffer time between meetings so you're not jumping from call to call without a break.",
    },
    {
      icon: Shield,
      title: "Privacy controls",
      description: "Share availability without exposing your entire calendar. You control what others see.",
    },
    {
      icon: Bell,
      title: "Smart reminders",
      description: "Automated reminders sent at the right time in each participant's timezone. Never miss a meeting again.",
    },
  ];

  return (
    <section id="features" className="py-20 md:py-28 lg:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Everything you need to{" "}
            <span className="text-primary">coordinate globally</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Built specifically for distributed teams who are tired of timezone chaos and calendar conflicts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 bg-card rounded-2xl border border-border shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
            >
              <div className="mb-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <feature.icon className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-card-foreground mb-3">
                {feature.title}
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary mb-2">80%</div>
            <div className="text-sm text-muted-foreground">Less time scheduling</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary mb-2">2min</div>
            <div className="text-sm text-muted-foreground">Average setup time</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary mb-2">24/7</div>
            <div className="text-sm text-muted-foreground">Automatic syncing</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary mb-2">100+</div>
            <div className="text-sm text-muted-foreground">Timezones supported</div>
          </div>
        </div>
      </div>
    </section>
  );
}
