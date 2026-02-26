import React from "react";
import BottomNavigation from "@/components/navigation/BottomNavigation";
import SearchBar from "@/components/navigation/SearchBar";
import ClickableLogo from "@/components/ClickableLogo";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import MobileSearchOverlay from "@/components/navigation/MobileSearchOverlay";
import NavigationProvider from "@/components/navigation/NavigationProvider";
import NavigationActions from "@/components/navigation/NavigationActions";
import links from "./links";
import { Footer } from "@/components/Footer";
import ActiveSearchBanner from "@/components/ActiveSearchBanner";
import { ClientAuthGate } from "@/components/ClientAuthGate";

const HeaderLinks = () => {
  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList>
        {links.map((link) => (
          <NavigationMenuItem key={link.href}>
            <NavigationMenuLink asChild>
              <Link
                href={link.href}
                className="group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                {link.label}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
};

interface NavigationOverlayProps {
  hide_bottom_menu?: boolean;
  show_footer?: boolean;
  main_y_scroll?: boolean;
  header_full_width?: boolean;
  children: React.ReactNode;
}

export const NavigationOverlay = async ({
  hide_bottom_menu = false,
  show_footer = true,
  main_y_scroll = true,
  header_full_width = false,
  children,
}: NavigationOverlayProps) => {
  return (
    <NavigationProvider>
      <MobileSearchOverlay />
      {/*
        Use h-dvh (dynamic viewport height) for better mobile support.
        This accounts for mobile browser chrome (address bar, etc.)
      */}
      <div className="h-dvh flex flex-col overflow-hidden">
        {/* Render the top header - sticky so it stays visible during scroll */}
        <header className="sticky top-0 flex shrink-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div
            className={`${header_full_width ? "w-full" : "container mx-auto"} flex h-16 items-center justify-between px-2`}
          >
            <div className="flex items-center space-x-4">
              <ClickableLogo />
            </div>

            <SearchBar />

            <HeaderLinks />

            {/* Desktop User Actions & Mobile Controls */}
            <NavigationActions />
          </div>
        </header>

        <ClientAuthGate>
          <ActiveSearchBanner />
        </ClientAuthGate>

        {/* Render the children components */}
        <div
          className={`flex flex-col flex-1 min-h-0 ${main_y_scroll ? "overflow-y-auto" : "overflow-hidden"}`}
        >
          <main className={main_y_scroll ? "flex-1" : "flex-1 min-h-0"}>
            {children}
          </main>
          {/* Footer: hidden on mobile when bottom navigation is shown, visible on desktop */}
          {show_footer && (
            <div className={hide_bottom_menu ? "" : "hidden md:block"}>
              <Footer />
            </div>
          )}
        </div>

        {/* Render the bottom navigation bar on mobile if the user is authenticated */}
        {!hide_bottom_menu && (
          <ClientAuthGate>
            <div className="md:hidden flex shrink-0 pb-[env(safe-area-inset-bottom)]">
              <BottomNavigation />
            </div>
          </ClientAuthGate>
        )}
      </div>
    </NavigationProvider>
  );
};

export default NavigationOverlay;
