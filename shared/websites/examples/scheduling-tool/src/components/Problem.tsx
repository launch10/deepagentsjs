import { Clock, Globe, Calendar, AlertCircle } from 'lucide-react';

export function Problem() {
  const problems = [
    {
      icon: Clock,
      title: "Endless Back-and-Forth",
      description: "12 messages later and you still don't have a meeting time. Someone's always asleep when you suggest a slot.",
    },
    {
      icon: Globe,
      title: "Manual Timezone Math",
      description: "Is 3pm EST too early for the Sydney team? Wait, are they in daylight savings? Let me Google that...",
    },
    {
      icon: Calendar,
      title: "Calendar Chaos",
      description: "Juggling 5 different calendars, trying to find that magical 30-minute window where everyone's free.",
    },
    {
      icon: AlertCircle,
      title: "Wasted Hours Weekly",
      description: "Your project managers spend 15+ hours per week just coordinating schedules instead of doing actual work.",
    },
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            The Timezone Coordination Nightmare
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Every distributed team knows the pain
          </p>
        </div>

        {/* Problem Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
              >
                {/* Icon */}
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <Icon className="w-6 h-6" />
                </div>

                {/* Title */}
                <h3 className="text-xl md:text-2xl font-semibold mb-3">
                  {problem.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
