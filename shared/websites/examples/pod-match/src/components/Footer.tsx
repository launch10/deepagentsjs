export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16 md:py-20 border-t-8 border-primary">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-12 mb-12">
          {/* Logo and Tagline */}
          <div className="flex flex-col gap-6 max-w-md">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/3f17f0ea-ab81-435d-8295-10cc3f3d48c6.jpg" 
              alt="Friend of the Pod" 
              className="h-16 w-auto"
            />
            <p className="text-xl font-body text-background/80 leading-relaxed">
              Podcast matchmaking for producers who value their time
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-4">
            <h3 className="font-display text-2xl text-secondary mb-2">
              QUICK LINKS
            </h3>
            <a 
              href="#how-it-works" 
              className="text-lg font-body font-semibold hover:text-secondary transition-colors inline-flex items-center gap-2 group"
            >
              <span className="w-2 h-2 bg-secondary group-hover:w-4 transition-all" />
              How It Works
            </a>
            <a 
              href="#signup" 
              className="text-lg font-body font-semibold hover:text-secondary transition-colors inline-flex items-center gap-2 group"
            >
              <span className="w-2 h-2 bg-secondary group-hover:w-4 transition-all" />
              Sign Up
            </a>
          </nav>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t-4 border-background/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-base font-body text-background/60">
              © 2025 Friend of the Pod. All rights reserved.
            </p>
            <p className="font-display text-lg text-secondary tracking-wider">
              STOP COLD-EMAILING
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
