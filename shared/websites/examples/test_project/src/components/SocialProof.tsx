import { Quote } from 'lucide-react';

export function SocialProof() {
  const stats = [
    { number: '2,000+', label: 'Distributed teams' },
    { number: '80%', label: 'Less coordination time' },
    { number: '15 hrs/week', label: 'Saved per team' },
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Trusted by 2,000+ Distributed Teams
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Companies around the world are saving hours every week on scheduling
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-16 md:mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                {stat.number}
              </div>
              <div className="text-base md:text-lg text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonial Card */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg p-8 md:p-10 relative">
            {/* Quote Icon */}
            <div className="absolute top-6 left-6 text-primary/20">
              <Quote className="w-12 h-12 md:w-16 md:h-16" />
            </div>

            {/* Quote Text */}
            <blockquote className="relative z-10 mb-6">
              <p className="text-xl md:text-2xl text-card-foreground leading-relaxed">
                "We used to spend half our Monday mornings just trying to schedule meetings for the week. Now it takes 5 minutes. This tool gave us back so much time to actually build our product."
              </p>
            </blockquote>

            {/* Author Info */}
            <div className="flex items-center gap-4">
              <img
                src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png"
                alt="TechCorp"
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <div className="font-semibold text-card-foreground">
                  Sarah Chen
                </div>
                <div className="text-sm text-muted-foreground">
                  Head of Engineering at TechCorp
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
