import { Quote } from 'lucide-react';

export function SocialProof() {
  const stats = [
    {
      number: "2,000+",
      label: "Distributed teams"
    },
    {
      number: "80%",
      label: "Less coordination time"
    },
    {
      number: "15 hrs/week",
      label: "Saved per team"
    }
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16">
          Trusted by Distributed Teams Worldwide
        </h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16 md:mb-20">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="text-center transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl md:text-5xl font-bold text-accent mb-2">
                {stat.number}
              </div>
              <div className="text-lg text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonial Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-10 lg:p-12 transition-all duration-300 hover:shadow-xl">
            <Quote className="w-10 h-10 md:w-12 md:h-12 text-accent mb-6 opacity-50" />
            
            <blockquote className="space-y-6">
              <p className="text-lg md:text-xl text-card-foreground leading-relaxed">
                "We used to spend hours coordinating meetings across our US, Europe, and Asia teams. Now it takes seconds. This tool gave us back an entire workday every week."
              </p>
              
              <footer className="flex items-center gap-4 pt-4 border-t border-border">
                <div>
                  <div className="font-semibold text-card-foreground">
                    Sarah Chen
                  </div>
                  <div className="text-sm text-muted-foreground">
                    TechCorp Project Manager
                  </div>
                </div>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
