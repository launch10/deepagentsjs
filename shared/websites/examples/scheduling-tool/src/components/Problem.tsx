import { MessageSquare, Calendar, Clock } from 'lucide-react';

export function Problem() {
  const painPoints = [
    {
      icon: MessageSquare,
      title: "Endless Back-and-Forth",
      description: "12+ messages in Slack just to schedule a 30-minute meeting across 3 time zones"
    },
    {
      icon: Calendar,
      title: "Calendar Chaos",
      description: "Manually checking 5 different calendars, converting time zones in your head, and still getting it wrong"
    },
    {
      icon: Clock,
      title: "Productivity Drain",
      description: "Your project managers spend 15+ hours per week just coordinating schedules instead of doing real work"
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 md:mb-6">
            The Hidden Cost of "When Works for Everyone?"
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground">
            Distributed teams waste hours every week on scheduling coordination
          </p>
        </div>

        {/* Pain Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl shadow-md p-6 md:p-8 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                {/* Icon */}
                <div className="mb-4 md:mb-6">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-3 md:mb-4">
                  {point.title}
                </h3>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
