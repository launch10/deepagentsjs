import { Quote } from 'lucide-react';

export function SocialProof() {
  const stats = [
    { value: '2,000+', label: 'Distributed Teams' },
    { value: '80%', label: 'Less Coordination Time' },
    { value: '15 hrs/week', label: 'Saved Per Team' },
  ];

  return (
    <section className="bg-muted py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 md:mb-16 lg:mb-20">
          Trusted by Teams Who Value Their Time
        </h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16 md:mb-20 lg:mb-24">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center space-y-2 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary">
                {stat.value}
              </div>
              <div className="text-lg md:text-xl text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonial Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-3xl p-8 md:p-10 lg:p-12 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Quote Icon */}
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Quote className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              </div>

              {/* Quote Text */}
              <blockquote className="text-xl md:text-2xl lg:text-3xl font-medium text-card-foreground leading-relaxed">
                "We used to spend half our Monday just scheduling meetings for the week. Now it's instant. Game changer for our remote team."
              </blockquote>

              {/* Attribution */}
              <div className="pt-4 border-t border-border/50 w-full">
                <p className="text-base md:text-lg font-semibold text-card-foreground">
                  Sarah Chen
                </p>
                <p className="text-sm md:text-base text-muted-foreground mt-1">
                  Project Manager at TechCorp
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
