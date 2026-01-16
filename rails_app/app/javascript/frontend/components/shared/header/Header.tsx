import HeaderUser from "./HeaderUser";
import HeaderProgressStepper from "./HeaderProgressStepper";
import ImpersonationBanner from "../ImpersonationBanner";

export default function Header() {
  return (
    <>
      <ImpersonationBanner />
      <header className="bg-background py-5 sticky top-0 z-10 relative">
        {/* Logo and User at actual edges - NO max-width constraint */}
        <div className="flex justify-between items-center px-6">
          <img src="/images/launch10-logo.svg" alt="Launch10" className="h-8" />
          <HeaderUser />
        </div>
        {/* Stepper overlaid, inside max-w-7xl container to align with chat content */}
        <div className="hidden lg:block absolute inset-0 pointer-events-none">
          <div className="mx-auto container max-w-7xl px-8 pr-32 h-full grid grid-cols-[288px_1fr] gap-8 items-center">
            <div /> {/* Empty first column to match sidebar */}
            <HeaderProgressStepper className="max-w-3xl mx-auto pointer-events-auto" />
          </div>
        </div>
      </header>
    </>
  );
}
