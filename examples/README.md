# Oncoprint.js Examples

This directory contains comprehensive examples demonstrating how to use Oncoprint.js in various scenarios.

## 🚀 Quick Start

To run the examples locally:

```bash
# From the root directory
npm run examples

# Or manually from examples directory
python3 serve.py
```

Then open your browser to `http://localhost:8000`

## 📁 Available Examples

### Interactive Tools
- **`oncoprint-configurator.html`** - Full-featured interactive configurator with live controls
- **`demo.html`** - Feature demonstration and showcase

### Basic Usage
- **`basic-usage.html`** - Standard vanilla JavaScript implementation  
- **`basic-usage-simple.html`** - Minimal example with embedded sample data
- **`basic-usage-umd.html`** - UMD module usage for direct browser inclusion

### Framework Integration  
- **`react-example.tsx`** - React component and hooks implementation

## Available Examples

### 1. `basic-usage-simple.html`
- **Best for**: Quick testing and understanding the basic concepts
- **Features**: Simple oncoprint implementation with sample data
- **Requirements**: Just a web browser
- **Usage**: Open directly in browser

### 2. `basic-usage-umd.html`
- **Best for**: Using the actual library in browser environments
- **Features**: Full oncoprint.js library via UMD build
- **Requirements**: Web browser + D3.js CDN
- **Usage**: Open directly in browser

### 3. `basic-usage-fixed.html`
- **Best for**: Development with ES modules
- **Features**: Full library with ES module imports
- **Requirements**: Local web server
- **Usage**: Run `python examples/serve.py` first

### 4. `react-example.tsx`
- **Best for**: React applications
- **Features**: React components and hooks
- **Requirements**: React build environment
- **Usage**: Import into your React project

## Sample Data

The `sample-data/` directory contains:
- `sample.maf` - Example MAF file with mutations
- `metadata.tsv` - Example metadata file with clinical information

## Running Examples

### Direct Browser Access
```bash
# Navigate to the examples directory
cd examples

# Open any of these files directly:
open basic-usage-simple.html
open basic-usage-umd.html
```

### With Local Server
```bash
# From project root
python examples/serve.py

# Then open in browser:
# http://localhost:8000/examples/basic-usage-fixed.html
# http://localhost:8000/examples/basic-usage-umd.html
```

### Using npm Package
```bash
# Install the package
npm install oncoprint-js

# Use in your project
import { OncoprintVisualizer } from 'oncoprint-js';
```

## Example Features

Each example demonstrates:

### Basic Functionality
- Loading MAF data from files or sample data
- Rendering interactive oncoprints
- Gene and sample labeling
- Mutation type legends

### Interactive Features
- Click events on cells, genes, and samples
- Sorting by mutation frequency
- Sorting by mutation load
- Hover tooltips (in full examples)

### Data Export
- SVG export for publications
- PNG export for presentations
- Data export for analysis

### File Upload
- MAF file upload and parsing
- Metadata file integration
- Validation and error handling

## Common Issues and Solutions

### 1. "Can't find variable" errors
- **Cause**: ES module import issues
- **Solution**: Use the UMD version (`basic-usage-umd.html`) or run a local server

### 2. No visualization appears
- **Cause**: Data not loaded or parsing errors
- **Solution**: Check browser console for errors, ensure data format is correct

### 3. CORS errors with file loading
- **Cause**: Browser security restrictions
- **Solution**: Use the local server (`python examples/serve.py`)

### 4. D3.js not found
- **Cause**: D3.js CDN not loaded
- **Solution**: Ensure internet connection or download D3.js locally

## Data Format Requirements

### MAF File Format
```
Hugo_Symbol	Tumor_Sample_Barcode	Variant_Classification
TP53	Sample_1	Missense_Mutation
KRAS	Sample_2	Nonsense_Mutation
```

Required columns:
- `Hugo_Symbol` - Gene name
- `Tumor_Sample_Barcode` - Sample identifier
- `Variant_Classification` - Mutation type

### Metadata File Format
```
Tumor_Sample_Barcode	Cancer_Type	Stage	Age
Sample_1	LUAD	Stage II	65
Sample_2	BRCA	Stage I	52
```

Required:
- `Tumor_Sample_Barcode` - Must match MAF sample IDs
- Additional columns for clinical data

## Integration Examples

### Vanilla JavaScript
```javascript
// Load the library
const visualizer = new Oncoprint.OncoprintVisualizer(container);

// Load data
await visualizer.loadMafData(mafData);
visualizer.render();
```

### React Component
```jsx
import { Oncoprint } from 'oncoprint-js';

function MyComponent() {
  return (
    <Oncoprint
      mafData={mafData}
      config={{ cellWidth: 10, cellHeight: 20 }}
      onCellClick={(gene, sample) => console.log(gene, sample)}
    />
  );
}
```

### React Hook
```jsx
import { useOncoprint } from 'oncoprint-js';

function MyComponent() {
  const containerRef = useRef(null);
  const { loadMafData, exportSVG } = useOncoprint({ 
    container: containerRef.current 
  });
  
  return <div ref={containerRef} />;
}
```

## Next Steps

1. Try the examples to understand the basic functionality
2. Look at the React example for component integration
3. Check the main README for complete API documentation
4. Explore the source code for advanced customization

## Troubleshooting

If you encounter issues:

1. Check the browser console for error messages
2. Ensure your data format matches the requirements
3. Try the simple example first to verify basic functionality
4. Use the local server for ES module examples
5. Check that D3.js is loaded before the oncoprint library

For more help, see the main project README or open an issue on GitHub.