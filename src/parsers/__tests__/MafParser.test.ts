import { MafParser } from '../MafParser';

describe('MafParser', () => {
  it('should validate required columns', () => {
    const mockData = [
      {
        Hugo_Symbol: 'TP53',
        Tumor_Sample_Barcode: 'Sample_1',
        Variant_Classification: 'Missense_Mutation'
      }
    ];
    
    const result = MafParser.validateMafData(mockData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required columns', () => {
    const mockData = [
      {
        Hugo_Symbol: 'TP53'
        // Missing Tumor_Sample_Barcode and Variant_Classification
      }
    ];
    
    const result = MafParser.validateMafData(mockData);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
  
  it('should parse MAF data from string', () => {
    const mafContent = `Hugo_Symbol\tTumor_Sample_Barcode\tVariant_Classification
TP53\tSample_1\tMissense_Mutation
KRAS\tSample_2\tNonsense_Mutation`;
    
    const result = MafParser.parseFromString(mafContent);
    expect(result).toHaveLength(2);
    expect(result[0].Hugo_Symbol).toBe('TP53');
    expect(result[1].Hugo_Symbol).toBe('KRAS');
  });
});