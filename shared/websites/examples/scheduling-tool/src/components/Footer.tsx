export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo and Brand */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-3">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
                alt="TimeSync Logo" 
                className="max-w-16 h-auto"
              />
              <span className="text-2xl font-bold">TimeSync</span>
            </div>
            <p className="text-sm text-primary-foreground/80 text-center md:text-left">
              Scheduling made simple for global teams
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
            <a 
              href="#how-it-works" 
              className="text-sm font-medium hover:text-primary-foreground/80 transition-colors duration-200"
            >
              How It Works
            </a>
            <a 
              href="#features" 
              className="text-sm font-medium hover:text-primary-foreground/80 transition-colors duration-200"
            >
              Features
            </a>
          </nav>

          {/* Copyright */}
          <div className="text-sm text-primary-foreground/80 text-center md:text-right">
            © 2025 TimeSync. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
