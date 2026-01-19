import { Quote } from 'lucide-react';

export function SocialProof() {
  const stats = [
    {
      number: '2,000+',
      label: 'Distributed Teams',
    },
    {
      number: '80%',
      label: 'Less Coordination Time',
    },
    {
      number: '15 hrs',
      label: 'Saved Per Week',
    },
  ];

  const testimonials = [
    {
      quote:
        "We went from spending 15+ hours a week on scheduling coordination to basically zero. It's like having a personal assistant for the entire team. Game-changer for our remote-first company.",
      name: 'Sarah Chen',
      role: 'Head of Operations',
      company: 'TechCorp',
    },
    {
      quote:
        "Our team spans 8 timezones. Before this tool, scheduling was a nightmare. Now it's automatic. We've cut our time-to-meeting by 80% and our team is actually happy about scheduling again.",
      name: 'Marcus Rodriguez',
      role: 'Engineering Manager',
      company: 'GlobalDev Solutions',
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12">
          Trusted by 2,000+ Distributed Teams Worldwide
        </h2>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-primary text-primary-foreground rounded-xl p-6 text-center transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-4xl md:text-5xl font-bold mb-2">
                {stat.number}
              </div>
              <div className="text-sm md:text-base opacity-90">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-8 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
            >
              <Quote className="w-10 h-10 text-primary mb-4 opacity-50" />
              <p className="text-lg mb-6 italic text-card-foreground">
                "{testimonial.quote}"
              </p>
              <div>
                <div className="font-semibold text-card-foreground">
                  {testimonial.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {testimonial.role} • {testimonial.company}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
