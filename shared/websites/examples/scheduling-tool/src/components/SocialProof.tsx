import { Star, TrendingUp } from "lucide-react";

export function SocialProof() {
  const testimonials = [
    {
      quote: "TimeSync saved our team 15 hours per week. We used to spend entire afternoons just trying to coordinate meetings across our US, UK, and Singapore offices. Now it's instant.",
      author: "Sarah Chen",
      role: "VP of Operations",
      company: "TechCorp",
      rating: 5
    },
    {
      quote: "As a project manager juggling 4 different teams across 6 timezones, this tool is a lifesaver. I can't imagine going back to the old way of endless Slack threads.",
      author: "Marcus Rodriguez",
      role: "Senior Project Manager",
      company: "Global Innovations",
      rating: 5
    },
    {
      quote: "The timezone detection is brilliant. No more accidentally scheduling 3am meetings for our Tokyo team. Everyone's happy, and we're actually more productive.",
      author: "Emma Thompson",
      role: "Head of Remote Operations",
      company: "DistributedCo",
      rating: 5
    }
  ];

  const stats = [
    { value: "2,000+", label: "Distributed teams" },
    { value: "80%", label: "Less coordination time" },
    { value: "15hrs", label: "Saved per week" },
    { value: "50K+", label: "Meetings scheduled" }
  ];

  return (
    <section id="social-proof" className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <div className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-6">
            Loved by Teams Worldwide
          </div>
          <h2 className="font-['Outfit'] font-bold text-4xl md:text-5xl lg:text-6xl text-foreground mb-6">
            Join 2,000+ teams who've{" "}
            <span className="text-secondary">ditched the chaos</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Distributed teams around the world trust TimeSync to handle their scheduling.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-5xl mx-auto mb-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="font-['Outfit'] font-bold text-4xl md:text-5xl text-primary mb-2">
                {stat.value}
              </div>
              <div className="text-sm md:text-base text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
            >
              {/* Star rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-card-foreground leading-relaxed mb-6 flex-grow">
                "{testimonial.quote}"
              </blockquote>

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

        {/* Bottom highlight */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="bg-card border-2 border-secondary/30 rounded-2xl p-8 md:p-10 text-center shadow-xl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/10 text-secondary mb-6">
              <TrendingUp className="w-8 h-8" />
            </div>
            <h3 className="font-['Outfit'] font-bold text-2xl md:text-3xl text-card-foreground mb-4">
              Companies save an average of 15 hours per week
            </h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              That's nearly 2 full workdays reclaimed from calendar coordination. Imagine what your team could do with that time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
