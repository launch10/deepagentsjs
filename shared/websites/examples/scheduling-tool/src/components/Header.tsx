import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm border-b border-primary-foreground/10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <img 
              src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png" 
              alt="TimeSync"
              className="h-8 md:h-10 w-auto transition-transform duration-200 group-hover:scale-105"
            />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a 
              href="#how-it-works" 
              className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 font-medium"
            >
              How It Works
            </a>
            <a 
              href="#features" 
              className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 font-medium"
            >
              Features
            </a>
            <a 
              href="#social-proof" 
              className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 font-medium"
            >
              Testimonials
            </a>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <a 
              href="#cta" 
              className="inline-flex items-center px-6 py-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              Get Started Free
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-primary-foreground hover:bg-primary-foreground/10 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-primary-foreground/10">
            <nav className="flex flex-col gap-4">
              <a 
                href="#how-it-works" 
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              <a 
                href="#features" 
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#social-proof" 
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Testimonials
              </a>
              <a 
                href="#cta" 
                className="inline-flex items-center justify-center px-6 py-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg transition-all duration-200 mt-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started Free
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
