import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MafData, 
  MetadataRow, 
  ProcessedData, 
  OncoprintConfig,
  ValidationResult
} from '../../types';
import { OncoprintVisualizer } from '../../core';

export interface UseOncoprintOptions {
  container?: HTMLElement | null;
  config?: OncoprintConfig;
  autoRender?: boolean;
}

export interface UseOncoprintReturn {
  // State
  data: ProcessedData | null;
  isLoading: boolean;
  error: Error | null;
  
  // Data loading methods
  loadMafFile: (file: File) => Promise<ValidationResult>;
  loadMafData: (data: MafData[]) => Promise<void>;
  loadMetadataFile: (file: File) => Promise<ValidationResult>;
  loadMetadataData: (data: MetadataRow[]) => Promise<void>;
  
  // Rendering methods
  render: () => void;
  update: (config?: Partial<OncoprintConfig>) => void;
  resize: (width?: number, height?: number) => void;
  
  // Export methods
  exportSVG: () => string;
  exportPNG: () => Promise<Blob>;
  exportData: () => ProcessedData;
  
  // Selection methods
  selectedGenes: string[];
  selectedSamples: string[];
  setGeneSelection: (genes: string[]) => void;
  setSampleSelection: (samples: string[]) => void;
  
  // Analysis methods
  availableGenes: string[];
  availableSamples: string[];
  metadataFields: string[];
  mutationStats: ReturnType<OncoprintVisualizer['getMutationStats']>;
  sortGenesByFrequency: (descending?: boolean) => void;
  sortSamplesByMutationLoad: (descending?: boolean) => void;
  sortSamplesByMetadata: (field: string, ascending?: boolean) => void;
  filterByMutationFrequency: (minFreq: number, maxFreq?: number) => void;
  
  // Visualizer instance (for advanced usage)
  visualizer: OncoprintVisualizer | null;
}

export function useOncoprint({
  container,
  config = {},
  autoRender = true
}: UseOncoprintOptions = {}): UseOncoprintReturn {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedGenes, setSelectedGenes] = useState<string[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [availableGenes, setAvailableGenes] = useState<string[]>([]);
  const [availableSamples, setAvailableSamples] = useState<string[]>([]);
  const [metadataFields, setMetadataFields] = useState<string[]>([]);
  const [mutationStats, setMutationStats] = useState<any>({});

  const visualizerRef = useRef<OncoprintVisualizer | null>(null);

  // Initialize visualizer when container is available
  useEffect(() => {
    if (!container) return;

    const visualizer = new OncoprintVisualizer(container, config);
    visualizerRef.current = visualizer;

    // Set up event listeners
    visualizer.on('dataLoaded', (loadedData: ProcessedData) => {
      setData(loadedData);
      setAvailableGenes(visualizer.getAvailableGenes());
      setAvailableSamples(visualizer.getAvailableSamples());
      setMetadataFields(visualizer.getMetadataFields());
      setMutationStats(visualizer.getMutationStats());
      setIsLoading(false);
      setError(null);
    });

    visualizer.on('error', (err: Error) => {
      setError(err);
      setIsLoading(false);
    });

    return () => {
      visualizer.destroy();
    };
  }, [container, config]);

  // Data loading methods
  const loadMafFile = useCallback(async (file: File): Promise<ValidationResult> => {
    if (!visualizerRef.current) {
      throw new Error('Visualizer not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const validation = await visualizerRef.current.loadMafFile(file);
      if (validation.isValid && autoRender) {
        visualizerRef.current.render();
      }
      return validation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [autoRender]);

  const loadMafData = useCallback(async (mafData: MafData[]): Promise<void> => {
    if (!visualizerRef.current) {
      throw new Error('Visualizer not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      await visualizerRef.current.loadMafData(mafData);
      if (autoRender) {
        visualizerRef.current.render();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [autoRender]);

  const loadMetadataFile = useCallback(async (file: File): Promise<ValidationResult> => {
    if (!visualizerRef.current) {
      throw new Error('Visualizer not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const validation = await visualizerRef.current.loadMetadataFile(file);
      if (validation.isValid && autoRender) {
        visualizerRef.current.render();
      }
      return validation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [autoRender]);

  const loadMetadataData = useCallback(async (metadataData: MetadataRow[]): Promise<void> => {
    if (!visualizerRef.current) {
      throw new Error('Visualizer not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      await visualizerRef.current.loadMetadataData(metadataData);
      if (autoRender) {
        visualizerRef.current.render();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [autoRender]);

  // Rendering methods
  const render = useCallback(() => {
    visualizerRef.current?.render();
  }, []);

  const update = useCallback((newConfig?: Partial<OncoprintConfig>) => {
    visualizerRef.current?.update(newConfig);
  }, []);

  const resize = useCallback((width?: number, height?: number) => {
    visualizerRef.current?.resize(width, height);
  }, []);

  // Export methods
  const exportSVG = useCallback((): string => {
    if (!visualizerRef.current) {
      throw new Error('Visualizer not initialized');
    }
    return visualizerRef.current.exportSVG();
  }, []);

  const exportPNG = useCallback(async (): Promise<Blob> => {
    if (!visualizerRef.current) {
      throw new Error('Visualizer not initialized');
    }
    return visualizerRef.current.exportPNG();
  }, []);

  const exportData = useCallback((): ProcessedData => {
    if (!visualizerRef.current) {
      throw new Error('Visualizer not initialized');
    }
    return visualizerRef.current.exportData();
  }, []);

  // Selection methods
  const setGeneSelection = useCallback((genes: string[]) => {
    setSelectedGenes(genes);
    visualizerRef.current?.setGeneSelection(genes);
  }, []);

  const setSampleSelection = useCallback((samples: string[]) => {
    setSelectedSamples(samples);
    visualizerRef.current?.setSampleSelection(samples);
  }, []);

  // Analysis methods
  const sortGenesByFrequency = useCallback((descending = true) => {
    visualizerRef.current?.sortGenesByFrequency(descending);
  }, []);

  const sortSamplesByMutationLoad = useCallback((descending = true) => {
    visualizerRef.current?.sortSamplesByMutationLoad(descending);
  }, []);

  const sortSamplesByMetadata = useCallback((field: string, ascending = true) => {
    visualizerRef.current?.sortSamplesByMetadata(field, ascending);
  }, []);

  const filterByMutationFrequency = useCallback((minFreq: number, maxFreq = 1) => {
    visualizerRef.current?.filterByMutationFrequency(minFreq, maxFreq);
  }, []);

  return {
    // State
    data,
    isLoading,
    error,
    
    // Data loading methods
    loadMafFile,
    loadMafData,
    loadMetadataFile,
    loadMetadataData,
    
    // Rendering methods
    render,
    update,
    resize,
    
    // Export methods
    exportSVG,
    exportPNG,
    exportData,
    
    // Selection methods
    selectedGenes,
    selectedSamples,
    setGeneSelection,
    setSampleSelection,
    
    // Analysis methods
    availableGenes,
    availableSamples,
    metadataFields,
    mutationStats,
    sortGenesByFrequency,
    sortSamplesByMutationLoad,
    sortSamplesByMetadata,
    filterByMutationFrequency,
    
    // Visualizer instance
    visualizer: visualizerRef.current
  };
}