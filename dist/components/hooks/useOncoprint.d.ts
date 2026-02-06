import { MafData, MetadataRow, ProcessedData, OncoprintConfig, ValidationResult } from '../../types';
import { OncoprintVisualizer } from '../../core';
export interface UseOncoprintOptions {
    container?: HTMLElement | null;
    config?: OncoprintConfig;
    autoRender?: boolean;
}
export interface UseOncoprintReturn {
    data: ProcessedData | null;
    isLoading: boolean;
    error: Error | null;
    loadMafFile: (file: File) => Promise<ValidationResult>;
    loadMafData: (data: MafData[]) => Promise<void>;
    loadMetadataFile: (file: File) => Promise<ValidationResult>;
    loadMetadataData: (data: MetadataRow[]) => Promise<void>;
    render: () => void;
    update: (config?: Partial<OncoprintConfig>) => void;
    resize: (width?: number, height?: number) => void;
    exportSVG: () => string;
    exportPNG: () => Promise<Blob>;
    exportData: () => ProcessedData;
    selectedGenes: string[];
    selectedSamples: string[];
    setGeneSelection: (genes: string[]) => void;
    setSampleSelection: (samples: string[]) => void;
    availableGenes: string[];
    availableSamples: string[];
    metadataFields: string[];
    mutationStats: ReturnType<OncoprintVisualizer['getMutationStats']>;
    sortGenesByFrequency: (descending?: boolean) => void;
    sortSamplesByMutationLoad: (descending?: boolean) => void;
    sortSamplesByMetadata: (field: string, ascending?: boolean) => void;
    filterByMutationFrequency: (minFreq: number, maxFreq?: number) => void;
    visualizer: OncoprintVisualizer | null;
}
export declare function useOncoprint({ container, config, autoRender }?: UseOncoprintOptions): UseOncoprintReturn;
