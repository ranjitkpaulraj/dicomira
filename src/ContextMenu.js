import { useState, useEffect } from 'react';

// ContextMenu component: displays a custom right-click menu near the mouse
export default function ContextMenu({ menuItems = [], targetRef }) {
  const [contextMenu, setContextMenu] = useState(null);

  // Effect: attaches contextmenu and click listeners to target element
  useEffect(() => {
    if (!targetRef?.current) return;

    // Show context menu at mouse position
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent parent contextmenu handlers
      setContextMenu({
        mouseX: e.clientX + 2,
        mouseY: e.clientY - 6,
      });
    };

    // Hide context menu on any click
    const handleClick = () => setContextMenu(null);

    const target = targetRef.current;
    target.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);

    // Cleanup listeners on unmount or ref change
    return () => {
      target.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, [targetRef]);

  // If menu is not active, render nothing
  if (!contextMenu) return null;

  // Render menu at mouse position
  return (
    <ul
      className="context-menu"
      style={{
        top: contextMenu.mouseY,
        left: contextMenu.mouseX,
      }}
    >
      {menuItems.map((item, idx) => (
        <li
          key={idx}
          className="context-menu-item"
          onClick={() => {
            item.onClick();      // Call menu item action
            setContextMenu(null); // Hide menu after click
          }}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}