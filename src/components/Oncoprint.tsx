import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  MafData, 
  MetadataRow, 
  ProcessedData, 
  OncoprintConfig,
  ProcessedMutation
} from '../types';
import { OncoprintVisualizer } from '../core';

export interface OncoprintProps {
  // Data props
  mafData?: MafData[];
  metadataData?: MetadataRow[];
  mafFile?: File;
  metadataFile?: File;

  // Configuration
  config?: OncoprintConfig;
  width?: number;
  height?: number;

  // Event handlers
  onGeneClick?: (gene: string) => void;
  onSampleClick?: (sample: string) => void;
  onCellClick?: (gene: string, sample: string, mutation?: ProcessedMutation) => void;
  onDataLoaded?: (data: ProcessedData) => void;
  onError?: (error: Error) => void;
  onRenderComplete?: () => void;

  // Style props
  className?: string;
  style?: React.CSSProperties;
}

export interface OncoprintRef {
  exportSVG: () => string;
  exportPNG: () => Promise<Blob>;
  exportData: () => ProcessedData;
  setGeneSelection: (genes: string[]) => void;
  setSampleSelection: (samples: string[]) => void;
  getSelectedGenes: () => string[];
  getSelectedSamples: () => string[];
  getMutationStats: () => any;
  getAvailableGenes: () => string[];
  getAvailableSamples: () => string[];
  getMetadataFields: () => string[];
  sortGenesByFrequency: (descending?: boolean) => void;
  sortSamplesByMutationLoad: (descending?: boolean) => void;
  sortSamplesByMetadata: (field: string, ascending?: boolean) => void;
  filterByMutationFrequency: (minFreq: number, maxFreq?: number) => void;
  render: () => void;
  update: (config?: Partial<OncoprintConfig>) => void;
}

// Create a simpler version without forwardRef for debugging
export const OncoprintSimple: React.FC<OncoprintProps> = ({
  mafData,
  metadataData,
  mafFile,
  metadataFile,
  config = {},
  width,
  height,
  onGeneClick,
  onSampleClick,
  onCellClick,
  onDataLoaded,
  onError,
  onRenderComplete,
  className,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<OncoprintVisualizer | null>(null);

  // console.log('=== OncoprintSimple Component Rendering ===');
  // console.log('Received mafData:', mafData ? `${mafData.length} mutations` : 'null/undefined');
  // console.log('Received metadataData:', metadataData ? `${metadataData.length} samples` : 'null/undefined');

  // Initialize visualizer
  useEffect(() => {
    // console.log('=== OncoprintSimple Initialize useEffect ===');
    // console.log('containerRef.current:', !!containerRef.current);
    
    if (!containerRef.current) {
      // console.log('No container, skipping visualizer initialization');
      return;
    }

    // console.log('Creating OncoprintVisualizer...');
    const visualizer = new OncoprintVisualizer(containerRef.current, config);
    visualizerRef.current = visualizer;
    // console.log('OncoprintVisualizer created and stored in ref');

    // Set up event listeners
    if (onGeneClick) {
      visualizer.on('geneClick', (data: { gene: string }) => onGeneClick(data.gene));
    }

    if (onSampleClick) {
      visualizer.on('sampleClick', (data: { sample: string }) => onSampleClick(data.sample));
    }

    if (onCellClick) {
      visualizer.on('cellClick', (data: { gene: string; sample: string; variant?: string }) => {
        const mutation = data.variant ? { variantType: data.variant } as ProcessedMutation : undefined;
        onCellClick(data.gene, data.sample, mutation);
      });
    }

    if (onDataLoaded) {
      visualizer.on('dataLoaded', onDataLoaded);
    }

    if (onError) {
      visualizer.on('error', onError);
    }

    return () => {
      visualizer.destroy();
    };
  }, []);

  // Handle config updates
  useEffect(() => {
    if (visualizerRef.current) {
      visualizerRef.current.setConfig(config);
    }
  }, [config]);

  // Handle resize
  useEffect(() => {
    if (visualizerRef.current && (width || height)) {
      visualizerRef.current.resize(width, height);
    }
  }, [width, height]);

  // Load MAF data from file
  useEffect(() => {
    if (mafFile && visualizerRef.current) {
      visualizerRef.current.loadMafFile(mafFile)
        .then((validation) => {
          if (validation.isValid) {
            visualizerRef.current?.render();
            onRenderComplete?.();
          } else {
            const error = new Error(validation.errors[0]?.message || 'MAF file validation failed');
            onError?.(error);
          }
        })
        .catch((error) => {
          onError?.(error);
        });
    }
  }, [mafFile, onError, onRenderComplete]);

  // Load MAF data directly
  useEffect(() => {
    // console.log('=== OncoprintSimple useEffect for mafData ===');
    // console.log('mafData:', mafData);
    // console.log('mafData length:', mafData ? mafData.length : 'null/undefined');
    // console.log('visualizerRef.current:', !!visualizerRef.current);
    
    if (mafData && visualizerRef.current) {
      // console.log('Calling visualizerRef.current.loadMafData...');
      visualizerRef.current.loadMafData(mafData)
        .then(() => {
          // console.log('loadMafData promise resolved, calling render...');
          visualizerRef.current?.render();
          onRenderComplete?.();
        })
        .catch((error) => {
          console.error('loadMafData promise rejected:', error);
          onError?.(error);
        });
    } else {
      // console.log('Skipping loadMafData - missing mafData or visualizer');
    }
  }, [mafData, onError, onRenderComplete]);

  // Load metadata from file
  useEffect(() => {
    if (metadataFile && visualizerRef.current) {
      visualizerRef.current.loadMetadataFile(metadataFile)
        .then((validation) => {
          if (validation.isValid) {
            visualizerRef.current?.render();
            onRenderComplete?.();
          } else {
            const error = new Error(validation.errors[0]?.message || 'Metadata file validation failed');
            onError?.(error);
          }
        })
        .catch((error) => {
          onError?.(error);
        });
    }
  }, [metadataFile, onError, onRenderComplete]);

  // Load metadata directly
  useEffect(() => {
    if (metadataData && visualizerRef.current) {
      visualizerRef.current.loadMetadataData(metadataData)
        .then(() => {
          visualizerRef.current?.render();
          onRenderComplete?.();
        })
        .catch((error) => {
          onError?.(error);
        });
    }
  }, [metadataData, onError, onRenderComplete]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: width || '100%',
        height: height || '100%',
        ...style
      }}
    />
  );
};

