import { CalendarCheck, Settings, Zap, ArrowRight } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      number: 1,
      icon: CalendarCheck,
      title: "Connect Your Calendar",
      description: "Sync your Google, Outlook, or Apple calendar in seconds. We'll automatically detect your timezone and working hours."
    },
    {
      number: 2,
      icon: Settings,
      title: "Share Your Availability Preferences",
      description: "Set your meeting preferences once—preferred times, buffer periods, focus time blocks. Your team does the same."
    },
    {
      number: 3,
      icon: Zap,
      title: "Get Instant Meeting Suggestions",
      description: "Our smart algorithm finds optimal times that respect everyone's timezone and preferences. Your team just clicks 'yes' and it's scheduled."
    }
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16">
          Three Steps to Effortless Scheduling
        </h2>

        {/* Steps Container */}
        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="relative">
                  {/* Step Card */}
                  <div className="bg-card rounded-2xl p-8 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                    {/* Step Number Badge */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex-shrink-0 w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
                        {step.number}
                      </div>
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                    </div>

                    {/* Step Content */}
                    <h3 className="text-2xl font-semibold mb-3">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Arrow Between Steps (Desktop Only) */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <div className="bg-background rounded-full p-2">
                        <ArrowRight className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  )}

                  {/* Arrow Between Steps (Mobile - Vertical) */}
                  {index < steps.length - 1 && (
                    <div className="lg:hidden flex justify-center py-4">
                      <div className="bg-background rounded-full p-2 rotate-90">
                        <ArrowRight className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
