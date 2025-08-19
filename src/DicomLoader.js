import { useState, useEffect } from 'react';
import dicomParser from 'dicom-parser';
import './style.css';

// Cubic interpolation for pixel values (used for slice interpolation)
function cubicInterpolate(p0, p1, p2, p3, t) {
  return (
    p1 +
    0.5 * t * (p2 - p0 +
      t * (2 * p0 - 5 * p1 + 4 * p2 - p3 +
        t * (3 * (p1 - p2) + p3 - p0)))
  );
}

// Interpolates slices to match target thickness using cubic interpolation
function interpolateSlices(slices, targetThickness) {
  let newSlices = [];
  for (let i = 1; i < slices.length - 2; i++) {
    let current = slices[i];
    let next = slices[i + 1];
    let prev = slices[i - 1];
    let nextNext = slices[i + 2];

    // Calculate how many interpolated slices to create between current and next
    let step = Math.abs(next.imagePosition[2] - current.imagePosition[2]) / targetThickness;

    for (let j = 0; j < step; j++) {
      let factor = j / step;
      // Interpolate pixel data for each pixel index
      let interpolatedPixelData = current.pixelData.map((_, index) => {
        return cubicInterpolate(prev.pixelData[index], current.pixelData[index], next.pixelData[index],
          nextNext.pixelData[index], factor
        )
      });

      // Create new interpolated slice
      newSlices.push({
        ...current,
        sliceThickness: targetThickness,
        pixelData: interpolatedPixelData,
        imagePosition: [
          current.imagePosition[0],
          current.imagePosition[1],
          current.imagePosition[2] + factor * (next.imagePosition[2] - current.imagePosition[2])
        ]
      });
    }
  }
  return newSlices;
}

