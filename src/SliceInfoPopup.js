import React, { useRef, useState } from 'react';

// SliceInfoPopup: draggable and resizable popup showing slice metadata
export default function SliceInfoPopup({ open, onClose, numSlices, metadata, viewName }) {
  const [pos, setPos] = useState({ x: 40, y: 40 });
  const [size, setSize] = useState(null); // null means "auto"
  const dragging = useRef(false);
  const resizing = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  // Hide popup if not open or no metadata
  if (!open || !metadata) return null;

  // Mouse down on header: start dragging
  function onMouseDown(e) {
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Mouse down on resize handle: start resizing
  function onResizeMouseDown(e) {
    e.stopPropagation();
    resizing.current = true;
    offset.current = { x: e.clientX, y: e.clientY };
    // If size not set, get current size from DOM
    if (!size) {
      const popup = e.target.closest('.slice-info-popup');
      startSize.current = {
        width: popup.offsetWidth,
        height: popup.offsetHeight,
      };
      setSize({
        width: popup.offsetWidth,
        height: popup.offsetHeight,
      });
    } else {
      startSize.current = { ...size };
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Mouse move: update position or size
  function onMouseMove(e) {
    if (dragging.current) {
      setPos({
        x: e.clientX - offset.current.x,
        y: e.clientY - offset.current.y,
      });
    } else if (resizing.current) {
      setSize({
        width: Math.max(220, startSize.current.width + (e.clientX - offset.current.x)),
        height: Math.max(120, startSize.current.height + (e.clientY - offset.current.y)),
      });
    }
  }

  // Mouse up: stop dragging/resizing
  function onMouseUp() {
    dragging.current = false;
    resizing.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // Prepare table rows: total slices + metadata fields
  const rows = [
    { key: 'Total Slices', value: numSlices },
    ...Object.entries(metadata).map(([key, value]) => ({
      key,
      value: Array.isArray(value)
        ? value.map(v =>
          typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v
        ).join(', ')
        : (typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value)
    }))
  ];

  // Helper: format metadata keys for display
  function formatKey(key) {
    return key
      .replace(/([A-Z])/g, ' $1')    // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
  }

  // Style: position, size, overflow
  const style = {
    left: pos.x,
    top: pos.y,
    position: 'absolute',
    overflow: 'auto',
    ...(size ? { width: size.width, height: size.height } : {})
  };

  return (
    <div
      className="slice-info-popup"
      style={style}
    >
      {/* Popup header: drag handle */}
      <div
        className="slice-info-popup-header"
        onMouseDown={onMouseDown}
      >
        <h3>
          Slice Info
          {viewName ? ` - ${viewName.charAt(0).toUpperCase() + viewName.slice(1)}` : ''}
        </h3>
      </div>
      {/* Metadata table */}
      <table className="slice-info-table">
        <tbody>
          {rows.map(({ key, value }) => (
            <tr key={key}>
              <td className="slice-info-key">{formatKey(key)}</td>
              <td className="slice-info-value">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Close button */}
      <button className="slice-info-close" onClick={onClose}>Close</button>
      {/* Resize handle */}
      <div
        className="slice-info-resize-handle"
        onMouseDown={onResizeMouseDown}
        title="Resize"
      >
        <svg width="16" height="16">
          <polyline points="0,16 16,16 16,0" style={{ fill: 'none', stroke: '#888', strokeWidth: 2 }} />
        </svg>
      </div>
    </div>
  );
}