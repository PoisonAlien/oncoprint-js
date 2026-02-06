import { MafData, ValidationResult } from '../types';
export declare class MafParser {
    private static readonly REQUIRED_COLUMNS;
    private static readonly OPTIONAL_COLUMNS;
    static parseFromFile(file: File): Promise<MafData[]>;
    static parseFromString(content: string, delimiter?: string): MafData[];
    static parseFromUrl(url: string): Promise<MafData[]>;
    static validateMafData(data: MafData[]): ValidationResult;
    private static readFileContent;
    private static detectDelimiter;
}
