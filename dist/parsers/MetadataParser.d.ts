import { MetadataRow, ValidationResult } from '../types';
export type FieldTypeMap = Record<string, 'categorical' | 'numerical'>;
export declare class MetadataParser {
    static parseFromFile(file: File): Promise<MetadataRow[]>;
    static parseFromString(content: string, delimiter?: string): MetadataRow[];
    static parseFromUrl(url: string): Promise<MetadataRow[]>;
    static detectFieldTypes(data: MetadataRow[]): FieldTypeMap;
    static validateMetadata(data: MetadataRow[], mafSamples?: string[]): ValidationResult;
    private static readFileContent;
    private static detectDelimiter;
}
