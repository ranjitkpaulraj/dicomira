import { useState, useEffect, useRef } from 'react';

import ContextMenu from './ContextMenu';
import SliceInfoPopup from './SliceInfoPopup';

import './style.css';

// Calculates real-world coordinates of a voxel given DICOM metadata and voxel index
function calculateVoxelCoordinates(imagePosition, imageOrientation, pixelSpacing, sliceThickness, voxelIndex) {
  const [P0x, P0y, P0z] = imagePosition; // Image Position (Patient)
  const [Drx, Dry, Drz, Dcx, Dcy, Dcz] = imageOrientation; // Image Orientation (Patient)
  const [Sr, Sc] = pixelSpacing; // Pixel Spacing
  const Ss = sliceThickness; // Slice Thickness or Spacing Between Slices
  const [r, c, s] = voxelIndex; // Voxel indices (row, column, slice)

  // Compute slice direction using cross-product
  const Ds = [
    Dry * Dcz - Drz * Dcy,
    Drz * Dcx - Drx * Dcz,
    Drx * Dcy - Dry * Dcx
  ];

  // Calculate voxel coordinates
  const Px = P0x + (r * Sr * Drx) + (c * Sc * Dcx) + (s * Ss * Ds[0]);
  const Py = P0y + (r * Sr * Dry) + (c * Sc * Dcy) + (s * Ss * Ds[1]);
  const Pz = P0z + (r * Sr * Drz) + (c * Sc * Dcz) + (s * Ss * Ds[2]);

  return [Px, Py, Pz];
}

