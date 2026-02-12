import { Calendar, Settings, Sparkles } from 'lucide-react';

export function Solution() {
  const features = [
    {
      icon: Calendar,
      title: "Connect Your Calendar",
      description: "Link your Google, Outlook, or any calendar in seconds. We sync your availability automatically."
    },
    {
      icon: Settings,
      title: "Set Your Preferences",
      description: "Tell us when you prefer meetings (or when you absolutely don't). We respect your deep work time."
    },
    {
      icon: Sparkles,
      title: "We Handle the Rest",
      description: "Our AI finds the optimal time for everyone instantly. No math, no guessing, no endless threads."
    }
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Three Steps to Meeting Bliss
          </h2>
          <div className="flex justify-center mt-8">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="Launch10" 
              className="h-8 opacity-60"
            />
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-3xl shadow-lg p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Icon */}
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl md:text-2xl font-bold text-card-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                {/* Step Number */}
                <div className="mt-6 pt-6 border-t border-border">
                  <span className="text-sm font-semibold text-primary">
                    Step {index + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
