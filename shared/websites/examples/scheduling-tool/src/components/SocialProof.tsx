export function SocialProof() {
  const stats = [
    {
      number: "2,000+",
      label: "Distributed Teams"
    },
    {
      number: "80%",
      label: "Less Time Coordinating"
    },
    {
      number: "15 hrs/week",
      label: "Saved Per Team"
    }
  ];

  return (
    <section className="bg-muted py-20 md:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Headline */}
        <h2 className="text-4xl md:text-5xl font-bold text-foreground text-center mb-16">
          Trusted by Teams Worldwide
        </h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <div className="text-5xl md:text-6xl font-bold text-primary mb-3">
                {stat.number}
              </div>
              <div className="text-lg text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonial Card */}
        <div className="bg-primary text-primary-foreground rounded-2xl p-10 max-w-4xl mx-auto">
          <blockquote className="text-2xl md:text-3xl font-medium italic mb-6">
            "We used to spend half our Monday just scheduling meetings for the week. Now it takes 5 minutes. This tool gave us our time back."
          </blockquote>
          <div className="text-lg">
            <span className="font-bold">Sarah Chen</span>
            <span className="opacity-90"> — Head of Operations, TechCorp</span>
          </div>
        </div>
      </div>
    </section>
  );
}
