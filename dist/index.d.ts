import React from 'react';

interface MafData {
    Hugo_Symbol: string;
    Tumor_Sample_Barcode: string;
    Variant_Classification: string;
    Protein_Change?: string;
    Chromosome?: string;
    Start_Position?: number;
    End_Position?: number;
    [key: string]: string | number | undefined;
}
interface MetadataRow {
    Tumor_Sample_Barcode: string;
    [key: string]: string | number;
}
interface ProcessedMutation {
    gene: string;
    sample: string;
    variantType: string;
    proteinChange?: string;
    [key: string]: any;
}
interface ProcessedMetadata {
    fields: string[];
    data: Record<string, Record<string, string | number>>;
    fieldTypes: Record<string, 'categorical' | 'numerical'>;
}
interface CohortInfo {
    totalSamples?: number;
    samples?: string[];
    name?: string;
    description?: string;
}
interface SampleGroup {
    value: string;
    samples: string[];
    count: number;
    startIndex: number;
    endIndex: number;
}
interface ProcessedData {
    genes: string[];
    samples: string[];
    mutations: ProcessedMutation[];
    geneCounts: Record<string, number>;
    sampleCounts: Record<string, number>;
    metadata: ProcessedMetadata;
    percentageCalculationBase: number;
    cohortInfo?: {
        totalSamples: number;
        providedSamples?: string[];
        missingSamples?: string[];
    };
    sampleGroups?: SampleGroup[];
}
interface MetadataTrackConfig {
    field: string;
    label?: string;
    type?: 'categorical' | 'numerical' | 'auto';
    visible?: boolean;
    order?: number;
    height?: number;
    colors?: string[] | Record<string, string>;
    colorScale?: 'blues' | 'viridis' | 'plasma' | 'reds' | 'greens' | string;
    domain?: [number, number];
    binning?: {
        method: 'equal' | 'quantile';
        bins: number;
    };
    showLabels?: boolean;
    tooltips?: boolean;
    customRenderer?: (value: string | number, sample: string) => {
        color: string;
        tooltip?: string;
    };
}
interface MetadataConfig {
    tracks?: MetadataTrackConfig[];
    defaultHeight?: number;
    trackSpacing?: number;
    showLabels?: boolean;
    labelWidth?: number;
    layout?: 'horizontal' | 'vertical';
    alignment?: 'top' | 'center' | 'bottom';
}
interface OncoprintConfig {
    geneList?: string[];
    sampleList?: string[];
    cellWidth?: number;
    cellHeight?: number;
    geneLabels?: boolean;
    sampleLabels?: boolean;
    variantColors?: Record<string, string>;
    metadataFields?: string[];
    metadataTrackHeight?: number;
    metadata?: MetadataConfig;
    sortGenes?: 'frequency' | 'alphabetical' | 'custom';
    sortSamples?: 'mutation_load' | 'alphabetical' | 'custom' | 'oncoprint';
    customGeneOrder?: string[];
    customSampleOrder?: string[];
    tooltips?: boolean;
    exportable?: boolean;
    resizable?: boolean;
    splitBy?: {
        field: string;
        gapSize?: number;
        showGroupHeaders?: boolean;
        showGroupCounts?: boolean;
    };
    showPercentages?: boolean;
    showTotals?: boolean;
    legend?: boolean;
}
interface ValidationError {
    type: 'missing_column' | 'invalid_format' | 'empty_file' | 'invalid_data';
    message: string;
    line?: number;
    column?: string;
}
interface ValidationWarning {
    type: 'unknown_variant' | 'missing_metadata' | 'data_quality';
    message: string;
    line?: number;
    column?: string;
}
interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
interface GeneSet {
    name: string;
    genes: string[];
    description?: string;
}
interface MutationStats {
    totalMutations: number;
    mutatedSamples: number;
    mutationRate: number;
    coOccurrenceMatrix: number[][];
    mutualExclusivity: Array<{
        gene1: string;
        gene2: string;
        pValue: number;
    }>;
}
type EventType = 'geneClick' | 'sampleClick' | 'cellClick' | 'dataLoaded' | 'error';
interface OncoprintEvent {
    type: EventType;
    data: any;
}

