export function Footer() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Logo + Tagline */}
          <div className="flex flex-col gap-4">
            <img
              src="https://pub-c8c4c6d0ee4f11b2a7f1c233e0b8c6.r2.dev/21b36cfc-f657-471f-8256-d36bea9689fc.png"
              alt="TimeSync Logo"
              className="h-8 w-auto"
            />
            <p className="text-primary-foreground/80 text-sm">
              Streamline your scheduling and save time.
            </p>
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-lg mb-2">Navigation</h3>
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('features');
              }}
              className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 text-sm"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('pricing');
              }}
              className="text-primary-foreground/80 hover:text-primary-foreground transition-colors duration-200 text-sm"
            >
              Pricing
            </a>
          </div>

          {/* Copyright */}
          <div className="flex flex-col gap-2 md:items-end">
            <p className="text-primary-foreground/80 text-sm">
              © 2025 TimeSync. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
