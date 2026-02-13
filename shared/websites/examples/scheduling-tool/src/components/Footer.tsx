export function Footer() {
  return (
    <footer className="bg-muted border-t border-border">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img 
                src="https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png" 
                alt="TimeSync Logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-foreground">TimeSync</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Scheduling made simple
            </p>
          </div>

          {/* Navigation Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Navigate
            </h3>
            <nav className="flex flex-col gap-3">
              <a 
                href="#problem" 
                className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm"
              >
                Problem
              </a>
              <a 
                href="#features" 
                className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm"
              >
                Features
              </a>
              <a 
                href="#social-proof" 
                className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm"
              >
                Social Proof
              </a>
            </nav>
          </div>

          {/* Empty column for spacing on larger screens */}
          <div className="hidden md:block"></div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 TimeSync. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
