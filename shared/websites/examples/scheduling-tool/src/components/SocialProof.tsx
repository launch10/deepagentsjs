import { Quote } from 'lucide-react';

export function SocialProof() {
  const stats = [
    {
      number: "80%",
      label: "Less time coordinating",
      description: "Teams cut scheduling time by 80% on average"
    },
    {
      number: "15 hrs/week",
      label: "Saved per team",
      description: "Project managers reclaim 15+ hours weekly"
    },
    {
      number: "2,000+",
      label: "Distributed teams",
      description: "From 5-person startups to 500-person enterprises"
    }
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Trusted by 2,000+ Distributed Teams
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Companies worldwide are saving hours every week
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 md:mb-20">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="text-center p-8 bg-card rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-5xl md:text-6xl font-bold text-primary mb-3">
                {stat.number}
              </div>
              <div className="text-xl font-semibold mb-2">
                {stat.label}
              </div>
              <p className="text-muted-foreground">
                {stat.description}
              </p>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-12 relative">
            <Quote className="absolute top-6 left-6 w-12 h-12 text-primary/20" />
            <div className="relative z-10">
              <blockquote className="text-lg md:text-xl leading-relaxed mb-6 pl-8">
                "Before this tool, I spent half my day playing timezone coordinator. Now I just send a link and meetings magically appear on everyone's calendar. It's honestly life-changing."
              </blockquote>
              <div className="flex items-center gap-4 pl-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-lg">SC</span>
                </div>
                <div>
                  <div className="font-semibold text-lg">Sarah Chen</div>
                  <div className="text-muted-foreground">Head of Operations, TechCorp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
