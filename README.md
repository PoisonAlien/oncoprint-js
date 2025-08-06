# Oncoprint.js

<div align="center">

[![npm version](https://badge.fury.io/js/oncoprint-js.svg)](https://badge.fury.io/js/oncoprint-js)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/workflow/status/poisonalien/oncoprint-js/CI)](https://github.com/poisonalien/oncoprint-js/actions)

**A comprehensive JavaScript/TypeScript library for creating interactive oncoprint visualizations from MAF files and metadata.**

[Live Demo](https://poisonalien.github.io/oncoprint-js) • [Documentation](https://github.com/poisonalien/oncoprint-js/wiki) • [Examples](./examples) • [API Reference](./API_REFERENCE.md)

</div>

## Features

- **Interactive Oncoprint Visualizations** - Create publication-ready oncoprints
- **Dynamic Variant Classification** - Automatic color assignment for unknown mutation types
- **Multiple Input Formats** - Support for MAF files, TSV, CSV, and JSON
- **Customizable Styling** - Configurable colors, dimensions, and layouts
- **Metadata Integration** - Support for clinical and sample metadata tracks
- **React Components** - Ready-to-use React components and hooks
- **Export Capabilities** - Export to SVG, PNG, and data formats
- **Interactive Features** - Hover tooltips, click events, sorting, and filtering
- **Responsive Design** - Auto-resize and mobile-friendly
- **TypeScript Support** - Full type definitions included

## Installation

```bash
npm install oncoprint-js
```

For React usage, ensure you have React as a peer dependency:

```bash
npm install react react-dom
```

## Quick Start

### Vanilla JavaScript

```javascript
import { OncoprintVisualizer } from 'oncoprint-js';

// Create container element
const container = document.getElementById('oncoprint-container');

// Initialize visualizer
const visualizer = new OncoprintVisualizer(container, {
  cellWidth: 10,
  cellHeight: 20,
  geneLabels: true,
  legend: true
});

// Load MAF data
await visualizer.loadMafFile(mafFile);
visualizer.render();
```

### React Component

```jsx
import React from 'react';
import { Oncoprint } from 'oncoprint-js';

function MyOncoprint() {
  const handleCellClick = (gene, sample, mutation) => {
    console.log(`Clicked: ${gene} in ${sample}`);
  };

  return (
    <Oncoprint
      mafFile={mafFile}
      metadataFile={metadataFile}
      config={{
        cellWidth: 12,
        cellHeight: 18,
        geneLabels: true,
        legend: true,
        showPercentages: true
      }}
      width={800}
      height={600}
      onCellClick={handleCellClick}
    />
  );
}
```

### React Hook

```jsx
import React, { useRef } from 'react';
import { useOncoprint } from 'oncoprint-js';

function MyAdvancedOncoprint() {
  const containerRef = useRef(null);
  
  const {
    loadMafData,
    exportSVG,
    sortGenesByFrequency,
    mutationStats
  } = useOncoprint({ 
    container: containerRef.current,
    config: { cellWidth: 10, cellHeight: 20 }
  });

  return (
    <div>
      <button onClick={() => loadMafData(myMafData)}>Load Data</button>
      <button onClick={() => sortGenesByFrequency(true)}>Sort by Frequency</button>
      <button onClick={() => exportSVG()}>Export SVG</button>
      <div ref={containerRef} style={{ width: '100%', height: '600px' }} />
    </div>
  );
}
```

## API Reference

### OncoprintVisualizer

The main class for creating oncoprint visualizations.

#### Constructor

```typescript
new OncoprintVisualizer(container: HTMLElement, config?: OncoprintConfig)
```

#### Data Loading Methods

```typescript
// Load from files
await visualizer.loadMafFile(file: File): Promise<ValidationResult>
await visualizer.loadMetadataFile(file: File): Promise<ValidationResult>

// Load from data arrays
await visualizer.loadMafData(data: MafData[]): Promise<void>
await visualizer.loadMetadataData(data: MetadataRow[]): Promise<void>
```

#### Rendering Methods

```typescript
visualizer.render(): void
visualizer.update(config?: Partial<OncoprintConfig>): void
visualizer.resize(width?: number, height?: number): void
```

#### Export Methods

```typescript
visualizer.exportSVG(): string
await visualizer.exportPNG(): Promise<Blob>
visualizer.exportData(): ProcessedData
```

#### Analysis Methods

```typescript
visualizer.sortGenesByFrequency(descending?: boolean): void
visualizer.sortSamplesByMutationLoad(descending?: boolean): void
visualizer.sortSamplesByMetadata(field: string, ascending?: boolean): void
visualizer.filterByMutationFrequency(minFreq: number, maxFreq?: number): void
```

### Configuration Options

```typescript
interface OncoprintConfig {
  // Visual settings
  cellWidth?: number;              // Default: 10
  cellHeight?: number;             // Default: 20
  geneLabels?: boolean;            // Default: true
  sampleLabels?: boolean;          // Default: false
  
  // Color scheme
  variantColors?: Record<string, string>;
  
  // Metadata tracks
  metadataFields?: string[];
  metadataTrackHeight?: number;    // Default: 15
  
  // Sorting & ordering
  sortGenes?: 'frequency' | 'alphabetical' | 'custom';
  sortSamples?: 'mutation_load' | 'alphabetical' | 'custom';
  customGeneOrder?: string[];
  customSampleOrder?: string[];
  
  // Layout
  showPercentages?: boolean;       // Default: false
  legend?: boolean;                // Default: true
  tooltips?: boolean;              // Default: true
}
```

### Data Formats

#### MAF Data Format

```typescript
interface MafData {
  Hugo_Symbol: string;             // Gene symbol (required)
  Tumor_Sample_Barcode: string;    // Sample ID (required)
  Variant_Classification: string;  // Mutation type (required)
  Protein_Change?: string;         // Protein change (optional)
  Chromosome?: string;             // Chromosome (optional)
  Start_Position?: number;         // Genomic position (optional)
  End_Position?: number;           // Genomic position (optional)
}
```

#### Metadata Format

```typescript
interface MetadataRow {
  Tumor_Sample_Barcode: string;    // Must match MAF sample IDs
  [key: string]: string | number;  // Any additional fields
}
```

## Examples

### Basic HTML Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Oncoprint Example</title>
</head>
<body>
    <div id="oncoprint-container" style="width: 100%; height: 600px;"></div>
    
    <script type="module">
        import { OncoprintVisualizer } from 'path/to/oncoprint-js';
        
        const container = document.getElementById('oncoprint-container');
        const visualizer = new OncoprintVisualizer(container);
        
        // Sample data
        const mafData = [
            {
                Hugo_Symbol: 'TP53',
                Tumor_Sample_Barcode: 'Sample_1',
                Variant_Classification: 'Missense_Mutation'
            },
            // ... more mutations
        ];
        
        visualizer.loadMafData(mafData);
        visualizer.render();
    </script>
</body>
</html>
```

### Advanced React Example

```jsx
import React, { useState, useRef } from 'react';
import { Oncoprint } from 'oncoprint-js';

function AdvancedOncoprintExample() {
  const [selectedGenes, setSelectedGenes] = useState([]);
  const oncoprintRef = useRef(null);

  const handleGeneSelection = (genes) => {
    setSelectedGenes(genes);
    oncoprintRef.current?.setGeneSelection(genes);
  };

  const handleExportData = () => {
    const data = oncoprintRef.current?.exportData();
    console.log('Exported data:', data);
  };

  return (
    <div>
      <div className="controls">
        <button onClick={() => handleGeneSelection(['TP53', 'KRAS'])}>
          Select Key Genes
        </button>
        <button onClick={handleExportData}>
          Export Data
        </button>
      </div>
      
      <Oncoprint
        ref={oncoprintRef}
        mafData={mafData}
        metadataData={metadataData}
        config={{
          cellWidth: 8,
          cellHeight: 16,
          metadataFields: ['Cancer_Type', 'Stage', 'Age'],
          showPercentages: true,
          sortGenes: 'frequency'
        }}
        onGeneClick={(gene) => console.log('Gene clicked:', gene)}
        onCellClick={(gene, sample) => console.log('Cell clicked:', gene, sample)}
      />
    </div>
  );
}
```

## File Format Requirements

### MAF File Format

Your MAF file must contain at minimum these columns:

- `Hugo_Symbol` - Gene symbol
- `Tumor_Sample_Barcode` - Sample identifier  
- `Variant_Classification` - Type of mutation

Optional columns:
- `Protein_Change` - Protein-level change
- `Chromosome` - Chromosome number
- `Start_Position` - Genomic start position
- `End_Position` - Genomic end position

### Metadata File Format

Tab-separated or comma-separated file with:

- `Tumor_Sample_Barcode` - Must match MAF sample IDs
- Additional columns for clinical/sample metadata

Example:
```
Tumor_Sample_Barcode	Cancer_Type	Stage	Age	Gender
Sample_1	LUAD	Stage II	65	Male
Sample_2	BRCA	Stage I	52	Female
```

## Mutation Type Colors

Default color scheme for common mutation types:

- **Missense_Mutation**: Teal (#16a085)
- **Nonsense_Mutation**: Dark Gray (#34495e)  
- **Frame_Shift_Del**: Blue (#2980b9)
- **Frame_Shift_Ins**: Red (#c0392b)
- **Splice_Site**: Green (#27ae60)
- **In_Frame_Del**: Orange (#f39c12)
- **In_Frame_Ins**: Purple (#8e44ad)

Unknown mutation types are automatically assigned colors from a predefined palette.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Citation

If you use Oncoprint.js in your research, please cite:

```
Oncoprint.js: A JavaScript library for interactive oncology data visualization
```

## Support

- [Documentation](https://github.com/poisonalien/oncoprint-js/wiki)
- [Issue Tracker](https://github.com/poisonalien/oncoprint-js/issues)
- [Discussions](https://github.com/poisonalien/oncoprint-js/discussions)

## Quick Links

- **[Live Demo](https://poisonalien.github.io/oncoprint-js/)** - Try the interactive configurator
- **[Examples](./examples)** - Complete usage examples
- **[API Reference](./API_REFERENCE.md)** - Detailed API documentation

## Live Demo

The live demo is automatically deployed to GitHub Pages when code is pushed to the main branch. The deployment process:

1. **Automated Deployment**: GitHub Actions workflow builds the library and deploys examples
2. **URL**: [https://poisonalien.github.io/oncoprint-js/](https://poisonalien.github.io/oncoprint-js/)
3. **Contents**: Interactive oncoprint configurator and basic examples
4. **Updates**: Automatically updates with each release

To enable the live demo for your repository:
1. Enable GitHub Pages in repository settings
2. Set source to "GitHub Actions"
3. Push to main branch to trigger deployment

## Development

### Prerequisites

- Node.js ≥ 16.0.0
- npm ≥ 8.0.0

### Building from Source

```bash
# Clone the repository
git clone https://github.com/poisonalien/oncoprint-js.git
cd oncoprint-js

# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Start development mode
npm run dev

# Run examples server
npm run examples
```

### Project Structure

```
oncoprint-js/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── core/              # Core visualization logic
│   ├── parsers/           # Data parsers (MAF, metadata)
│   ├── renderers/         # D3.js rendering engine
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── examples/              # Usage examples
├── dist/                  # Built library (generated)
├── API_REFERENCE.md       # API documentation
├── CHANGELOG.md           # Version history
└── CLAUDE.md             # AI development guide
```

## Contributing

We welcome contributions! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting a PR.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run type checking: `npm run typecheck`
6. Run linting: `npm run lint`
7. Commit your changes: `git commit -m 'Add amazing feature'`
8. Push to the branch: `git push origin feature/amazing-feature`
9. Open a Pull Request

### Reporting Issues

- Use the [issue tracker](https://github.com/poisonalien/oncoprint-js/issues)
- Include a minimal reproduction case
- Specify your environment (browser, Node.js version, etc.)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Citation

If you use Oncoprint.js in your research, please cite:

```bibtex
@software{oncoprint-js,
  title = {Oncoprint.js: A JavaScript library for interactive cancer genomics visualizations},
  author = {Oncoprint.js Contributors},
  url = {https://github.com/poisonalien/oncoprint-js},
  year = {2024}
}
```

## Acknowledgments

- [D3.js](https://d3js.org/) - Powerful data visualization library
- [cBioPortal](https://www.cbioportal.org/) - Inspiration and cancer genomics expertise
- [React](https://reactjs.org/) - Component framework integration
- All our [contributors](https://github.com/poisonalien/oncoprint-js/contributors)

## Support

- [Documentation](https://github.com/poisonalien/oncoprint-js/wiki)
- [Issue Tracker](https://github.com/poisonalien/oncoprint-js/issues)
- [Discussions](https://github.com/poisonalien/oncoprint-js/discussions)

---

<div align="center">
Made by the Oncoprint.js team
</div>