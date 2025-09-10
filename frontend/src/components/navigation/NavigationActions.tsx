"use client";

import { Button } from "@/components/ui/button";
import {
  Bell,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import React from "react";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useAuth } from "@/providers/authProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UnreadNotifBadgeCount from "@/components/navigation/UnreadNotifBadgeCount";
import UnreadMessagesBadgeCount from "@/components/navigation/UnreadMessagesBadgeCount";
import UserAvatar from "@/components/UserAvatar";
import links from "./links";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const NavigationActions = () => {
  const { setMobileSearchOpen, isMobileMenuOpen, setMobileMenuOpen } =
    useNavigation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout.mutateAsync({ client: "browser" });
  };

  if (!user) return null; // dont show anything while loading user object

  return (
    <div className="flex items-center space-x-2">
      {/* Mobile Search Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileSearchOpen(true)}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Search</span>
      </Button>

      {user.is_authenticated ? (
        <div className="hidden md:flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/notifications">
              <Bell className="h-5 w-5" />
              <UnreadNotifBadgeCount />
              <span className="sr-only">Notifications</span>
            </Link>
          </Button>

          {/* Messages */}
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/chat/">
              <MessageCircle className="h-5 w-5" />
              <UnreadMessagesBadgeCount />
              <span className="sr-only">Messages</span>
            </Link>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <UserAvatar user={user} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.username}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={`/u/${encodeURIComponent(user.username)}`}
                  className="flex items-center"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/settings/" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="hidden md:flex items-center space-x-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      )}

      {/* Mobile Menu Toggle */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] p-4">
          <VisuallyHidden>
            <SheetHeader>
              <SheetTitle>Navigation Menu</SheetTitle>
              <SheetDescription>
                Access your account, settings, related pages, and more.
              </SheetDescription>
            </SheetHeader>
          </VisuallyHidden>
          <div className="flex flex-col space-y-4 mt-4">
            {/* Show user info if authenticated */}
            {user.is_authenticated && (
              <div className="flex items-center space-x-3 pb-4 border-b">
                <UserAvatar user={user} size="large" />
                <div>
                  <p className="font-medium">{user.username}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            )}

            {/* Navigation Links */}
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center space-x-2 text-lg font-medium hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <link.icon className="h-5 w-5" />
                <span>{link.label}</span>
              </Link>
            ))}

            {user.is_authenticated ? (
              <div className="border-t pt-4 space-y-2">
                <Link
                  href="/notifications"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5" />
                    <span>Notifications</span>
                  </div>
                  <UnreadNotifBadgeCount simpleSecondary={true} />
                </Link>
                <Link
                  href="/chat/"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="h-5 w-5" />
                    <span>Messages</span>
                  </div>
                  <UnreadMessagesBadgeCount simpleSecondary={true} />
                </Link>
                <Link
                  href={`/u/${encodeURIComponent(user.username)}`}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-5 w-5" />
                  <span>Profile</span>
                </Link>
                <Link
                  href="/account/settings/"
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings className="h-5 w-5" />
                  <span>Settings</span>
                </Link>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>
            ) : (
              <div className="border-t pt-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  asChild
                >
                  <Link href="/login">Login</Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default NavigationActions;
