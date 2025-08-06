import { MafData, MetadataRow, ProcessedData, ProcessedMutation, CohortInfo } from '../types';
export declare class DataProcessor {
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
