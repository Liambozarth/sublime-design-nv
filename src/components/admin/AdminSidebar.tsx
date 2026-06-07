"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  ClipboardCheck,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  LogOut,
  Map as MapIcon,
  Menu,
  Settings,
  Share2,
  User,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/admin/_actions";
import InstallAppButton from "@/components/admin/InstallAppButton";

const NAV_GROUPS = [
  {
    label: null,
    links: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Leads",
    links: [
      { href: "/dashboard/leads", label: "Client Intakes", icon: Users },
      { href: "/admin/leads", label: "Quote Leads", icon: FileText },
    ],
  },
  {
    label: "Portfolio",
    links: [
      { href: "/admin/photos", label: "Photos", icon: ImageIcon },
      { href: "/admin/review", label: "Review", icon: ClipboardCheck },
      { href: "/admin/projects", label: "Projects", icon: FolderOpen },
      { href: "/admin/media", label: "Media Manager", icon: Film },
    ],
  },
  {
    label: "Materials",
    links: [
      { href: "/admin/materials", label: "Materials", icon: Layers },
    ],
  },
  {
    label: "Tools",
    links: [
      { href: "/admin/map", label: "Photo Map", icon: MapIcon },
      { href: "/admin/site-health", label: "Site Health", icon: Activity },
      { href: "/admin/social", label: "Social Queue", icon: Share2 },
      { href: "/admin/shooting-checklist", label: "Shooting Checklist", icon: Camera },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/profile", label: "Profile", icon: User },
    ],
  },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-ui text-sm transition-colors ${
        active
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-gray-700" : "text-gray-400"}`} />
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red px-1.5 font-ui text-[11px] font-bold text-white">
          {badge}
        </span>
      ) : active ? (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red" />
      ) : null}
    </Link>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Pending review count for the sidebar badge; refreshes on approve/reject events.
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const res = await fetch("/api/admin/review-queue?count=1");
        const data = (await res.json()) as { pendingCount?: number };
        if (active && typeof data.pendingCount === "number") setPendingCount(data.pendingCount);
      } catch {
        /* ignore */
      }
    }
    refresh();
    window.addEventListener("admin-review-updated", refresh);
    window.addEventListener("admin-assets-refresh", refresh);
    return () => {
      active = false;
      window.removeEventListener("admin-review-updated", refresh);
      window.removeEventListener("admin-assets-refresh", refresh);
    };
  }, []);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-5">
        <Link href="/admin" onClick={() => setMobileOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-dark.png"
            alt="Sublime Design NV"
            className="h-8 w-auto"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = "/images/logo-light.png";
              img.onerror = () => { img.style.display = "none"; };
            }}
          />
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? "_root"}>
              {group.label ? (
                <p className="mb-1 px-3 font-ui text-[10px] uppercase tracking-[0.16em] text-gray-400">
                  {group.label}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {group.links.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={isActive(link.href, "exact" in link ? link.exact : undefined)}
                    badge={link.href === "/admin/review" ? pendingCount : undefined}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
                {group.label === "Account" && (
                  <InstallAppButton onNavigate={() => setMobileOpen(false)} />
                )}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer with logout */}
      <div className="border-t border-gray-200 px-3 py-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-ui text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span>Log out</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800 text-white shadow-lg md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-60 bg-white shadow-2xl transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:text-gray-700"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="fixed left-0 top-0 hidden h-full w-60 flex-col border-r border-gray-200 bg-white md:flex">
        {sidebarContent}
      </div>
    </>
  );
}
