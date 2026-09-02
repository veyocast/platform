"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { ChevronDown, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const productLinks = [
  { description: "Het volledige systeem van content tot scherm.", href: "/product", label: "Platform" },
  { description: "De rustige beheeromgeving voor jouw team.", href: "/publisher", label: "Publisher" },
  { description: "Media, playlists, planning en monitoring.", href: "/functies", label: "Alle functies" },
  { description: "Betrouwbare lokale playback.", href: "/functies/offline-afspelen", label: "Offline afspelen" }
] as const;

const clubLinks = [
  { description: "Wedstrijden, clubnieuws, sponsors en kantine.", href: "/clubtv", label: "ClubTV" },
  { description: "Voor voetbal, hockey, tennis, padel en meer.", href: "/oplossingen/sportverenigingen", label: "Sportverenigingen" },
  { description: "Menu, acties en locatie-informatie.", href: "/oplossingen/horeca-en-kantines", label: "Horeca & kantines" },
  { description: "Interne communicatie op de werkvloer.", href: "/oplossingen/bedrijven", label: "Bedrijven" }
] as const;

const inspirationLinks = [
  { description: "Praktische uitleg over ClubTV en narrowcasting.", href: "/kennisbank", label: "Kennisbank" },
  { description: "Veelgestelde vragen met heldere antwoorden.", href: "/veelgestelde-vragen", label: "Veelgestelde vragen" },
  { description: "Bekijk de beschikbare databronnen en koppelingen.", href: "/integraties", label: "Integraties" },
  { description: "Lees wie VeyoCast bouwt en waarom.", href: "/over-ons", label: "Over ons" }
] as const;

type MarketingHeaderProps = {
  controlOrigin: string;
};

function MenuPanel({
  links
}: {
  links: readonly { description: string; href: string; label: string }[];
}) {
  return (
    <ul className="nav-menu-panel">
      {links.map((link) => (
        <li key={link.href}>
          <NavigationMenu.Link asChild>
            <Link href={link.href}>
              <strong>{link.label}</strong>
              <span>{link.description}</span>
            </Link>
          </NavigationMenu.Link>
        </li>
      ))}
    </ul>
  );
}

export function MarketingHeader({ controlOrigin }: MarketingHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isCurrent = (href: string) => (
    href === "/" ? pathname === "/" : pathname.startsWith(href)
  );

  return (
    <header className="marketing-header">
      <div className="marketing-container marketing-header__inner">
        <Link aria-label="VeyoCast homepage" className="marketing-header__logo" href="/">
          <Image
            alt="VeyoCast"
            height={30}
            priority
            src="/brand/veyocast-logo-inverse.svg"
            width={119}
          />
        </Link>

        <NavigationMenu.Root
          aria-label="Hoofdnavigatie"
          className="desktop-navigation"
          delayDuration={120}
        >
          <NavigationMenu.List className="desktop-navigation__list">
            <NavigationMenu.Item>
              <NavigationMenu.Trigger className="desktop-navigation__trigger">
                Product <ChevronDown aria-hidden size={14} />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <MenuPanel links={productLinks} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger className="desktop-navigation__trigger">
                Voor clubs <ChevronDown aria-hidden size={14} />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <MenuPanel links={clubLinks} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger className="desktop-navigation__trigger">
                Inspiratie <ChevronDown aria-hidden size={14} />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <MenuPanel links={inspirationLinks} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            {[
              { href: "/prijzen", label: "Prijzen" },
              { href: "/support", label: "Support" }
            ].map((link) => (
              <NavigationMenu.Item key={link.href}>
                <NavigationMenu.Link asChild active={isCurrent(link.href)}>
                  <Link href={link.href}>{link.label}</Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ))}
            <NavigationMenu.Indicator />
          </NavigationMenu.List>
          <NavigationMenu.Viewport className="desktop-navigation__viewport" />
        </NavigationMenu.Root>

        <div className="marketing-header__actions">
          <a className="header-login" href={controlOrigin}>
            Inloggen
          </a>
          <Link className="button button--primary button--header" href="/demo">
            Plan een demo
          </Link>

          <Dialog.Root onOpenChange={setMobileOpen} open={mobileOpen}>
            <Dialog.Trigger asChild>
              <button aria-label="Menu openen" className="mobile-menu-trigger" type="button">
                <Menu aria-hidden size={22} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="mobile-menu-overlay" />
              <Dialog.Content aria-describedby={undefined} className="mobile-menu-sheet">
                <div className="mobile-menu-sheet__header">
                  <Dialog.Title>Menu</Dialog.Title>
                  <Dialog.Close asChild>
                    <button aria-label="Menu sluiten" className="mobile-menu-trigger" type="button">
                      <X aria-hidden size={22} />
                    </button>
                  </Dialog.Close>
                </div>
                <nav aria-label="Mobiele hoofdnavigatie">
                  <p>Product</p>
                  {productLinks.map((link) => (
                    <Link href={link.href} key={link.href} onClick={() => setMobileOpen(false)}>
                      {link.label}
                    </Link>
                  ))}
                  <p>Voor clubs</p>
                  {clubLinks.map((link) => (
                    <Link href={link.href} key={link.href} onClick={() => setMobileOpen(false)}>
                      {link.label}
                    </Link>
                  ))}
                  <p>Inspiratie</p>
                  {inspirationLinks.map((link) => (
                    <Link href={link.href} key={link.href} onClick={() => setMobileOpen(false)}>
                      {link.label}
                    </Link>
                  ))}
                  {[
                    { href: "/prijzen", label: "Prijzen" },
                    { href: "/support", label: "Support" }
                  ].map((link) => (
                    <Link href={link.href} key={link.href} onClick={() => setMobileOpen(false)}>
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="mobile-menu-sheet__actions">
                  <a className="button button--secondary button--full" href={controlOrigin}>
                    Inloggen
                  </a>
                  <Link
                    className="button button--primary button--full"
                    href="/demo"
                    onClick={() => setMobileOpen(false)}
                  >
                    Plan een demo
                  </Link>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
