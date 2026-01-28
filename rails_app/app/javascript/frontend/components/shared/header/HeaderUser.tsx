import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CircleUserIcon, SettingsIcon, LogOutIcon, ChevronDownIcon } from "lucide-react";
import { usePage, router } from "@inertiajs/react";
import { twMerge } from "tailwind-merge";

interface PageProps {
  current_user?: {
    id: number;
    name: string;
    email: string;
  };
}

function formatUserName(user: PageProps["current_user"]): string {
  if (!user) return "";
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }
  return user.email.split("@")[0];
}

interface HeaderUserProps {
  className?: string;
  /** Class applied to the pull-down panel, positioned within the header */
  headerClassName?: string;
}

export default function HeaderUser({ className, headerClassName }: HeaderUserProps) {
  const { current_user } = usePage<{ props: PageProps }>().props as PageProps;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!current_user) return null;

  // Find the closest <header> to portal the panel into
  const header = buttonRef.current?.closest("header");

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={twMerge(
          "flex items-center gap-1.5 bg-background pl-4 py-1.5 text-sm text-[#74767A] transition-colors hover:text-[#2E3238] cursor-pointer outline-hidden relative z-20",
          className
        )}
      >
        <CircleUserIcon className="h-5 w-5" />
        {formatUserName(current_user)}
        <ChevronDownIcon
          className={twMerge(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Panel anchored to header's bottom edge */}
      {header && createPortal(
        <div
          ref={containerRef}
          className={twMerge(
            "z-20 w-[180px] overflow-hidden transition-all duration-200 ease-out",
            open ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
            headerClassName
          )}
        >
          <div className="rounded-bl-xl border-l border-b border-base-200 bg-background px-1.5 pb-1.5 pt-2 font-['Plus_Jakarta_Sans',sans-serif]">
            <button
              onClick={() => { setOpen(false); router.visit("/settings"); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm text-[#2E3238] transition-colors hover:bg-[#F0EFEE] cursor-pointer text-left"
            >
              <SettingsIcon className="h-4 w-4 text-[#74767A]" />
              Settings
            </button>
            <button
              onClick={() => {
                setOpen(false);
                // Full page navigation — sign_out redirects to a non-Inertia page
                const form = document.createElement("form");
                form.method = "POST";
                form.action = "/users/sign_out";
                const methodInput = document.createElement("input");
                methodInput.type = "hidden";
                methodInput.name = "_method";
                methodInput.value = "delete";
                form.appendChild(methodInput);
                const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
                if (csrfToken) {
                  const csrfInput = document.createElement("input");
                  csrfInput.type = "hidden";
                  csrfInput.name = "authenticity_token";
                  csrfInput.value = csrfToken;
                  form.appendChild(csrfInput);
                }
                document.body.appendChild(form);
                form.submit();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm text-[#2E3238] transition-colors hover:bg-[#F0EFEE] cursor-pointer text-left"
            >
              <LogOutIcon className="h-4 w-4 text-[#74767A]" />
              Log out
            </button>
          </div>
        </div>,
        header
      )}
    </>
  );
}
