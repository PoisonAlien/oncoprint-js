export interface MafData {
    Hugo_Symbol: string;
    Tumor_Sample_Barcode: string;
    Variant_Classification: string;
    Protein_Change?: string;
    Chromosome?: string;
    Start_Position?: number;
    End_Position?: number;
    [key: string]: string | number | undefined;
}
export interface MetadataRow {
    Tumor_Sample_Barcode: string;
    [key: string]: string | number;
}
export interface ProcessedMutation {
    gene: string;
    sample: string;
    variantType: string;
    proteinChange?: string;
    [key: string]: any;
}
export interface ProcessedMetadata {
    fields: string[];
    data: Record<string, Record<string, string | number>>;
    fieldTypes: Record<string, 'categorical' | 'numerical'>;
}
export interface CohortInfo {
    totalSamples?: number;
    samples?: string[];
    name?: string;
    description?: string;
}
export interface SampleGroup {
    value: string;
    samples: string[];
    count: number;
    startIndex: number;
    endIndex: number;
}
export interface ProcessedData {
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
export interface MetadataTrackConfig {
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
export interface MetadataConfig {
    tracks?: MetadataTrackConfig[];
    defaultHeight?: number;
    trackSpacing?: number;
    showLabels?: boolean;
    labelWidth?: number;
    layout?: 'horizontal' | 'vertical';
    alignment?: 'top' | 'center' | 'bottom';
}
export interface OncoprintConfig {
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
export interface ValidationError {
    type: 'missing_column' | 'invalid_format' | 'empty_file' | 'invalid_data';
    message: string;
    line?: number;
    column?: string;
}
export interface ValidationWarning {
    type: 'unknown_variant' | 'missing_metadata' | 'data_quality';
    message: string;
    line?: number;
    column?: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface GeneSet {
    name: string;
    genes: string[];
    description?: string;
}
export interface MutationStats {
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
export type EventType = 'geneClick' | 'sampleClick' | 'cellClick' | 'dataLoaded' | 'error';
export interface OncoprintEvent {
    type: EventType;
    data: any;
}
