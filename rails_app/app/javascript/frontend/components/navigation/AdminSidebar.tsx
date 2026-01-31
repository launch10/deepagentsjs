import { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import {
  HomeIcon,
  CpuChipIcon,
  UsersIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/admin", icon: HomeIcon },
      { label: "Models", href: "/admin/models", icon: CpuChipIcon },
    ],
  },
  {
    label: "Users & Accounts",
    items: [
      { label: "Users", href: "/admin/users", icon: UsersIcon },
      { label: "Accounts", href: "/admin/accounts", icon: BuildingOfficeIcon },
    ],
  },
  {
    label: "Payments",
    items: [
      { label: "Plans", href: "/admin/plans", icon: CreditCardIcon },
      { label: "Subscriptions", href: "/admin/pay/subscriptions", icon: CreditCardIcon },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Documents", href: "/admin/documents", icon: ChatBubbleLeftRightIcon },
      { label: "Announcements", href: "/admin/announcements", icon: DocumentTextIcon },
    ],
  },
];

export default function AdminSidebar() {
  const { url } = usePage();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") {
      return url === "/admin";
    }
    return url.startsWith(href);
  };

  return (
    <aside
      style={{ backgroundColor: "#3d1212", width: isCollapsed ? 72 : 240, minWidth: isCollapsed ? 72 : 240 }}
      className="h-screen flex flex-col transition-all duration-300 sticky top-0 shrink-0"
    >
      {/* Header with collapse button */}
      <div className={twMerge("p-4 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <span className="text-white font-semibold text-lg">Admin</span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white hover:opacity-70 transition-opacity"
        >
          {isCollapsed ? (
            <ArrowRightStartOnRectangleIcon className="w-5 h-5 rotate-180" />
          ) : (
            <ArrowLeftStartOnRectangleIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Divider */}
      <div
        className="h-px mx-1"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
      />

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-2">
            {group.label && !isCollapsed && (
              <div className="px-4 py-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={twMerge(
                    "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                    isCollapsed && "justify-center px-0 mx-1"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Divider */}
      <div
        className="h-px mx-1"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
      />

      {/* Exit admin link */}
      <div className={twMerge("p-4", isCollapsed && "flex justify-center")}>
        <a
          href="/"
          className={twMerge(
            "flex items-center gap-3 text-white/80 hover:text-white text-sm transition-colors",
            isCollapsed && "justify-center"
          )}
        >
          <ArrowLeftStartOnRectangleIcon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
          {!isCollapsed && <span>Exit Admin</span>}
        </a>
      </div>
    </aside>
  );
}
