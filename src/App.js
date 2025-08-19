import { useState, useEffect, useRef } from 'react';
import DicomLoader from './DicomLoader.js';
import SliceViewer from './SliceViewer.js';
import ContextMenu from './ContextMenu.js';
import Volume3DViewer from './Volume3DViewer.js';

import './style.css';

export default function App() {
  const contextRef = useRef(null);
  const [dicomData, setDicomData] = useState(null);
  const [sliceIds, setSliceIds] = useState({ axial: 0, sagittal: 0, coronal: 0 });

  function updateData(new_data) {
    setDicomData(new_data);
  }

  function updateSliceIds(newVal) {
    setSliceIds(prev => ({ ...prev, ...newVal }));
  }

  return (
    <div ref={contextRef} className="app-main-center">
      <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
            <div className="quadrants quadrant-topleft" style={{ borderStyle: 'groove' }}>
              <DicomLoader updateCallback={updateData} />
            </div>
            <div className="quadrants" style={{ borderColor: 'red', backgroundColor: 'black' }}>
              {dicomData && <SliceViewer volumeData={dicomData} mode="axial" updateSliceNum={updateSliceIds} sliceIds={sliceIds} />}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
            <div className="quadrants" style={{ borderColor: 'blue', backgroundColor: 'black' }}>
              {dicomData && <SliceViewer volumeData={dicomData} mode="sagittal" updateSliceNum={updateSliceIds} sliceIds={sliceIds} />}
            </div>
            <div className="quadrants" style={{ borderColor: 'green', backgroundColor: 'black' }}>
              {dicomData && <SliceViewer volumeData={dicomData} mode="coronal" updateSliceNum={updateSliceIds} sliceIds={sliceIds} />}
            </div>
          </div>

        </div>

        <div>
          {dicomData && <Volume3DViewer volumeData={dicomData} />}
        </div>
      </div>
    </div>
  );
}

