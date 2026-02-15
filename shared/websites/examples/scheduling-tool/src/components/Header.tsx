export function Header() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToHero = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <img
              src="https://pub-c8c4c6d8d0ee4f11b2a7f1c233e0b8c6.r2.dev/21b36cfc-f657-471f-8256-d36bea9689fc.png"
              alt="TimeSync Logo"
              className="h-10 w-auto"
            />
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('features');
              }}
              className="text-foreground hover:text-primary transition-colors duration-200 font-medium"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('pricing');
              }}
              className="text-foreground hover:text-primary transition-colors duration-200 font-medium"
            >
              Pricing
            </a>
          </nav>

          {/* CTA Button */}
          <button
            onClick={scrollToHero}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}