export const Oncoprint = forwardRef<OncoprintRef, OncoprintProps>(({
  mafData,
  metadataData,
  mafFile,
  metadataFile,
  config = {},
  width,
  height,
  onGeneClick,
  onSampleClick,
  onCellClick,
  onDataLoaded,
  onError,
  onRenderComplete,
  className,
  style
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<OncoprintVisualizer | null>(null);

  // console.log('=== Oncoprint Component Rendering ===');
  // console.log('Received mafData:', mafData ? `${mafData.length} mutations` : 'null/undefined');
  // console.log('Received metadataData:', metadataData ? `${metadataData.length} samples` : 'null/undefined');

  // Initialize visualizer
  useEffect(() => {
    // console.log('=== Oncoprint Initialize useEffect ===');
    // console.log('containerRef.current:', !!containerRef.current);
    
    if (!containerRef.current) {
      // console.log('No container, skipping visualizer initialization');
      return;
    }

    // console.log('Creating OncoprintVisualizer...');
    const visualizer = new OncoprintVisualizer(containerRef.current, config);
    visualizerRef.current = visualizer;
    // console.log('OncoprintVisualizer created and stored in ref');

    // Set up event listeners
    if (onGeneClick) {
      visualizer.on('geneClick', (data: { gene: string }) => onGeneClick(data.gene));
    }

    if (onSampleClick) {
      visualizer.on('sampleClick', (data: { sample: string }) => onSampleClick(data.sample));
    }

    if (onCellClick) {
      visualizer.on('cellClick', (data: { gene: string; sample: string; variant?: string }) => {
        const mutation = data.variant ? { variantType: data.variant } as ProcessedMutation : undefined;
        onCellClick(data.gene, data.sample, mutation);
      });
    }

    if (onDataLoaded) {
      visualizer.on('dataLoaded', onDataLoaded);
    }

    if (onError) {
      visualizer.on('error', onError);
    }

    return () => {
      visualizer.destroy();
    };
  }, []);

  // Handle config updates
  useEffect(() => {
    if (visualizerRef.current) {
      visualizerRef.current.setConfig(config);
    }
  }, [config]);

  // Handle resize
  useEffect(() => {
    if (visualizerRef.current && (width || height)) {
      visualizerRef.current.resize(width, height);
    }
  }, [width, height]);

  // Load MAF data from file
  useEffect(() => {
    if (mafFile && visualizerRef.current) {
      visualizerRef.current.loadMafFile(mafFile)
        .then((validation) => {
          if (validation.isValid) {
            visualizerRef.current?.render();
            onRenderComplete?.();
          } else {
            const error = new Error(validation.errors[0]?.message || 'MAF file validation failed');
            onError?.(error);
          }
        })
        .catch((error) => {
          onError?.(error);
        });
    }
  }, [mafFile, onError, onRenderComplete]);

  // Load MAF data directly
  useEffect(() => {
    // console.log('=== React Oncoprint useEffect for mafData ===');
    // console.log('mafData:', mafData);
    // console.log('mafData length:', mafData ? mafData.length : 'null/undefined');
    // console.log('visualizerRef.current:', !!visualizerRef.current);
    
    if (mafData && visualizerRef.current) {
      // console.log('Calling visualizerRef.current.loadMafData...');
      visualizerRef.current.loadMafData(mafData)
        .then(() => {
          // console.log('loadMafData promise resolved, calling render...');
          visualizerRef.current?.render();
          onRenderComplete?.();
        })
        .catch((error) => {
          console.error('loadMafData promise rejected:', error);
          onError?.(error);
        });
    } else {
      // console.log('Skipping loadMafData - missing mafData or visualizer');
    }
  }, [mafData, onError, onRenderComplete]);

  // Load metadata from file
  useEffect(() => {
    if (metadataFile && visualizerRef.current) {
      visualizerRef.current.loadMetadataFile(metadataFile)
        .then((validation) => {
          if (validation.isValid) {
            visualizerRef.current?.render();
            onRenderComplete?.();
          } else {
            const error = new Error(validation.errors[0]?.message || 'Metadata file validation failed');
            onError?.(error);
          }
        })
        .catch((error) => {
          onError?.(error);
        });
    }
  }, [metadataFile, onError, onRenderComplete]);

  // Load metadata directly
  useEffect(() => {
    if (metadataData && visualizerRef.current) {
      visualizerRef.current.loadMetadataData(metadataData)
        .then(() => {
          visualizerRef.current?.render();
          onRenderComplete?.();
        })
        .catch((error) => {
          onError?.(error);
        });
    }
  }, [metadataData, onError, onRenderComplete]);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    exportSVG: () => {
      if (!visualizerRef.current) {
        throw new Error('Visualizer not initialized');
      }
      return visualizerRef.current.exportSVG();
    },

    exportPNG: async () => {
      if (!visualizerRef.current) {
        throw new Error('Visualizer not initialized');
      }
      return visualizerRef.current.exportPNG();
    },

    exportData: () => {
      if (!visualizerRef.current) {
        throw new Error('Visualizer not initialized');
      }
      return visualizerRef.current.exportData();
    },

    setGeneSelection: (genes: string[]) => {
      visualizerRef.current?.setGeneSelection(genes);
    },

    setSampleSelection: (samples: string[]) => {
      visualizerRef.current?.setSampleSelection(samples);
    },

    getSelectedGenes: () => {
      return visualizerRef.current?.getSelectedGenes() || [];
    },

    getSelectedSamples: () => {
      return visualizerRef.current?.getSelectedSamples() || [];
    },

    getMutationStats: () => {
      return visualizerRef.current?.getMutationStats();
    },

    getAvailableGenes: () => {
      return visualizerRef.current?.getAvailableGenes() || [];
    },

    getAvailableSamples: () => {
      return visualizerRef.current?.getAvailableSamples() || [];
    },

    getMetadataFields: () => {
      return visualizerRef.current?.getMetadataFields() || [];
    },

    sortGenesByFrequency: (descending = true) => {
      visualizerRef.current?.sortGenesByFrequency(descending);
    },

    sortSamplesByMutationLoad: (descending = true) => {
      visualizerRef.current?.sortSamplesByMutationLoad(descending);
    },

    sortSamplesByMetadata: (field: string, ascending = true) => {
      visualizerRef.current?.sortSamplesByMetadata(field, ascending);
    },

    filterByMutationFrequency: (minFreq: number, maxFreq = 1) => {
      visualizerRef.current?.filterByMutationFrequency(minFreq, maxFreq);
    },

    render: () => {
      visualizerRef.current?.render();
    },

    update: (newConfig?: Partial<OncoprintConfig>) => {
      visualizerRef.current?.update(newConfig);
    }
  }), []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: width || '100%',
        height: height || '100%',
        ...style
      }}
    />
  );
});

Oncoprint.displayName = 'Oncoprint';