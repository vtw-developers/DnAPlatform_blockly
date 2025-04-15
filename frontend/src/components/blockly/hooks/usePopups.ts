import { useState } from 'react';

export type PopupType = 'execution' | 'naturalLanguage' | 'verification' | 'conversion';

export interface UsePopupsReturn {
  isOpen: Record<PopupType, boolean>;
  openPopup: (type: PopupType) => void;
  closePopup: (type: PopupType) => void;
}

export const usePopups = (): UsePopupsReturn => {
  const [isOpen, setIsOpen] = useState<Record<PopupType, boolean>>({
    execution: false,
    naturalLanguage: false,
    verification: false,
    conversion: false
  });

  const openPopup = (type: PopupType) => {
    setIsOpen(prev => ({
      ...prev,
      [type]: true
    }));
  };

  const closePopup = (type: PopupType) => {
    setIsOpen(prev => ({
      ...prev,
      [type]: false
    }));
  };

  return {
    isOpen,
    openPopup,
    closePopup
  };
}; 