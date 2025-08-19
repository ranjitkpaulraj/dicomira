# DICOMira

DICOMira is a modern web-based DICOM viewer built with React. It supports loading DICOM files, viewing slices in axial, sagittal, and coronal planes, and interactive 3D volume visualization.

## Features

- 📂 **DICOM Folder Loader:** Load a folder of DICOM files directly in your browser.
- 🖼️ **Slice Viewer:** View axial, sagittal, and coronal slices with interactive controls.
- 🧊 **3D Volume Rendering:** Visualize the entire volume in 3D (To be done).
- 🎨 **Modern UI:** Stylish, dark-themed interface with branding and quadrant layout.

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- npm

### Installation

Clone the repository and install dependencies:

```sh
git clone https://github.com/ranjitkpaulraj/dicomira.git
cd dicomira
npm install
```

### Running the App

Start the development server:

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```sh
npm run build
```

## Usage

1. Click **Browse DICOM Folder** and select a folder containing DICOM files.
2. View slices in three orthogonal planes.
3. Explore the 3D volume rendering in the right panel.

## Project Structure

```
src/
  ├── App.js              # Main layout and quadrant logic
  ├── DicomLoader.js      # DICOM file loader and parser
  ├── SliceViewer.js      # 2D slice viewer component
  ├── Volume3DViewer.js   # 3D volume rendering (To be done)
  ├── style.css           # Main styles
  └── ...other components
public/
  ├── logo512.png         # Branding logo
  └── index.html
```

## Technologies

- **React** – UI framework
- **vtk.js** – 3D volume rendering
- **dicom-parser** – DICOM parsing
- **CSS Flexbox & Grid** – Responsive layout

## License

This project is licensed under the BSD 3-Clause License.

## Acknowledgements

- [dicom-parser](https://github.com/cornerstonejs/dicom-parser) for DICOM parsing

---

**DICOMira** – Fast, beautiful, and open-source DICOM viewing in your browser.
