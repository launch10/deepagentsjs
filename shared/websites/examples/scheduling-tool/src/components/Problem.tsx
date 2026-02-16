import { MessageSquare, Clock, Calendar } from 'lucide-react';

export function Problem() {
  const painPoints = [
    {
      icon: MessageSquare,
      title: "Endless Back-and-Forth",
      description: "12+ messages in Slack just to schedule a 30-minute meeting"
    },
    {
      icon: Clock,
      title: "Someone Always Loses",
      description: "Early morning calls for Tokyo, late nights for New York"
    },
    {
      icon: Calendar,
      title: "Meetings About Meetings",
      description: "Spending more time coordinating than actually collaborating"
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            The Timezone Coordination Nightmare
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Distributed teams waste hours every week just trying to find a time that works
          </p>
        </div>

        {/* Pain Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl shadow-md p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
              >
                {/* Icon */}
                <div className="mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  {point.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
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
