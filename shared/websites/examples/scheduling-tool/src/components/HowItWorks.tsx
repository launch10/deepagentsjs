export function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: "Connect Your Calendar",
      description: "Link your Google Calendar, Outlook, or any calendar in 30 seconds. We sync your availability in real-time."
    },
    {
      number: 2,
      title: "Set Your Preferences",
      description: "Tell us your ideal meeting hours, buffer times, and timezone. We remember so you don't have to explain every time."
    },
    {
      number: 3,
      title: "Share & Schedule Instantly",
      description: "Send one link to your team. We analyze everyone's availability and suggest the perfect times. Everyone clicks yes. Done."
    }
  ];

  return (
    <section className="bg-background py-16 md:py-20 lg:py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Three Steps to Effortless Scheduling
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            No more timezone math. No more endless threads. Just meetings that work.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12 md:mb-16">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-card rounded-2xl shadow-md p-6 md:p-8 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Number Badge */}
              <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-primary text-primary-foreground rounded-full text-2xl md:text-3xl font-bold mb-6">
                {step.number}
              </div>

              {/* Content */}
              <h3 className="text-xl md:text-2xl font-semibold mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Product Screenshot */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg overflow-hidden">
            <img
              src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png"
              alt="Scheduling tool interface showing calendar availability"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
