import { DataProcessor } from '../DataProcessor';

describe('DataProcessor', () => {
  it('should process MAF data correctly', () => {
    const mockMafData = [
      {
        Hugo_Symbol: 'TP53',
        Tumor_Sample_Barcode: 'Sample_1',
        Variant_Classification: 'Missense_Mutation'
      },
      {
        Hugo_Symbol: 'KRAS',
        Tumor_Sample_Barcode: 'Sample_2',
        Variant_Classification: 'Nonsense_Mutation'
      }
    ];

    const result = DataProcessor.processData(mockMafData);
    expect(result.genes).toContain('TP53');
    expect(result.genes).toContain('KRAS');
    expect(result.samples).toContain('Sample_1');
    expect(result.samples).toContain('Sample_2');
    expect(result.mutations).toHaveLength(2);
  });

  it('should sort genes by frequency', () => {
    const mockMafData = [
      { Hugo_Symbol: 'TP53', Tumor_Sample_Barcode: 'Sample_1', Variant_Classification: 'Missense_Mutation' },
      { Hugo_Symbol: 'TP53', Tumor_Sample_Barcode: 'Sample_2', Variant_Classification: 'Missense_Mutation' },
      { Hugo_Symbol: 'KRAS', Tumor_Sample_Barcode: 'Sample_1', Variant_Classification: 'Nonsense_Mutation' }
    ];

    const processedData = DataProcessor.processData(mockMafData);
    const sortedGenes = DataProcessor.sortGenesByFrequency(processedData, true);
    
    expect(sortedGenes[0]).toBe('TP53'); // Most frequent first
    expect(sortedGenes[1]).toBe('KRAS');
  });
});