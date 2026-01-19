export function Footer() {
  return (
    <footer className="bg-muted py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <img
            src="https://dev-uploads.launch10.ai/uploads/21b36cfc-f657-471f-8256-d36bea9689fc.png"
            alt="Logo"
            className="h-8"
          />
          
          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2024 All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
