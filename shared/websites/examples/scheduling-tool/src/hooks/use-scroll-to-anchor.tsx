import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useScrollToAnchor = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const scrollToElement = () => {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Check if DOM is already loaded
    if (document.readyState === 'complete') {
      scrollToElement();
    } else {
      // Wait for DOM to load
      window.addEventListener('load', scrollToElement);
      return () => window.removeEventListener('load', scrollToElement);
    }
  }, [location]);
};