import { CalendarPlus2, SlidersHorizontal, Share2 } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      number: '01',
      icon: CalendarPlus2,
      title: 'Connect Your Calendar',
      description: 'Link your Google Calendar, Outlook, or other calendar in 30 seconds',
    },
    {
      number: '02',
      icon: SlidersHorizontal,
      title: 'Set Your Preferences',
      description: 'Tell us your working hours, time zone, and meeting preferences',
    },
    {
      number: '03',
      icon: Share2,
      title: 'Share & Schedule',
      description: 'Send your scheduling link. We find times that work for everyone instantly',
    },
  ];

  return (
    <section id="how-it-works" className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Three Steps to Better Meetings
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground">
            Set it up once, save time forever
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="relative bg-card rounded-3xl p-8 md:p-10 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                {/* Decorative Step Number */}
                <div className="absolute top-4 right-4 text-6xl font-bold text-primary/20 leading-none select-none">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="relative z-10 mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
                    <Icon className="w-8 h-8" />
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <h3 className="text-xl md:text-2xl font-semibold mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
