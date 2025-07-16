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

export const NavigationOverlay = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const user = await projectOpenDebateApiGetCurrentUserObject();

  return (
    <NavigationProvider>
      <MobileSearchOverlay />

      {/* Render the top header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <ClickableLogo />
          </div>

          <SearchBar />

          <HeaderLinks />

          {/* Desktop User Actions & Mobile Controls */}
          <NavigationActions />
        </div>
      </header>

      {/* Render the children components */}
      {children}

      {/* Render the bottom navigation bar if the user is authenticated */}
      {user.is_authenticated && (
        <>
          <BottomNavigation />
          {/* Add bottom padding to main content when bottom nav is visible */}
          <div className="md:hidden h-16" />
        </>
      )}
    </NavigationProvider>
  );
};

export default NavigationOverlay;
