"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log activity" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/pipeline", label: "Team pipeline" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav>
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={"nav-link" + (active ? " active" : "")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