declare class DataProcessor {
    static processData(maf: MafData[], metadata?: MetadataRow[], cohortInfo?: CohortInfo): ProcessedData;
    static filterByGenes(data: ProcessedData, genes: string[]): ProcessedData;
    static filterBySamples(data: ProcessedData, samples: string[]): ProcessedData;
    static sortGenesByFrequency(data: ProcessedData, descending?: boolean, maxGenes?: number): string[];
    static sortSamplesByMutationLoad(data: ProcessedData, descending?: boolean): string[];
    static sortSamplesForOncoprint(data: ProcessedData, sortedGenes: string[]): string[];
    static sortSamplesByMetadata(data: ProcessedData, field: string, ascending?: boolean): string[];
    static getMutationMatrix(data: ProcessedData): Record<string, Record<string, ProcessedMutation | ProcessedMutation[] | null>>;
    static calculateMutationFrequencies(data: ProcessedData): Record<string, number>;
    static getVariantTypes(data: ProcessedData): string[];
    static applySplitBy(data: ProcessedData, splitField: string, sortMethod?: 'mutation_load' | 'alphabetical' | 'custom' | 'oncoprint', customSampleOrder?: string[], geneOrder?: string[]): ProcessedData;
    private static sortSamplesWithinGroup;
    static getCoOccurrenceMatrix(data: ProcessedData): Record<string, Record<string, number>>;
}

declare const DEFAULT_VARIANT_COLORS: {
    Missense_Mutation: string;
    Splice_Site: string;
    Frame_Shift_Del: string;
    Frame_Shift_Ins: string;
    In_Frame_Del: string;
    In_Frame_Ins: string;
    Nonsense_Mutation: string;
    Multi_Hit: string;
    Translation_Start_Site: string;
    Nonstop_Mutation: string;
    Default: string;
    Empty: string;
};
declare class VariantColorManager {
    private predefinedColors;
    private dynamicColors;
    private colorPalette;
    private usedColors;
    constructor(predefinedColors?: Record<string, string>);
    getColor(variant: string): string;
    getAllColors(): Record<string, string>;
    getKnownVariants(): string[];
    getDynamicVariants(): string[];
    updateColor(variant: string, color: string): void;
    resetDynamicColors(): void;
    getColorLegend(variants: string[]): Array<{
        variant: string;
        color: string;
        isKnown: boolean;
    }>;
    private generateUniqueColor;
    private generateRandomColor;
    getVariantsByFrequency(variants: string[], counts: Record<string, number>): string[];
    static fromVariants(variants: string[], customColors?: Record<string, string>): VariantColorManager;
    exportColorMap(): Record<string, string>;
    importColorMap(colorMap: Record<string, string>): void;
}

type EventCallback = (...args: any[]) => void;
declare class EventEmitter {
    private events;
    on(event: string, callback: EventCallback): void;
    off(event: string, callback?: EventCallback): void;
    emit(event: string, ...args: any[]): void;
    once(event: string, callback: EventCallback): void;
    listenerCount(event: string): number;
    removeAllListeners(event?: string): void;
}

declare class OncoprintVisualizer extends EventEmitter {
    private container;
    private renderer;
    private processedData;
    private rawMafData;
    private rawMetadataData;
    private cohortInfo?;
    private config;
    constructor(container: HTMLElement, config?: OncoprintConfig);
    loadMafFile(file: File): Promise<ValidationResult>;
    loadMafData(data: MafData[], cohortInfo?: CohortInfo): Promise<void>;
    loadMetadataFile(file: File): Promise<ValidationResult>;
    loadMetadataData(data: MetadataRow[]): Promise<void>;
    render(): void;
    update(config?: Partial<OncoprintConfig>): void;
    resize(width?: number, height?: number): void;
    exportSVG(): string;
    exportPNG(options?: {
        backgroundColor?: string;
        cropToContent?: boolean;
        padding?: number;
        scale?: number;
    }): Promise<Blob>;
    exportData(): ProcessedData;
    getSelectedGenes(): string[];
    getSelectedSamples(): string[];
    setGeneSelection(genes: string[]): void;
    setSampleSelection(samples: string[]): void;
    getAvailableGenes(): string[];
    getAllGenes(): string[];
    getAvailableSamples(): string[];
    getAllSamples(): string[];
    getPercentageCalculationBase(): number;
    getCohortInfo(): {
        totalSamples: number;
        hasCohortInfo: boolean;
        missingSamples?: string[];
    };
    getMetadataFields(): string[];
    getVariantTypes(): string[];
    getMutationStats(): {
        totalMutations: number;
        totalGenes: number;
        totalSamples: number;
        averageMutationsPerSample: number;
        averageMutationsPerGene: number;
    };
    setConfig(config: OncoprintConfig): void;
    getConfig(): OncoprintConfig;
    sortGenesByFrequency(descending?: boolean): void;
    sortSamplesByMutationLoad(descending?: boolean): void;
    sortSamplesByMetadata(field: string, ascending?: boolean): void;
    filterByMutationFrequency(minFrequency: number, maxFrequency?: number): void;
    filterByMutationCount(minCount: number, maxCount?: number): void;
    private setupRendererEvents;
    private applyDataFilters;
    private reprocessData;
    private reconstructMafData;
    addMetadataTrack(trackConfig: MetadataTrackConfig): void;
    removeMetadataTrack(fieldName: string): void;
    updateMetadataTrack(fieldName: string, updates: Partial<MetadataTrackConfig>): void;
    showMetadataTrack(fieldName: string): void;
    hideMetadataTrack(fieldName: string): void;
    reorderMetadataTracks(fieldOrder: string[]): void;
    getMetadataConfig(): MetadataTrackConfig[];
    setMetadataConfig(tracks: MetadataTrackConfig[]): void;
    getAvailableMetadataFields(): string[];
    destroy(): void;
}

