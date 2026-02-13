import { Sparkles, Globe, CheckCircle } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Sparkles,
      title: "Smart Time Suggestions",
      description: "Our algorithm analyzes everyone's availability and preferences to suggest optimal meeting times instantly."
    },
    {
      icon: Globe,
      title: "Timezone Intelligence",
      description: "Automatically converts and displays times in each participant's local timezone. No more mental math."
    },
    {
      icon: CheckCircle,
      title: "One-Click Scheduling",
      description: "Team members just click 'yes' on the suggested time. Meeting booked. Calendar invites sent. Done."
    }
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6">
            Scheduling That Just Works
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect your calendar. Share your preferences. We handle the rest.
          </p>
        </div>

        {/* Product Screenshot - Large Visual */}
        <div className="mb-12 md:mb-16 lg:mb-20">
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 blur-3xl opacity-30 rounded-3xl" />
            <div className="relative bg-card rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-border/50 hover:shadow-3xl transition-all duration-500 hover:-translate-y-1">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
                alt="Scheduling interface showing smart time suggestions"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="bg-card rounded-2xl p-6 md:p-8 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border/50"
              >
                <div className="mb-4 md:mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 text-primary">
                    <Icon className="w-6 h-6 md:w-7 md:h-7" />
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4">
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
