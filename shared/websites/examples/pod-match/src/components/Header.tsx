import { useState } from "react";
import { Menu, X } from "lucide-react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b-4 border-primary bg-background shadow-lg">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-24 items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center transition-transform hover:scale-105 duration-200">
            <img
              src="https://dev-uploads.launch10.ai/uploads/3f17f0ea-ab81-435d-8295-10cc3f3d48c6.jpg"
              alt="Friend of the Pod"
              className="h-16 md:h-20 w-auto drop-shadow-md"
            />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-base font-body font-semibold text-foreground/80 transition-all hover:text-primary hover:translate-y-[-2px] duration-200"
            >
              How It Works
            </a>
            <a
              href="#signup"
              className="inline-flex items-center justify-center bg-secondary text-secondary-foreground px-8 py-3 text-base font-bold font-body uppercase tracking-wide transition-all hover:scale-105 hover:shadow-xl hover:rotate-[-1deg] duration-200 border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              Sign Up
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 text-foreground hover:bg-secondary transition-colors border-2 border-foreground"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-7 w-7" />
            ) : (
              <Menu className="h-7 w-7" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t-2 border-foreground py-6 animate-in slide-in-from-top-2 bg-muted">
            <nav className="flex flex-col gap-4">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-body font-semibold text-foreground hover:text-primary transition-colors py-3 px-2"
              >
                How It Works
              </a>
              <a
                href="#signup"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center bg-secondary text-secondary-foreground px-8 py-3 text-base font-bold font-body uppercase tracking-wide border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Sign Up
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
