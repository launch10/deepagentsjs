import HeaderUser from "./HeaderUser";
import HeaderProgressStepper from "./HeaderProgressStepper";

export default function Header() {

  return (
    <header className="bg-background py-5 px-6 sticky top-0 z-10">
      <nav className="flex justify-between items-center">
        <img src="/images/launch10-logo.svg" alt="Launch10" className="h-8" />
        <HeaderProgressStepper className="flex-1 mx-24" />
        <HeaderUser />
      </nav>
    </header>
  );
}
