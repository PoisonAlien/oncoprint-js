import { MafData, ValidationResult, ValidationError, ValidationWarning } from '../types';

export class MafParser {
  private static readonly REQUIRED_COLUMNS = [
    'Hugo_Symbol',
    'Tumor_Sample_Barcode',
    'Variant_Classification'
  ];

  private static readonly OPTIONAL_COLUMNS = [
    'Protein_Change',
    'Chromosome',
    'Start_Position',
    'End_Position'
  ];

  static async parseFromFile(file: File): Promise<MafData[]> {
    const content = await this.readFileContent(file);
    return this.parseFromString(content, this.detectDelimiter(content));
  }

  static parseFromString(content: string, delimiter: string = '\t'): MafData[] {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const data: MafData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      if (values.length !== headers.length) {
        // console.warn(`Line ${i + 1} has ${values.length} columns but expected ${headers.length}`);
        continue;
      }

      const row: any = {};
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        if (value && value !== '') {
          if (header === 'Start_Position' || header === 'End_Position') {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              row[header] = numValue;
            }
          } else {
            row[header] = value;
          }
        }
      });

      if (row.Hugo_Symbol && row.Tumor_Sample_Barcode && row.Variant_Classification) {
        data.push(row as MafData);
      }
    }

    return data;
  }

  static async parseFromUrl(url: string): Promise<MafData[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch MAF file from ${url}: ${response.statusText}`);
    }
    const content = await response.text();
    return this.parseFromString(content, this.detectDelimiter(content));
  }

  static validateMafData(data: MafData[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (data.length === 0) {
      errors.push({
        type: 'empty_file',
        message: 'No valid MAF data found'
      });
      return { isValid: false, errors, warnings };
    }

    // Check for required columns
    const firstRow = data[0];
    this.REQUIRED_COLUMNS.forEach(column => {
      if (!(column in firstRow)) {
        errors.push({
          type: 'missing_column',
          message: `Required column '${column}' is missing`,
          column
        });
      }
    });

    // Check data quality
    const variantTypes = new Set<string>();
    const genes = new Set<string>();
    const samples = new Set<string>();

    data.forEach((row, index) => {
      if (!row.Hugo_Symbol) {
        warnings.push({
          type: 'data_quality',
          message: `Missing gene symbol at row ${index + 1}`,
          line: index + 1
        });
      } else {
        genes.add(row.Hugo_Symbol);
      }

      if (!row.Tumor_Sample_Barcode) {
        warnings.push({
          type: 'data_quality',
          message: `Missing sample barcode at row ${index + 1}`,
          line: index + 1
        });
      } else {
        samples.add(row.Tumor_Sample_Barcode);
      }

      if (row.Variant_Classification) {
        variantTypes.add(row.Variant_Classification);
      }
    });

    // Warn about unknown variant types
    const knownVariants = new Set([
      'Missense_Mutation', 'Splice_Site', 'Frame_Shift_Del', 'Frame_Shift_Ins',
      'In_Frame_Del', 'In_Frame_Ins', 'Nonsense_Mutation', 'Multi_Hit',
      'Translation_Start_Site', 'Nonstop_Mutation'
    ]);

    variantTypes.forEach(variant => {
      if (!knownVariants.has(variant)) {
        warnings.push({
          type: 'unknown_variant',
          message: `Unknown variant classification: ${variant}`
        });
      }
    });

    // console.log(`Parsed ${data.length} mutations across ${genes.size} genes and ${samples.size} samples`);

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