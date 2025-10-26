import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
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
  const user = await projectOpenDebateApiGetCurrentUserObject();

  return (
    <NavigationProvider>
      <MobileSearchOverlay />
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Render the top header */}
        <header className="flex z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

        {user.is_authenticated && <ActiveSearchBanner />}

        {/* Render the children components */}
        <div
          className={`flex flex-col flex-1 ${main_y_scroll ? "overflow-y-auto" : "overflow-hidden"}`}
        >
          <main className={main_y_scroll ? "" : "flex-1 min-h-0"}>
            {children}
          </main>
          {show_footer && <Footer />}
        </div>

        {/* Render the bottom navigation bar if the user is authenticated */}
        {user.is_authenticated && !hide_bottom_menu && (
          <div className="md:hidden flex">
            <BottomNavigation />
          </div>
        )}
      </div>
    </NavigationProvider>
  );
};

export default NavigationOverlay;
