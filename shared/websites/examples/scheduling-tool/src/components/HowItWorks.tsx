import { Calendar, Settings, Sparkles, ArrowRight } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      number: 1,
      icon: Calendar,
      title: "Connect Your Calendar",
      description: "Link your Google Calendar or Outlook in 30 seconds. We sync your availability in real-time."
    },
    {
      number: 2,
      icon: Settings,
      title: "Share Your Preferences",
      description: "Set your working hours, buffer times, and meeting preferences. We respect your boundaries."
    },
    {
      number: 3,
      icon: Sparkles,
      title: "Get Instant Suggestions",
      description: "Our AI finds optimal times that work for everyone across all time zones. Your team just clicks yes."
    }
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            From Chaos to Confirmed in 3 Steps
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            No more timezone math. No more endless threads. Just instant scheduling.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Step Card */}
              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Number Badge */}
                <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold mb-6 shadow-lg">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="mb-4">
                  <step.icon className="w-12 h-12 text-primary" strokeWidth={1.5} />
                </div>

                {/* Title */}
                <h3 className="text-xl md:text-2xl font-semibold mb-3">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Arrow Connector (Desktop Only) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] z-0">
                  <div className="flex items-center justify-center h-full">
                    <ArrowRight className="w-8 h-8 text-primary/30" strokeWidth={2} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA Hint */}
        <div className="text-center mt-12 md:mt-16">
          <p className="text-muted-foreground text-sm md:text-base">
            Setup takes less than 2 minutes. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}
