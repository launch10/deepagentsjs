export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="Launch10" 
              className="h-8"
            />
          </div>

          {/* Navigation Links */}
          <nav className="flex gap-6">
            <a 
              href="#features" 
              className="text-sm hover:opacity-80 transition-opacity duration-200"
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              className="text-sm hover:opacity-80 transition-opacity duration-200"
            >
              How It Works
            </a>
          </nav>

          {/* Copyright */}
          <div className="text-sm opacity-90">
            © 2025 Launch10. Built for distributed teams.
          </div>
        </div>
      </div>
    </footer>
  );
}
