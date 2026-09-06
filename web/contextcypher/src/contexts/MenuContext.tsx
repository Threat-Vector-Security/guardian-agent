import React, { createContext, useContext, useState, useCallback } from 'react';

interface MenuContextType {
  activeMenu: string | null;
  setActiveMenu: (menu: string | null) => void;
  registerMenu: (menuId: string) => void;
  unregisterMenu: (menuId: string) => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export const useMenuContext = () => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenuContext must be used within MenuProvider');
  }
  return context;
};

interface MenuProviderProps {
  children: React.ReactNode;
}

export const MenuProvider: React.FC<MenuProviderProps> = ({ children }) => {
  const [activeMenu, setActiveMenuState] = useState<string | null>(null);
  const [registeredMenus] = useState<Set<string>>(new Set());

  const setActiveMenu = useCallback((menu: string | null) => {
    setActiveMenuState(menu);
  }, []);

  const registerMenu = useCallback((menuId: string) => {
    registeredMenus.add(menuId);
  }, [registeredMenus]);

  const unregisterMenu = useCallback((menuId: string) => {
    registeredMenus.delete(menuId);
    if (activeMenu === menuId) {
      setActiveMenuState(null);
    }
  }, [registeredMenus, activeMenu]);

  const value = {
    activeMenu,
    setActiveMenu,
    registerMenu,
    unregisterMenu
  };

  return (
    <MenuContext.Provider value={value}>
      {children}
    </MenuContext.Provider>
  );
};