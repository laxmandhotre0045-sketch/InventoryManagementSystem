import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Sends every navigation to the top of the page.
 *
 * A single-page app keeps the same document across route changes, so the window
 * scroll offset survives — open Components from the bottom of Equipment and it
 * opens scrolled to the bottom.
 *
 * Back/forward navigations are left alone: restoring the previous position is the
 * behaviour people expect there, and the browser handles it.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    // 'instant' — an animated scroll during a route change reads as a glitch.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
