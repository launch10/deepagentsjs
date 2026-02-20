import { Calendar, Zap, CheckCircle } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: Calendar,
      title: "Connect your calendar",
      description: "Link your Google Calendar, Outlook, or any calendar tool. We sync your availability in real-time, respecting your working hours and preferences.",
      color: "from-secondary to-accent"
    },
    {
      number: "02",
      icon: Zap,
      title: "Share your scheduling link",
      description: "Send one simple link to your team. No more \"when are you free?\" messages. Everyone inputs their timezone and availability preferences instantly.",
      color: "from-accent to-[#E9C46A]"
    },
    {
      number: "03",
      icon: CheckCircle,
      title: "We find the perfect time",
      description: "Our algorithm analyzes everyone's calendars across all timezones and suggests optimal meeting times. Your team just clicks yes. Meeting scheduled.",
      color: "from-[#E9C46A] to-secondary"
    }
  ];

  return (
    <section id="how-it-works" className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <div className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-6">
            How It Works
          </div>
          <h2 className="font-['Outfit'] font-bold text-4xl md:text-5xl lg:text-6xl text-foreground mb-6">
            From chaos to scheduled in{" "}
            <span className="text-secondary">3 simple steps</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            No more back-and-forth. No more timezone confusion. Just instant scheduling that actually works.
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-8 md:space-y-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isEven = index % 2 === 0;
            
            return (
              <div 
                key={index}
                className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 md:gap-12 items-center`}
              >
                {/* Icon side */}
                <div className="flex-shrink-0 relative">
                  <div className={`w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br ${step.color} p-1 shadow-2xl`}>
                    <div className="w-full h-full bg-background rounded-3xl flex items-center justify-center">
                      <Icon className="w-16 h-16 md:w-20 md:h-20 text-primary" />
                    </div>
                  </div>
                  {/* Step number badge */}
                  <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-secondary text-secondary-foreground font-['Outfit'] font-bold text-2xl flex items-center justify-center shadow-lg">
                    {step.number}
                  </div>
                </div>

                {/* Content side */}
                <div className={`flex-1 ${isEven ? 'md:text-left' : 'md:text-right'} text-center`}>
                  <h3 className="font-['Outfit'] font-bold text-2xl md:text-3xl lg:text-4xl text-foreground mb-4">
                    {step.title}
                  </h3>
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto md:mx-0">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="max-w-2xl mx-auto mt-16 text-center">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-lg">
            <p className="text-xl md:text-2xl font-semibold text-card-foreground mb-4">
              The entire process takes less than 2 minutes
            </p>
            <p className="text-muted-foreground mb-6">
              Seriously. You'll wonder why you ever did it the old way.
            </p>
            <a 
              href="#cta" 
              className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all hover:scale-105 shadow-lg text-lg"
            >
              Try It Free for 14 Days
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
