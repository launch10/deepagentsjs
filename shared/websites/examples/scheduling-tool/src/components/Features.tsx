import { Globe, Shield, Zap, Users, Calendar, Bell } from "lucide-react";

export function Features() {
  const features = [
    {
      icon: Globe,
      title: "Smart timezone detection",
      description: "Automatically detects and converts timezones. No more mental math or conversion tools."
    },
    {
      icon: Zap,
      title: "Instant suggestions",
      description: "Get optimal meeting times in seconds, not hours. Our AI finds slots that work for everyone."
    },
    {
      icon: Users,
      title: "Team availability sync",
      description: "See everyone's availability in one view. No more asking \"are you free?\""
    },
    {
      icon: Calendar,
      title: "Calendar integration",
      description: "Works with Google Calendar, Outlook, Apple Calendar, and more. Two-way sync included."
    },
    {
      icon: Shield,
      title: "Privacy-first design",
      description: "We only see when you're busy or free—never your meeting details. Your privacy matters."
    },
    {
      icon: Bell,
      title: "Smart notifications",
      description: "Get reminded in your timezone. Never miss a meeting because you forgot to convert the time."
    }
  ];

  return (
    <section id="features" className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <div className="inline-block px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-semibold mb-6">
            Features
          </div>
          <h2 className="font-['Outfit'] font-bold text-4xl md:text-5xl lg:text-6xl text-foreground mb-6">
            Everything you need to{" "}
            <span className="text-primary">schedule smarter</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Built for distributed teams who are tired of wasting time on coordination.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="group bg-card border border-border rounded-2xl p-6 md:p-8 hover:shadow-2xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-2"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:scale-110">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-['Outfit'] font-semibold text-xl md:text-2xl text-card-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Feature highlight box */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <h3 className="font-['Outfit'] font-bold text-3xl md:text-4xl text-primary-foreground mb-4">
                Works with your existing tools
              </h3>
              <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
                No need to change your workflow. TimeSync integrates seamlessly with the tools you already use every day.
              </p>
              <div className="flex flex-wrap justify-center gap-4 md:gap-6">
                <div className="px-6 py-3 bg-background/95 backdrop-blur-sm rounded-lg font-semibold text-foreground shadow-lg">
                  Google Calendar
                </div>
                <div className="px-6 py-3 bg-background/95 backdrop-blur-sm rounded-lg font-semibold text-foreground shadow-lg">
                  Outlook
                </div>
                <div className="px-6 py-3 bg-background/95 backdrop-blur-sm rounded-lg font-semibold text-foreground shadow-lg">
                  Slack
                </div>
                <div className="px-6 py-3 bg-background/95 backdrop-blur-sm rounded-lg font-semibold text-foreground shadow-lg">
                  Microsoft Teams
                </div>
                <div className="px-6 py-3 bg-background/95 backdrop-blur-sm rounded-lg font-semibold text-foreground shadow-lg">
                  Zoom
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
