import { MessageSquareX, Clock, AlertCircle } from 'lucide-react';

export function Problem() {
  const painPoints = [
    {
      icon: MessageSquareX,
      title: "Drowning in 'When Works for Everyone?' Messages",
      description: "Your Slack threads are a graveyard of proposed times, timezone conversions, and 'sorry, that doesn't work for me' responses. What should take 2 minutes takes 2 days.",
    },
    {
      icon: Clock,
      title: "Timezone Math Is Killing Your Productivity",
      description: "Is 3pm EST too early for your Sydney team? Too late for London? You're spending more time calculating timezones than actually meeting.",
    },
    {
      icon: AlertCircle,
      title: "Your Team Is Frustrated and Meetings Keep Getting Delayed",
      description: "By the time you finally find a slot that works, the urgent issue isn't urgent anymore. Your team is tired of the coordination chaos, and projects are falling behind.",
    },
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16">
          Scheduling Shouldn't Be Your Full-Time Job
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {painPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 md:p-8 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <div className="mb-4">
                  <Icon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">
                  {point.title}
                </h3>
                <p className="text-muted-foreground">
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
