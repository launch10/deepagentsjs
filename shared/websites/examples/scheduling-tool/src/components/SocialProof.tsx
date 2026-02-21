import { Star, Quote } from "lucide-react";

export function SocialProof() {
  const testimonials = [
    {
      quote: "TimeSync saved our team 15 hours per week. No more endless Slack threads about 'when works for everyone.' It just works.",
      author: "Sarah Chen",
      role: "VP of Engineering",
      company: "TechCorp",
      rating: 5,
    },
    {
      quote: "Managing meetings across SF, London, and Singapore used to be a nightmare. Now it's automatic. This tool is a game-changer for distributed teams.",
      author: "Marcus Rodriguez",
      role: "Project Manager",
      company: "Global Innovations",
      rating: 5,
    },
    {
      quote: "We tried every scheduling tool out there. TimeSync is the only one that actually understands how distributed teams work. The timezone handling is flawless.",
      author: "Emily Watson",
      role: "Operations Director",
      company: "RemoteFirst Co",
      rating: 5,
    },
  ];

  const stats = [
    { value: "2,000+", label: "Distributed teams" },
    { value: "80%", label: "Time saved on scheduling" },
    { value: "15hrs", label: "Saved per team weekly" },
    { value: "4.9/5", label: "Average rating" },
  ];

  return (
    <section id="social-proof" className="py-20 md:py-28 lg:py-32 bg-muted">
      <div className="container mx-auto px-4 md:px-6">
        {/* Stats bar */}
        <div className="max-w-5xl mx-auto mb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 bg-card rounded-2xl shadow-lg border border-border">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Loved by teams{" "}
            <span className="text-secondary">around the world</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Join thousands of distributed teams who've eliminated scheduling chaos.
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="group bg-card rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border relative"
            >
              {/* Quote icon */}
              <div className="absolute -top-4 left-8 w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shadow-lg">
                <Quote className="w-6 h-6 text-secondary-foreground" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4 mt-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-card-foreground leading-relaxed mb-6 text-lg">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="border-t border-border pt-4">
                <div className="font-semibold text-card-foreground">
                  {testimonial.author}
                </div>
                <div className="text-sm text-muted-foreground">
                  {testimonial.role}
                </div>
                <div className="text-sm text-primary font-medium mt-1">
                  {testimonial.company}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-20 text-center">
          <p className="text-sm text-muted-foreground mb-6">
            TRUSTED BY LEADING COMPANIES
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60">
            <div className="text-2xl font-bold text-foreground">TechCorp</div>
            <div className="text-2xl font-bold text-foreground">Global Innovations</div>
            <div className="text-2xl font-bold text-foreground">RemoteFirst Co</div>
          </div>
        </div>
      </div>
    </section>
  );
}
