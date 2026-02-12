export function Footer() {
  return (
    <footer className="bg-primary py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
          {/* Branding */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
                alt="Launch10 Logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-primary-foreground">Launch10</span>
            </div>
            <p className="text-primary-foreground/80 text-sm leading-relaxed max-w-sm">
              Making distributed teamwork effortless, one meeting at a time.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-primary-foreground uppercase tracking-wider">
              Navigation
            </h3>
            <nav className="flex flex-col gap-3">
              <a 
                href="#about" 
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 text-sm"
              >
                About
              </a>
              <a 
                href="#features" 
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 text-sm"
              >
                Features
              </a>
              <a 
                href="#pricing" 
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 text-sm"
              >
                Pricing
              </a>
              <a 
                href="#contact" 
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 text-sm"
              >
                Contact
              </a>
            </nav>
          </div>

          {/* Copyright - spans full width on mobile, aligns right on desktop */}
          <div className="flex items-end lg:justify-end">
            <p className="text-primary-foreground/60 text-xs">
              © 2024 Launch10. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}