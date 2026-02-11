import { MessageSquare, Globe, Calendar } from 'lucide-react';

export function ProblemSolution() {
  const problems = [
    {
      icon: MessageSquare,
      title: "Endless Back-and-Forth",
      description: "Slack threads with 47 messages just to find one hour that works for 5 people across 3 continents."
    },
    {
      icon: Globe,
      title: "Time Zone Math Headaches",
      description: "Is 2pm EST too early for Sydney? Too late for London? You're tired of doing mental gymnastics."
    },
    {
      icon: Calendar,
      title: "Calendar Chaos",
      description: "Juggling multiple calendars, availability preferences, and meeting constraints manually is burning hours every week."
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16">
          The Scheduling Nightmare Ends Here
        </h2>

        {/* Problem Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-16 md:mb-20">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-6 md:p-8 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="mb-4">
                  <Icon className="w-10 h-10 md:w-12 md:h-12 text-primary" />
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-3 text-card-foreground">
                  {problem.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Solution */}
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
            We Handle It All Automatically
          </h3>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Connect your calendar, set your preferences once, and our smart algorithm finds optimal times instantly. Your team just clicks yes.
          </p>
        </div>
      </div>
    </section>
  );
}