// Draws a grayscale image from a 2D array onto a canvas
function dispImage(canvas, data) {
  if (!canvas) return;

  const numRows = data.length;
  const numCols = data[0].length;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  canvas.width = numCols;
  canvas.height = numRows;

  var imageData = ctx.getImageData(0, 0, numCols, numRows);
  for (let rowIdx = 0, idx = 0; rowIdx < numRows; rowIdx++) {
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      imageData.data[4 * idx] = data[rowIdx][colIdx];
      imageData.data[4 * idx + 1] = data[rowIdx][colIdx];
      imageData.data[4 * idx + 2] = data[rowIdx][colIdx];
      imageData.data[4 * idx + 3] = 255;
      idx++;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// Main slice viewer component for displaying DICOM slices in different planes
export default function SliceViewer({ volumeData, mode, updateSliceNum, sliceIds }) {
  const viewerRef = useRef(null);
  const callbackUpdateSliceId = updateSliceNum;
  const [sliceIndex, setSliceIndex] = useState(null); // Current slice index for this view
  const [position, setPosition] = useState([0, 0, 0]); // Real-world coordinates of cursor
  const [showInfo, setShowInfo] = useState(false); // Show slice info popup
  const sliceCanvasRef = useRef(null); // Canvas for slice image
  const markersRef = useRef(null); // Canvas for crosshair markers
  const sliceIndexRef = useRef(sliceIndex); // Ref to keep sliceIndex in event handlers

  // Context menu items
  const menuItems = [
    { label: 'Slice Info', onClick: () => setShowInfo(true) }
  ];

  // Get metadata for current slice
  const currentSliceMeta = (volumeData && volumeData.metadata && sliceIndex !== null)
    ? volumeData.metadata[sliceIndex]
    : null;  

  // Updates cursor position in real-world coordinates based on mouse event
  function updateCursonPosition(event) {
    if (!volumeData || !volumeData.volume || !volumeData.metadata) return;
    const sliceNo = sliceIndexRef.current;
    const canvas = sliceCanvasRef.current;
    const bb = canvas.getBoundingClientRect();

    let mouseX = 0, mouseY = 0;
    if (event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
    }
    // Convert mouse position to canvas pixel coordinates
    const canvasX = Math.max(0, Math.min(canvas.width - 1, Math.floor((mouseX - bb.left) / bb.width * canvas.width)));
    const canvasY = Math.max(0, Math.min(canvas.height - 1, Math.floor((mouseY - bb.top) / bb.height * canvas.height)));

    let row, col, slice;
    const numSlices = volumeData.volume.length;

    // Map canvas coordinates to volume indices based on view mode
    if (mode === "axial") {
      row = canvasX;
      col = canvasY;
      slice = sliceNo;
    } else if (mode === "sagittal") {
      row = sliceNo;
      col = canvasX;
      slice = Math.max(0, Math.min(numSlices - 1, numSlices - 1 - canvasY));
    } else if (mode === "coronal") {
      row = canvasX;
      col = sliceNo;
      slice = Math.max(0, Math.min(numSlices - 1, numSlices - 1 - canvasY));
    }

    const metadata = volumeData.metadata[slice];
    if (!metadata) return null;

    // Calculate real-world coordinates for the voxel under cursor
    const pix_position = calculateVoxelCoordinates(
      metadata.imagePosition,
      metadata.imageOrientation,
      metadata.pixelSpacing,
      0, // sliceThickness, Z values are already in real world co-ordinates
      [row, col, slice]
    );
    setPosition(pix_position);
  }

  // Draws a horizontal marker line on the overlay canvas
  function drawHorizontalLine(lineY, color = 'red') {
    const overlay = markersRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, lineY + 0.5); // +0.5 for crisp 1px line
    ctx.lineTo(overlay.width, lineY + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // Draws a vertical marker line on the overlay canvas
  function drawVerticalLine(lineX, color = 'blue') {
    const overlay = markersRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lineX + 0.5, 0); // +0.5 for crisp 1px line
    ctx.lineTo(lineX + 0.5, overlay.height);
    ctx.stroke();
    ctx.restore();
  }

  // Draws crosshair markers for slice navigation
  function drawSliceMarkers() {
    const overlay = markersRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw markers based on mode and slice indices
    if (mode === "axial") {
      drawHorizontalLine(sliceIds.coronal, 'green');
      drawVerticalLine(sliceIds.sagittal, 'blue');
    } else if (mode === "sagittal") {
      drawHorizontalLine(sliceIds.axial, 'red');
      drawVerticalLine(sliceIds.coronal, 'green');
    } else if (mode === "coronal") {
      drawHorizontalLine(sliceIds.axial, 'red');
      drawVerticalLine(sliceIds.sagittal, 'blue');
    }
  }

  // Redraw markers when sliceIds change
  useEffect(() => {
    drawSliceMarkers();
  }, [sliceIds]);

  // Set initial slice index based on mode when volume data changes
  useEffect(() => {
    if (!volumeData || !volumeData.volume || !volumeData.metadata) return;
    let initial;
    if (mode === "axial") {
      initial = Math.floor(volumeData.volume.length / 2);
    } else if (mode === "sagittal") {
      initial = Math.floor(volumeData.volume[0][0].length / 2);
    } else if (mode === "coronal") {
      initial = Math.floor(volumeData.volume[0].length / 2);
    }
    setSliceIndex(initial);
    callbackUpdateSliceId({ [mode]: initial });
  }, [volumeData]);

  // Handles mouse wheel for slice navigation and mouse move for cursor position
  useEffect(() => {
    if (!volumeData || !volumeData.volume || !volumeData.metadata) return;

    const canvas = sliceCanvasRef.current;

    const handleWheel = (event) => {
      event.preventDefault();
      const current = sliceIndexRef.current;
      let maxIndex;
      if (mode === "axial") {
        maxIndex = volumeData.volume.length - 1;
      } else if (mode === "sagittal") {
        maxIndex = volumeData.volume[0][0].length - 1;
      } else if (mode === "coronal") {
        maxIndex = volumeData.volume[0].length - 1;
      }
      let si = event.deltaY > 0 ? Math.min(current + 1, maxIndex) : Math.max(current - 1, 0);
      setSliceIndex(si);
      updateCursonPosition(event);
      let marker_pos = mode === "axial" ? maxIndex - si : si;
      callbackUpdateSliceId({ [mode]: marker_pos });
    };

    const handleMouseMove = (event) => {
      updateCursonPosition(event);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousemove', handleMouseMove, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel, { passive: false });
      canvas.removeEventListener('mousemove', handleMouseMove, { passive: false });
    };
  }, [volumeData]);

  // Draws the current slice image when sliceIndex changes
  useEffect(() => {
    if (!volumeData || !volumeData.volume || !volumeData.metadata) return;
    if (sliceIndex !== null) {
      sliceIndexRef.current = sliceIndex;
      let slice;
      if (mode === "axial") {
        // [slice][row][col]
        slice = volumeData.volume[sliceIndex];
      } else if (mode === "sagittal") {
        // [col][row][sliceIndex] -> [row][col]
        let numCols = volumeData.volume.length;
        let numRows = volumeData.volume[0].length;
        slice = new Array(numCols).fill(null).map(() => new Array(numRows).fill(0));
        for (let rIdx = 0; rIdx < numRows; rIdx++) {
          for (let colIdx = 0; colIdx < numCols; colIdx++) {
            slice[numCols - 1 - colIdx][rIdx] = volumeData.volume[colIdx][rIdx][sliceIndex];
          }
        }
      } else if (mode === "coronal") {
        // [col][sliceIndex][row] -> [col][row]
        let numCols = volumeData.volume.length;
        let numRows = volumeData.volume[0][0].length;
        slice = new Array(numCols).fill(null).map(() => new Array(numRows).fill(0));
        for (let rIdx = 0; rIdx < numRows; rIdx++) {
          for (let colIdx = 0; colIdx < numCols; colIdx++) {
            slice[numCols - 1 - colIdx][rIdx] = volumeData.volume[colIdx][sliceIndex][rIdx];
          }
        }
      }
      const canvas = sliceCanvasRef.current;
      dispImage(canvas, slice);

      const overlay = markersRef.current;
      if (overlay) {
        overlay.width = canvas.width;
        overlay.height = canvas.height;

        // --- Redraw the line after resizing overlay ---
        drawSliceMarkers();
      }

      updateCursonPosition(null);
    }
  }, [sliceIndex]);

  // Render viewer UI: context menu, coordinates, slice canvas, markers, info popup
  return (
    <div ref={viewerRef}>
      <ContextMenu menuItems={menuItems} targetRef={viewerRef}/>
      <div className="coordinates">
        <CursorCoordinates cursorPosition={position} />
      </div>
      <canvas ref={sliceCanvasRef} className="sliceCanvas"></canvas>
      <canvas ref={markersRef} className="markers" />
      <SliceInfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        numSlices={volumeData.volume.length}
        metadata={currentSliceMeta}
        viewName={mode}
      />
    </div>
  );
}

// Displays cursor coordinates in real-world space
function CursorCoordinates({ cursorPosition }) {
  const [coords, setCoords] = useState([0, 0, 0]);

  useEffect(() => {
    if (cursorPosition) {
      setCoords([cursorPosition[0].toFixed(1), cursorPosition[1].toFixed(1), cursorPosition[2].toFixed(1)]);
    }
  }, [cursorPosition]);

  return (
    <div>
      <div>X: {coords[0]}</div>
      <div>Y: {coords[1]}</div>
      <div>Z: {coords[2]}</div>
    </div>
  );
}

