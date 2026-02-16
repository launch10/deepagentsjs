export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="Launch10 Logo" 
              className="h-8 w-auto"
            />
            <p className="text-sm text-primary-foreground/80 max-w-xs">
              Effortless scheduling for distributed teams
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              <li>
                <a 
                  href="#how-it-works" 
                  className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a 
                  href="#features" 
                  className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200"
                >
                  Features
                </a>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-3">
              <li>
                <a 
                  href="#social-proof" 
                  className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200"
                >
                  Social Proof
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/20">
          <p className="text-sm text-primary-foreground/60 text-center">
            © 2025 Launch10. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