declare class MafParser {
    private static readonly REQUIRED_COLUMNS;
    private static readonly OPTIONAL_COLUMNS;
    static parseFromFile(file: File): Promise<MafData[]>;
    static parseFromString(content: string, delimiter?: string): MafData[];
    static parseFromUrl(url: string): Promise<MafData[]>;
    static validateMafData(data: MafData[]): ValidationResult;
    private static readFileContent;
    private static detectDelimiter;
}

type FieldTypeMap = Record<string, 'categorical' | 'numerical'>;
declare class MetadataParser {
    static parseFromFile(file: File): Promise<MetadataRow[]>;
    static parseFromString(content: string, delimiter?: string): MetadataRow[];
    static parseFromUrl(url: string): Promise<MetadataRow[]>;
    static detectFieldTypes(data: MetadataRow[]): FieldTypeMap;
    static validateMetadata(data: MetadataRow[], mafSamples?: string[]): ValidationResult;
    private static readFileContent;
    private static detectDelimiter;
}

interface RendererDimensions {
    width: number;
    height: number;
    cellWidth: number;
    cellHeight: number;
    geneLabelWidth: number;
    sampleLabelHeight: number;
    metadataTrackHeight: number;
    legendWidth: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
}
declare class OncoprintRenderer extends EventEmitter {
    private container;
    private svg;
    private data;
    private config;
    private colorManager;
    private dimensions;
    private geneOrder;
    private sampleOrder;
    constructor(container: HTMLElement, config?: OncoprintConfig);
    setData(data: ProcessedData): void;
    updateConfig(config: Partial<OncoprintConfig>): void;
    render(): void;
    resize(width?: number, height?: number): void;
    exportSVG(): string;
    exportPNG(options?: {
        backgroundColor?: string;
        cropToContent?: boolean;
        padding?: number;
        scale?: number;
    }): Promise<Blob>;
    private createFullSizeExportSVG;
    private getSampleXPosition;
    private getTotalWidthWithGaps;
    private getContentBounds;
    private calculateFullSizeDimensions;
    private createSVG;
    private renderMainMatrix;
    private renderGeneLabels;
    private renderSampleLabels;
    private renderMetadataTracks;
    private getActiveMetadataTracks;
    private renderGroupHeaders;
    private renderSingleMetadataTrack;
    private createColorScale;
    private renderLegend;
    private renderMetadataLegends;
    private renderCategoricalMetadataLegend;
    private renderNumericalMetadataLegend;
    private setupInteractions;
    private updateColorManager;
    private updateOrdering;
    private createMutationMatrix;
    private calculateDimensions;
    private getMetadataTracksHeight;
    private getDefaultConfig;
    addMetadataTrack(trackConfig: MetadataTrackConfig): void;
    removeMetadataTrack(fieldName: string): void;
    updateMetadataTrack(fieldName: string, updates: Partial<MetadataTrackConfig>): void;
    showMetadataTrack(fieldName: string): void;
    hideMetadataTrack(fieldName: string): void;
    reorderMetadataTracks(fieldOrder: string[]): void;
    getMetadataConfig(): MetadataTrackConfig[];
    setMetadataConfig(tracks: MetadataTrackConfig[]): void;
    getAvailableMetadataFields(): string[];
}

interface OncoprintProps {
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
interface OncoprintRef {
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
declare const OncoprintSimple: React.FC<OncoprintProps>;
declare const Oncoprint: React.ForwardRefExoticComponent<OncoprintProps & React.RefAttributes<OncoprintRef>>;

interface UseOncoprintOptions {
    container?: HTMLElement | null;
    config?: OncoprintConfig;
    autoRender?: boolean;
}
interface UseOncoprintReturn {
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
declare function useOncoprint({ container, config, autoRender }?: UseOncoprintOptions): UseOncoprintReturn;

export { DEFAULT_VARIANT_COLORS, DataProcessor, EventEmitter, MafParser, MetadataParser, Oncoprint, OncoprintRenderer, OncoprintSimple, OncoprintVisualizer, VariantColorManager, useOncoprint };
export type { CohortInfo, EventCallback, EventType, FieldTypeMap, GeneSet, MafData, MetadataConfig, MetadataRow, MetadataTrackConfig, MutationStats, OncoprintConfig, OncoprintEvent, OncoprintProps, OncoprintRef, ProcessedData, ProcessedMetadata, ProcessedMutation, RendererDimensions, SampleGroup, UseOncoprintOptions, UseOncoprintReturn, ValidationError, ValidationResult, ValidationWarning };
