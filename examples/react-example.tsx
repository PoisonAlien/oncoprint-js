import React, { useState, useRef } from 'react';
import { Oncoprint, type OncoprintRef, useOncoprint } from '../src/components';
import { MafData, MetadataRow } from '../src/types';

// Sample data generator
function generateSampleData() {
  const genes = ['TP53', 'KRAS', 'PIK3CA', 'EGFR', 'BRAF', 'APC', 'PTEN', 'CDKN2A', 'ATM', 'BRCA1'];
  const samples = Array.from({length: 100}, (_, i) => `Patient_${i + 1}`);
  const variantTypes = ['Missense_Mutation', 'Nonsense_Mutation', 'Frame_Shift_Del', 'Frame_Shift_Ins', 'Splice_Site', 'In_Frame_Del'];
  
  const mafData: MafData[] = [];
  
  // Generate mutations with realistic frequency patterns
  genes.forEach((gene, geneIndex) => {
    const baseFrequency = Math.max(0.1, Math.random() * 0.4); // 10-40% base frequency
    const numMutations = Math.floor(samples.length * baseFrequency);
    const mutatedSamples = samples.sort(() => 0.5 - Math.random()).slice(0, numMutations);
    
    mutatedSamples.forEach(sample => {
      mafData.push({
        Hugo_Symbol: gene,
        Tumor_Sample_Barcode: sample,
        Variant_Classification: variantTypes[Math.floor(Math.random() * variantTypes.length)],
        Protein_Change: `p.${gene.charAt(0)}${Math.floor(Math.random() * 500) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
        Chromosome: `${Math.floor(Math.random() * 22) + 1}`,
        Start_Position: Math.floor(Math.random() * 1000000) + 100000,
        End_Position: Math.floor(Math.random() * 1000000) + 100000
      });
    });
  });
  
  return mafData;
}

function generateMetadata(samples: string[]) {
  const cancerTypes = ['LUAD', 'BRCA', 'COAD', 'STAD', 'BLCA', 'HNSC', 'KIRC', 'THCA', 'PRAD', 'LIHC'];
  const stages = ['Stage I', 'Stage II', 'Stage III', 'Stage IV'];
  const genders = ['Male', 'Female'];
  
  return samples.map(sample => ({
    Tumor_Sample_Barcode: sample,
    Cancer_Type: cancerTypes[Math.floor(Math.random() * cancerTypes.length)],
    Stage: stages[Math.floor(Math.random() * stages.length)],
    Gender: genders[Math.floor(Math.random() * genders.length)],
    Age: Math.floor(Math.random() * 40) + 40, // 40-80 years
    Tumor_Purity: Math.random() * 0.5 + 0.5 // 0.5-1.0
  }));
}

// Example 1: Basic component usage
export function BasicOncoprintExample() {
  const [mafData, setMafData] = useState<MafData[]>([]);
  const [metadataData, setMetadataData] = useState<MetadataRow[]>([]);
  const oncoprintRef = useRef<OncoprintRef>(null);

  const loadSampleData = () => {
    const sampleMaf = generateSampleData();
    const samples = Array.from(new Set(sampleMaf.map(m => m.Tumor_Sample_Barcode)));
    const sampleMetadata = generateMetadata(samples);
    
    setMafData(sampleMaf);
    setMetadataData(sampleMetadata);
  };

  const handleExportSVG = () => {
    if (oncoprintRef.current) {
      const svg = oncoprintRef.current.exportSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'oncoprint.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSortByFrequency = () => {
    oncoprintRef.current?.sortGenesByFrequency(true);
  };

  const handleFilterHighFrequency = () => {
    oncoprintRef.current?.filterByMutationFrequency(0.2); // Show genes with >20% mutation frequency
  };

  return (
    <div className="oncoprint-example">
      <h2>Basic Oncoprint Example</h2>
      
      <div className="controls" style={{ marginBottom: '20px' }}>
        <button onClick={loadSampleData}>Load Sample Data</button>
        <button onClick={handleSortByFrequency}>Sort by Frequency</button>
        <button onClick={handleFilterHighFrequency}>Filter High Frequency</button>
        <button onClick={handleExportSVG}>Export SVG</button>
      </div>

      <Oncoprint
        ref={oncoprintRef}
        mafData={mafData}
        metadataData={metadataData}
        config={{
          cellWidth: 8,
          cellHeight: 18,
          geneLabels: true,
          sampleLabels: false,
          legend: true,
          showPercentages: true,
          metadataFields: ['Cancer_Type', 'Stage', 'Age'],
          metadataTrackHeight: 12,
          sortGenes: 'frequency',
          sortSamples: 'mutation_load'
        }}
        width={1000}
        height={600}
        onGeneClick={(gene) => console.log('Gene clicked:', gene)}
        onSampleClick={(sample) => console.log('Sample clicked:', sample)}
        onCellClick={(gene, sample, mutation) => 
          console.log('Cell clicked:', { gene, sample, mutation })
        }
        onDataLoaded={(data) => console.log('Data loaded:', data)}
        onError={(error) => console.error('Error:', error)}
        style={{ border: '1px solid #ccc' }}
      />
    </div>
  );
}

// Example 2: Using the hook for more control
export function AdvancedOncoprintExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    data,
    isLoading,
    error,
    loadMafData,
    loadMetadataData,
    render,
    exportSVG,
    exportPNG,
    selectedGenes,
    setGeneSelection,
    availableGenes,
    mutationStats,
    sortGenesByFrequency,
    sortSamplesByMetadata,
    visualizer
  } = useOncoprint({ 
    container: containerRef.current,
    config: {
      cellWidth: 10,
      cellHeight: 20,
      geneLabels: true,
      legend: true,
      metadataFields: ['Cancer_Type', 'Gender'],
      showPercentages: true
    }
  });

  const handleLoadData = async () => {
    const sampleMaf = generateSampleData();
    const samples = Array.from(new Set(sampleMaf.map(m => m.Tumor_Sample_Barcode)));
    const sampleMetadata = generateMetadata(samples);
    
    try {
      await loadMafData(sampleMaf);
      await loadMetadataData(sampleMetadata);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleGeneSelection = () => {
    if (availableGenes.length > 0) {
      // Select top 5 most frequently mutated genes
      const topGenes = availableGenes.slice(0, 5);
      setGeneSelection(topGenes);
    }
  };

  const handleExportSVG = async () => {
    try {
      const svg = exportSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'advanced-oncoprint.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportPNG = async () => {
    try {
      const blob = await exportPNG();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'advanced-oncoprint.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="advanced-oncoprint-example">
      <h2>Advanced Oncoprint Example (Hook-based)</h2>
      
      <div className="controls" style={{ marginBottom: '20px' }}>
        <button onClick={handleLoadData} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Load Sample Data'}
        </button>
        <button onClick={() => sortGenesByFrequency(true)} disabled={!data}>
          Sort Genes by Frequency
        </button>
        <button onClick={() => sortSamplesByMetadata('Cancer_Type')} disabled={!data}>
          Sort by Cancer Type
        </button>
        <button onClick={handleGeneSelection} disabled={!data}>
          Select Top 5 Genes
        </button>
        <button onClick={handleExportSVG} disabled={!data}>
          Export SVG
        </button>
        <button onClick={handleExportPNG} disabled={!data}>
          Export PNG
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          Error: {error.message}
        </div>
      )}

      {data && (
        <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
          Stats: {mutationStats.totalMutations} mutations across {mutationStats.totalGenes} genes 
          and {mutationStats.totalSamples} samples
          {selectedGenes.length > 0 && (
            <span> | Selected genes: {selectedGenes.join(', ')}</span>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid #ccc',
          backgroundColor: '#f9f9f9'
        }}
      />
    </div>
  );
}

// Example 3: File upload example
export function FileUploadExample() {
  const [mafFile, setMafFile] = useState<File | undefined>();
  const [metadataFile, setMetadataFile] = useState<File | undefined>();
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleMafFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setMafFile(file);
    setUploadStatus(file ? `MAF file selected: ${file.name}` : '');
  };

  const handleMetadataFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setMetadataFile(file);
    setUploadStatus(prev => 
      prev + (file ? ` | Metadata file selected: ${file.name}` : '')
    );
  };

  return (
    <div className="file-upload-example">
      <h2>File Upload Example</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="maf-upload">Upload MAF File:</label>
          <input
            id="maf-upload"
            type="file"
            accept=".maf,.tsv,.csv,.txt"
            onChange={handleMafFileChange}
            style={{ marginLeft: '10px' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="metadata-upload">Upload Metadata File (optional):</label>
          <input
            id="metadata-upload"
            type="file"
            accept=".tsv,.csv,.txt"
            onChange={handleMetadataFileChange}
            style={{ marginLeft: '10px' }}
          />
        </div>

        {uploadStatus && (
          <div style={{ fontSize: '14px', color: '#666' }}>
            {uploadStatus}
          </div>
        )}
      </div>

      {mafFile && (
        <Oncoprint
          mafFile={mafFile}
          metadataFile={metadataFile}
          config={{
            cellWidth: 10,
            cellHeight: 16,
            geneLabels: true,
            legend: true,
            showPercentages: true,
            sortGenes: 'frequency'
          }}
          width={1200}
          height={700}
          onDataLoaded={(data) => 
            setUploadStatus(`Data loaded successfully: ${data.mutations.length} mutations`)
          }
          onError={(error) => 
            setUploadStatus(`Error loading data: ${error.message}`)
          }
          style={{ border: '1px solid #ccc' }}
        />
      )}
    </div>
  );
}

// Main example component that demonstrates all three approaches
export default function OncoprintExamples() {
  const [activeExample, setActiveExample] = useState<'basic' | 'advanced' | 'upload'>('basic');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Oncoprint.js React Examples</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <button 
          onClick={() => setActiveExample('basic')}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px',
            backgroundColor: activeExample === 'basic' ? '#007bff' : '#f8f9fa',
            color: activeExample === 'basic' ? 'white' : 'black',
            border: '1px solid #dee2e6',
            cursor: 'pointer'
          }}
        >
          Basic Component
        </button>
        <button 
          onClick={() => setActiveExample('advanced')}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px',
            backgroundColor: activeExample === 'advanced' ? '#007bff' : '#f8f9fa',
            color: activeExample === 'advanced' ? 'white' : 'black',
            border: '1px solid #dee2e6',
            cursor: 'pointer'
          }}
        >
          Advanced Hook
        </button>
        <button 
          onClick={() => setActiveExample('upload')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: activeExample === 'upload' ? '#007bff' : '#f8f9fa',
            color: activeExample === 'upload' ? 'white' : 'black',
            border: '1px solid #dee2e6',
            cursor: 'pointer'
          }}
        >
          File Upload
        </button>
      </div>

      {activeExample === 'basic' && <BasicOncoprintExample />}
      {activeExample === 'advanced' && <AdvancedOncoprintExample />}
      {activeExample === 'upload' && <FileUploadExample />}
    </div>
  );
}