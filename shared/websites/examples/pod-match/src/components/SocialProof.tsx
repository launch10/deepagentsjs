import { Quote } from 'lucide-react';

export function SocialProof() {
  return (
    <section className="bg-secondary py-20 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Diagonal stripe accent */}
      <div className="absolute top-0 left-0 w-full h-24 bg-primary transform rotate-[2deg] translate-y-[-50%]" />
      <div className="absolute bottom-0 right-0 w-full h-24 bg-primary transform rotate-[2deg] translate-y-[50%]" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-secondary-foreground mb-4">
            TRUSTED BY
            <span className="block text-primary">TOP PODCASTERS</span>
          </h2>
        </div>
        
        <div className="max-w-5xl mx-auto">
          {/* Testimonial card with bold styling */}
          <div className="relative bg-background border-8 border-foreground shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] p-10 md:p-16 lg:p-20">
            {/* Giant quote mark */}
            <div className="absolute -top-8 -left-8 bg-primary border-8 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-24 h-24 flex items-center justify-center rotate-[-5deg]">
              <Quote className="w-12 h-12 text-primary-foreground" strokeWidth={3} />
            </div>
            
            {/* Testimonial quote */}
            <blockquote>
              <p className="text-3xl md:text-4xl lg:text-5xl font-body font-bold leading-tight mb-10 md:mb-12 text-foreground">
                "Friend of the Pod changed everything. I used to spend{" "}
                <span className="text-primary">10 hours a week</span> on guest outreach. Now I spend{" "}
                <span className="text-secondary">10 minutes.</span>"
              </p>
              
              {/* Attribution */}
              <footer className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-8 border-t-4 border-foreground">
                <div>
                  <cite className="not-italic font-display text-3xl md:text-4xl text-foreground block mb-2">
                    JOE ROGAN
                  </cite>
                  <p className="text-xl md:text-2xl text-foreground/60 font-body">
                    The Joe Rogan Experience
                  </p>
                </div>
                
                {/* Stats badge */}
                <div className="bg-primary text-primary-foreground border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] px-8 py-4 rotate-[2deg]">
                  <div className="font-display text-4xl md:text-5xl leading-none">
                    #1
                  </div>
                  <div className="font-body text-sm uppercase tracking-wider mt-1">
                    Podcast
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
