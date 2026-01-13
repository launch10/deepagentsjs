import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted py-12 md:py-16">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo and tagline */}
          <div className="flex items-center gap-3">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="Logo" 
              className="h-10 w-auto"
            />
            <div>
              <p className="text-sm text-muted-foreground">
                Scheduling made simple for distributed teams
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <a 
              href="#features" 
              className="text-muted-foreground hover:text-[#264653] transition-colors"
            >
              Features
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-[#264653] transition-colors"
            >
              Privacy
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-[#264653] transition-colors"
            >
              Terms
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-[#264653] transition-colors"
            >
              Contact
            </a>
          </div>

          {/* Copyright */}
          <div className="text-sm text-muted-foreground">
            © {currentYear} All rights reserved
          </div>
        </div>
      </div>
    </footer>
  );
}