export default function DicomLoader({ updateCallback }) {
  const [numFiles, setNumFiles] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Callback to update parent with loaded volume data
  const volumeUpdateCallback = updateCallback;

  // Constructs a 3D volume array [z][y][x] from slices
  function constructVolume(slices) {
    let numSlices = slices.length;
    let numRows = slices[0].numRows;
    let numCols = slices[0].numCols;
    let metadata = [];
    // Initialize 3D array
    let volume = new Array(numSlices).fill(null).map(() => new Array(numRows).fill(null).map(() => new Array(numCols).fill(0)));
    for (let sliceNumber = 0; sliceNumber < numSlices; sliceNumber++) {
      let slice = slices[sliceNumber];

      // Calculate windowing parameters
      const minX = slice.windowCenter - slice.windowWidth / 2;
      const maxX = slice.windowCenter + slice.windowWidth / 2;
      const scale = (maxX - minX) / 255;

      // Fill volume with windowed pixel values
      for (let rIdx = 0, idx = 0; rIdx < numRows; rIdx++) {
        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          if (idx < slice.pixelData.length) {
            let pixelValue = slice.pixelData[idx] * slice.rescaleSlope + slice.rescaleIntercept;
            // Apply windowing
            if (pixelValue <= minX) {
              pixelValue = 0;
            } else if (pixelValue > maxX) {
              pixelValue = 255;
            } else {
              pixelValue = Math.floor((pixelValue - minX) / scale + 0.5);
            }
            volume[sliceNumber][rIdx][cIdx] = pixelValue;
            idx++;
          }
        }
      }
      // Collect metadata for each slice
      let imagePosition = slice.imagePosition;
      let imageOrientation = slice.imageOrientation;
      let sliceThickness = slice.sliceThickness;
      let pixelSpacing = slice.pixelSpacing;
      metadata.push({ sliceNumber, imagePosition, imageOrientation, sliceThickness, pixelSpacing });
    }
    return { volume, metadata };
  }

  // Reads a single DICOM file and extracts relevant metadata and pixel data
  function readDicom(byteArray) {
    const options = { TransferSyntaxUID: '1.2.840.10008.1.2' };
    let dataset = dicomParser.parseDicom(byteArray, options);
    let imagePosition = dataset.string("x00200032")?.split("\\").map(Number) || [0, 0, 0];
    let imageOrientation = dataset.string("x00200037")?.split("\\").map(Number) || [1, 0, 0, 0, 1, 0];
    let pixelSpacing = dataset.string("x00280030")?.split("\\").map(Number) || [0, 0]
    let sliceThickness = Number(dataset.string("x00180050")) || 1;
    let windowCenter = Number(dataset.floatString('x00281050')) || 0;
    let windowWidth = Number(dataset.floatString('x00281051')) || 0;
    let rescaleIntercept = Number(dataset.floatString('x00281052')) || 0;
    let rescaleSlope = Number(dataset.floatString('x00281053')) || 1;
    let pixelRepresentation = Number(dataset.string("x00280103")) || 0;
    let numRows = Number(dataset.string("x00280010")) || 512;
    let numCols = Number(dataset.string("x00280011")) || 512;

    let pixelData;

    // Read pixel data as Uint16 or Int16 depending on representation
    if (pixelRepresentation === 0) {
      pixelData = new Uint16Array(dataset.byteArray.buffer, dataset.elements.x7fe00010.dataOffset,
        dataset.elements.x7fe00010.length / 2);
    } else {
      pixelData = new Int16Array(dataset.byteArray.buffer, dataset.elements.x7fe00010.dataOffset,
        dataset.elements.x7fe00010.length / 2);
    }

    return {
      imagePosition, pixelSpacing, sliceThickness, windowCenter, windowWidth, rescaleIntercept,
      rescaleSlope, numRows, numCols, pixelData, imageOrientation
    };
  }

  // Reads all files in the selected folder and returns an array of slice objects
  async function readFiles(files) {
    const fileArray = Array.from(files);
    const slicePromises = fileArray.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            let byteArray = new Uint8Array(e.target.result);
            // Check for DICOM magic word
            let dicomStr = byteArray.slice(128, 132);
            let decoder = new TextDecoder('utf-8');
            if (decoder.decode(dicomStr) === "DICM") {
              resolve(readDicom(byteArray));
            } else {
              resolve(null); // Not a DICOM file
            }
          } catch (error) {
            console.log("Error reading file " + file.name, error);
            resolve(null); // Skip on error
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      });
    });

    const slices = await Promise.all(slicePromises);
    // Filter out nulls (non-DICOM or failed files)
    return slices.filter(Boolean);
  }

  // Handles folder selection and triggers DICOM loading/parsing
  async function handleFolderChange(files) {
    // Empty folder or user clicked cancelled.
    if (files.length === 0) return;

    setLoading(true); // Show waiting message

    let volumeData = null;
    let slices = await readFiles(files);

    setNumFiles(slices.length);

    if (slices.length > 0) {
      // Sort slices in the z direction
      slices.sort((a, b) => a.imagePosition[2] - b.imagePosition[2]);

      // Rescale slice thickness to pixel spacing
      slices = interpolateSlices(slices, slices[0].pixelSpacing[0]);

      // Construct 3D volume from slices 
      volumeData = constructVolume(slices);
    }

    // Pass volume data to parent component
    volumeUpdateCallback(volumeData);

    setLoading(false); // Hide waiting message
  }

  // Triggers file input dialog for folder selection
  function onBrowse(event) {
    document.getElementById('browseDicomDir').click();
  }

  // Handles fullscreen mode toggling
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);  

  // Loader UI with branding and folder selection
  return (
    <div className="dicom-loader-outer">
      {/* Branding section */}
      <div className="dicom-branding">
        <div className="dicom-branding-row">
          <img
            src="/logo512.png"
            alt="App Logo"
            className="dicom-logo"
          />
          <span className="dicomira-title">DICOMira</span>
        </div>
      </div>
      {/* Loader box for folder selection and status */}
      <div className="dicom-loader-box">
        <button
          type="button"
          className="dicom-browse-btn"
          onClick={onBrowse}
          title="Select a folder containing DICOM files"
        >
          <span className="dicom-browse-icon">📂</span> Browse DICOM Folder
        </button>
        <input
          id="browseDicomDir"
          directory=""
          webkitdirectory=""
          type="file"
          onChange={(e) => { handleFolderChange(e.target.files) }}
          style={{ display: 'none' }}
        />
        {loading && <div className="dicom-loader-spinner"></div>}
        <p className="dicom-files-loaded">
          {loading
            ? "Reading files, please wait..."
            : `DICOM files loaded: ${numFiles}`}
        </p>
      </div>
      {/* Fullscreen toggle button */}
      {!isFullscreen && <div className="fullscreen" title="Go Fullscreen" onClick={() => document.documentElement.requestFullscreen()}>
        <svg width="32" height="32">
          <polyline points="0,12 0,0 12,0" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
          <polyline points="20,0 32,0 32,12" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
          <polyline points="0,20 0,32 12,32" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
          <polyline points="20,32 32,32 32,20" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
        </svg>
      </div>}

      {isFullscreen && <div className="fullscreen" title="Exit Fullscreen" onClick={() => document.exitFullscreen()}>
        <svg width="32" height="32">
          <polyline points="0,12 12,12 12,0" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
          <polyline points="20,0 20,12 32,12" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
          <polyline points="0,20 12,20 12,32" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
          <polyline points="20,32 20,20 32,20" style={{ fill: 'none', stroke: '#888', strokeWidth: 5 }} />
        </svg>
      </div>}

    </div>
  );
}
