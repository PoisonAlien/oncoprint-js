import { MetadataRow, ValidationResult, ValidationError, ValidationWarning } from '../types';

export type FieldTypeMap = Record<string, 'categorical' | 'numerical'>;

export class MetadataParser {
  static async parseFromFile(file: File): Promise<MetadataRow[]> {
    const content = await this.readFileContent(file);
    return this.parseFromString(content, this.detectDelimiter(content));
  }

  static parseFromString(content: string, delimiter: string = '\t'): MetadataRow[] {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const data: MetadataRow[] = [];

    // Check if Tumor_Sample_Barcode column exists
    if (!headers.includes('Tumor_Sample_Barcode')) {
      throw new Error('Metadata file must contain "Tumor_Sample_Barcode" column');
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      if (values.length !== headers.length) {
        console.warn(`Line ${i + 1} has ${values.length} columns but expected ${headers.length}`);
        continue;
      }

      const row: any = {};
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        if (value && value !== '') {
          // Try to parse as number
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && isFinite(numValue)) {
            row[header] = numValue;
          } else {
            row[header] = value;
          }
        }
      });

      if (row.Tumor_Sample_Barcode) {
        data.push(row as MetadataRow);
      }
    }

    return data;
  }

  static async parseFromUrl(url: string): Promise<MetadataRow[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata file from ${url}: ${response.statusText}`);
    }
    const content = await response.text();
    return this.parseFromString(content, this.detectDelimiter(content));
  }

  static detectFieldTypes(data: MetadataRow[]): FieldTypeMap {
    if (data.length === 0) return {};

    const fieldTypes: FieldTypeMap = {};
    const fields = Object.keys(data[0]);

    fields.forEach(field => {
      if (field === 'Tumor_Sample_Barcode') {
        fieldTypes[field] = 'categorical';
        return;
      }

      const values = data.map(row => row[field]).filter(v => v !== undefined && v !== null);
      const numericValues = values.filter(v => typeof v === 'number');
      
      // If more than 80% of values are numeric and we have enough unique values, treat as numerical
      const isNumeric = numericValues.length / values.length > 0.8;
      const uniqueValues = new Set(values);
      
      // Categorical if fewer than 20 unique values or if most values are strings
      if (uniqueValues.size < 20 || !isNumeric) {
        fieldTypes[field] = 'categorical';
      } else {
        fieldTypes[field] = 'numerical';
      }
    });

    return fieldTypes;
  }

  static validateMetadata(data: MetadataRow[], mafSamples?: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (data.length === 0) {
      errors.push({
        type: 'empty_file',
        message: 'No valid metadata found'
      });
      return { isValid: false, errors, warnings };
    }

    // Check for required sample barcode column
    const firstRow = data[0];
    if (!('Tumor_Sample_Barcode' in firstRow)) {
      errors.push({
        type: 'missing_column',
        message: 'Required column "Tumor_Sample_Barcode" is missing',
        column: 'Tumor_Sample_Barcode'
      });
    }

    // If MAF samples are provided, check for overlap
    if (mafSamples && mafSamples.length > 0) {
      const metadataSamples = new Set(data.map(row => row.Tumor_Sample_Barcode));
      const mafSampleSet = new Set(mafSamples);
      
      const overlap = mafSamples.filter(sample => metadataSamples.has(sample));
      const overlapPercentage = overlap.length / mafSamples.length;

      if (overlapPercentage < 0.5) {
        warnings.push({
          type: 'missing_metadata',
          message: `Only ${Math.round(overlapPercentage * 100)}% of MAF samples have metadata`
        });
      }

      const uniqueToMetadata = Array.from(metadataSamples).filter(sample => !mafSampleSet.has(sample));
      if (uniqueToMetadata.length > 0) {
        warnings.push({
          type: 'missing_metadata',
          message: `${uniqueToMetadata.length} samples in metadata not found in MAF data`
        });
      }
    }

    console.log(`Parsed metadata for ${data.length} samples`);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private static detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    
    return tabCount > commaCount ? '\t' : ',';
  }
}