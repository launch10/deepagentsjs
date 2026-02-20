export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground border-t border-primary-foreground/10">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid md:grid-cols-3 gap-8 md:gap-12 mb-8">
          {/* Brand */}
          <div>
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="TimeSync Logo" 
              className="h-10 w-auto mb-4"
            />
            <p className="text-primary-foreground/80 leading-relaxed">
              Scheduling meetings across time zones, made simple. Stop the coordination chaos and start meeting.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-['Outfit'] font-semibold text-lg mb-4">Quick Links</h3>
            <nav className="flex flex-col gap-3">
              <a href="#problem" className="text-primary-foreground/80 hover:text-secondary transition-colors">
                Why TimeSync
              </a>
              <a href="#how-it-works" className="text-primary-foreground/80 hover:text-secondary transition-colors">
                How It Works
              </a>
              <a href="#features" className="text-primary-foreground/80 hover:text-secondary transition-colors">
                Features
              </a>
              <a href="#social-proof" className="text-primary-foreground/80 hover:text-secondary transition-colors">
                Testimonials
              </a>
            </nav>
          </div>

          {/* CTA */}
          <div>
            <h3 className="font-['Outfit'] font-semibold text-lg mb-4">Get Started</h3>
            <p className="text-primary-foreground/80 mb-4">
              Ready to reclaim your time? Start your free 14-day trial today.
            </p>
            <a 
              href="#cta" 
              className="inline-flex items-center px-6 py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/90 transition-all hover:scale-105 shadow-lg"
            >
              Try It Free
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-primary-foreground/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/70">
            © 2025 TimeSync. All rights reserved.
          </p>
          <p className="text-sm text-primary-foreground/70">
            Built for distributed teams, by distributed teams.
          </p>
        </div>
      </div>
    </footer>
  );
}
