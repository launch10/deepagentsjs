import { Link } from "@inertiajs/react";
import HeaderUser from "./HeaderUser";
import ImpersonationBanner from "../ImpersonationBanner";

export default function AdminHeader() {
  return (
    <>
      <ImpersonationBanner />
      <header className="bg-background py-3 sticky top-0 z-10 border-b border-border relative">
        <div className="flex justify-between items-center px-6">
          <Link href="/">
            <img src="/images/launch10-logo.svg" alt="Launch10" className="h-8" />
          </Link>
          <HeaderUser headerClassName="absolute right-0 top-full" />
        </div>
      </header>
    </>
  );
}
