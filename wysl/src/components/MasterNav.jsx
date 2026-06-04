import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// --- SVG Icon Components ---
const KeyIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 11.5 3 3L22 11l-3-3" />
  </svg>
);

const AssistantIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m12 3-1.9 4.8-4.8 1.9 4.8 1.9L12 16l1.9-4.8 4.8-1.9-4.8-1.9L12 3Z" />
    <path d="M5 8.5 3.5 12 5 15.5" />
    <path d="M19 8.5 17.5 12 19 15.5" />
  </svg>
);

const GearIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-2l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const MasterNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const itemRefs = useRef([]);

  const navItems = [
    { icon: KeyIcon, label: 'Passwords', path: '/dashboard/passwords' },
    { icon: AssistantIcon, label: 'PhoneHelper', path: '/dashboard/phone-helper' },
    { icon: GearIcon, label: 'Settings', path: '/dashboard/settings' },
  ];

  useEffect(() => {
    const activeIndex = navItems.findIndex(item => location.pathname.startsWith(item.path));
    if (activeIndex !== -1 && itemRefs.current[activeIndex]) {
      const activeItem = itemRefs.current[activeIndex];
      setIndicatorStyle({
        left: activeItem.offsetLeft,
        width: activeItem.clientWidth,
      });
    }
  }, [location.pathname, navItems]);

  const handleNavigation = (path, index) => {
    console.log('Navigating to:', path);
    navigate(path);
  };

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[70%] max-w-[280px] p-1 bg-white rounded-xl shadow-lg z-50 lg:hidden">
      <motion.div
        className="absolute bottom-0 h-0.5 bg-black rounded-full"
        animate={indicatorStyle}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      />
      
      <div className="flex justify-around items-center h-full">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);

          return (
            <div
              key={item.label}
              ref={(el) => (itemRefs.current[index] = el)}
              onClick={() => handleNavigation(item.path, index)}
              className="relative z-10 p-1.5 cursor-pointer flex flex-col items-center justify-center flex-grow"
            >
              <Icon
                className={`w-4 h-4 transition-all duration-300 ease-in-out 
                            ${isActive ? 'text-black scale-110' : 'text-gray-400 scale-100'}
                            hover:scale-110 hover:text-black`}
              />
              <span className={`text-[0.6rem] mt-0.5 font-medium transition-colors duration-300 
                                ${isActive ? 'text-black' : 'text-gray-500'}
                                group-hover:text-black`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default MasterNav;
