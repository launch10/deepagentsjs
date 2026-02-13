import { Clock, MessageSquare, CalendarX } from 'lucide-react';

export function Problem() {
  const problems = [
    {
      icon: Clock,
      title: "15 Hours Wasted Weekly",
      description: "The average project manager spends 3 hours per day just coordinating schedules across time zones."
    },
    {
      icon: MessageSquare,
      title: "Endless Back-and-Forth",
      description: "12+ messages per meeting. Multiply that across your team and you're drowning in coordination overhead."
    },
    {
      icon: CalendarX,
      title: "Meetings That Never Happen",
      description: "23% of planned meetings get cancelled because finding a time that works becomes impossible."
    }
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            The Real Cost of 'Finding a Time'
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            Every week, your team loses hours to calendar coordination. It's not just annoying—it's expensive.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-8 shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="mb-6">
                  <Icon size={40} className="text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  {problem.title}
                </h3>
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
