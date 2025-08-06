import { MafParser } from '../MafParser';

describe('MafParser', () => {
  it('should validate required columns', () => {
    const parser = new MafParser();
    const mockData = [
      {
        Hugo_Symbol: 'TP53',
        Tumor_Sample_Barcode: 'Sample_1',
        Variant_Classification: 'Missense_Mutation'
      }
    ];
    
    const result = parser.validate(mockData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required columns', () => {
    const parser = new MafParser();
    const mockData = [
      {
        Hugo_Symbol: 'TP53',
        // Missing required columns
      }
    ];
    
    const result = parser.validate(mockData);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});