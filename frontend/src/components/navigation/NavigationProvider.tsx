"use client";

import React, { createContext, useState, useContext } from "react";

type NavigationContextType = {
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (isMobileMenuOpen: boolean) => void;
  isMobileSearchOpen: boolean;
  setMobileSearchOpen: (isMobileSearchOpen: boolean) => void;
};

const NavigationContext = createContext<NavigationContextType | null>(null);

const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize state values
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Context value to be provided
  const value: NavigationContextType = {
    isMobileMenuOpen,
    setMobileMenuOpen,
    isMobileSearchOpen,
    setMobileSearchOpen,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === null) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
};

export default NavigationProvider;
