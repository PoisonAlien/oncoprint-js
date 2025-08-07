import React from 'react';
import { MafData, MetadataRow, ProcessedData, OncoprintConfig, ProcessedMutation } from '../types';
export interface OncoprintProps {
    mafData?: MafData[];
    metadataData?: MetadataRow[];
    mafFile?: File;
    metadataFile?: File;
    config?: OncoprintConfig;
    width?: number;
    height?: number;
    onGeneClick?: (gene: string) => void;
    onSampleClick?: (sample: string) => void;
    onCellClick?: (gene: string, sample: string, mutation?: ProcessedMutation) => void;
    onDataLoaded?: (data: ProcessedData) => void;
    onError?: (error: Error) => void;
    onRenderComplete?: () => void;
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
export declare const OncoprintSimple: React.FC<OncoprintProps>;
export declare const Oncoprint: React.ForwardRefExoticComponent<OncoprintProps & React.RefAttributes<OncoprintRef>>;
