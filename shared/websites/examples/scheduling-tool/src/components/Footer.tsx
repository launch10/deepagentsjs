export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground border-t border-primary-foreground/10">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="TimeSync"
              className="h-10 w-auto mb-4"
            />
            <p className="text-primary-foreground/70 leading-relaxed">
              Effortless meeting scheduling for distributed teams. Eliminate timezone chaos and coordinate globally in seconds.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <nav className="flex flex-col gap-3">
              <a 
                href="#how-it-works" 
                className="text-primary-foreground/70 hover:text-primary-foreground transition-colors duration-200"
              >
                How It Works
              </a>
              <a 
                href="#features" 
                className="text-primary-foreground/70 hover:text-primary-foreground transition-colors duration-200"
              >
                Features
              </a>
              <a 
                href="#social-proof" 
                className="text-primary-foreground/70 hover:text-primary-foreground transition-colors duration-200"
              >
                Testimonials
              </a>
            </nav>
          </div>

          {/* CTA */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Get Started</h3>
            <p className="text-primary-foreground/70 mb-4">
              Join 2,000+ distributed teams saving 15 hours per week on scheduling.
            </p>
            <a 
              href="#cta" 
              className="inline-flex items-center px-6 py-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg transition-all duration-200 hover:scale-105"
            >
              Start Free Trial
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-primary-foreground/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-primary-foreground/60">
              © {new Date().getFullYear()} TimeSync. All rights reserved.
            </p>
            <p className="text-sm text-primary-foreground/60">
              Built for distributed teams, by distributed teams.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
