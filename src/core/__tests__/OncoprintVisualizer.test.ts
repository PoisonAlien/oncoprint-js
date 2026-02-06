import { DataProcessor } from '../DataProcessor';
import { MafData, MetadataRow } from '../../types';

describe('DataProcessor', () => {
  describe('Issue #1: Processing mafData and metadataData together', () => {
    // Exact data from issue #1
    const mafData: MafData[] = [
      {
        Hugo_Symbol: 'TP53',
        Tumor_Sample_Barcode: 'Sample_1',
        Variant_Classification: 'Missense_Mutation'
      },
      {
        Hugo_Symbol: 'BRCA1',
        Tumor_Sample_Barcode: 'Sample_2',
        Variant_Classification: 'Missense_Mutation'
      },
      {
        Hugo_Symbol: 'BRCA2',
        Tumor_Sample_Barcode: 'Sample_3',
        Variant_Classification: 'Missense_Mutation'
      },
    ];

    const metadataData: MetadataRow[] = [
      {
        Tumor_Sample_Barcode: 'Sample_1',
        Diagnosis_Event: 'Diagnosis_Event_1',
      },
      {
        Tumor_Sample_Barcode: 'Sample_2',
        Diagnosis_Event: 'Diagnosis_Event_2',
      },
      {
        Tumor_Sample_Barcode: 'Sample_3',
        Diagnosis_Event: 'Diagnosis_Event_3',
      },
    ];

    it('should process mafData correctly', () => {
      const result = DataProcessor.processData(mafData);

      // Verify genes are extracted correctly
      expect(result.genes).toHaveLength(3);
      expect(result.genes).toContain('TP53');
      expect(result.genes).toContain('BRCA1');
      expect(result.genes).toContain('BRCA2');

      // Verify samples are extracted correctly
      expect(result.samples).toHaveLength(3);
      expect(result.samples).toContain('Sample_1');
      expect(result.samples).toContain('Sample_2');
      expect(result.samples).toContain('Sample_3');

      // Verify mutations are processed correctly
      expect(result.mutations).toHaveLength(3);
      expect(result.mutations[0]).toMatchObject({
        gene: expect.any(String),
        sample: expect.any(String),
        variantType: 'Missense_Mutation'
      });

      // Verify gene counts
      expect(result.geneCounts['TP53']).toBe(1);
      expect(result.geneCounts['BRCA1']).toBe(1);
      expect(result.geneCounts['BRCA2']).toBe(1);

      // Verify sample counts
      expect(result.sampleCounts['Sample_1']).toBe(1);
      expect(result.sampleCounts['Sample_2']).toBe(1);
      expect(result.sampleCounts['Sample_3']).toBe(1);

      // Verify percentage calculation base
      expect(result.percentageCalculationBase).toBe(3);
    });

    it('should process mafData with metadataData correctly', () => {
      const result = DataProcessor.processData(mafData, metadataData);

      // Verify basic data is still correct
      expect(result.genes).toHaveLength(3);
      expect(result.samples).toHaveLength(3);
      expect(result.mutations).toHaveLength(3);

      // Verify metadata fields are detected
      expect(result.metadata.fields).toContain('Diagnosis_Event');

      // Verify metadata field type detection
      expect(result.metadata.fieldTypes['Diagnosis_Event']).toBe('categorical');

      // Verify metadata data is correctly associated with samples
      expect(result.metadata.data['Sample_1']).toBeDefined();
      expect(result.metadata.data['Sample_1']['Diagnosis_Event']).toBe('Diagnosis_Event_1');

      expect(result.metadata.data['Sample_2']).toBeDefined();
      expect(result.metadata.data['Sample_2']['Diagnosis_Event']).toBe('Diagnosis_Event_2');

      expect(result.metadata.data['Sample_3']).toBeDefined();
      expect(result.metadata.data['Sample_3']['Diagnosis_Event']).toBe('Diagnosis_Event_3');
    });

    it('should create valid mutation matrix', () => {
      const result = DataProcessor.processData(mafData, metadataData);
      const matrix = DataProcessor.getMutationMatrix(result);

      // Verify matrix structure
      expect(matrix['TP53']).toBeDefined();
      expect(matrix['BRCA1']).toBeDefined();
      expect(matrix['BRCA2']).toBeDefined();

      // Verify correct mutations are in the matrix
      expect(matrix['TP53']['Sample_1']).toBeDefined();
      expect(matrix['TP53']['Sample_1']).toMatchObject({ variantType: 'Missense_Mutation' });

      expect(matrix['BRCA1']['Sample_2']).toBeDefined();
      expect(matrix['BRCA1']['Sample_2']).toMatchObject({ variantType: 'Missense_Mutation' });

      expect(matrix['BRCA2']['Sample_3']).toBeDefined();
      expect(matrix['BRCA2']['Sample_3']).toMatchObject({ variantType: 'Missense_Mutation' });

      // Verify empty cells are null
      expect(matrix['TP53']['Sample_2']).toBeNull();
      expect(matrix['TP53']['Sample_3']).toBeNull();
      expect(matrix['BRCA1']['Sample_1']).toBeNull();
    });

    it('should sort genes by frequency correctly', () => {
      const result = DataProcessor.processData(mafData, metadataData);
      const sortedGenes = DataProcessor.sortGenesByFrequency(result, true);

      // All genes have frequency 1, so order should be alphabetical or stable
      expect(sortedGenes).toHaveLength(3);
      expect(sortedGenes).toContain('TP53');
      expect(sortedGenes).toContain('BRCA1');
      expect(sortedGenes).toContain('BRCA2');
    });

    it('should sort samples by mutation load correctly', () => {
      const result = DataProcessor.processData(mafData, metadataData);
      const sortedSamples = DataProcessor.sortSamplesByMutationLoad(result, true);

      // All samples have 1 mutation, so order should be stable
      expect(sortedSamples).toHaveLength(3);
      expect(sortedSamples).toContain('Sample_1');
      expect(sortedSamples).toContain('Sample_2');
      expect(sortedSamples).toContain('Sample_3');
    });

    it('should sort samples by metadata field correctly', () => {
      const result = DataProcessor.processData(mafData, metadataData);
      const sortedSamples = DataProcessor.sortSamplesByMetadata(result, 'Diagnosis_Event', true);

      // Should be sorted alphabetically by Diagnosis_Event value
      expect(sortedSamples).toHaveLength(3);
      expect(sortedSamples[0]).toBe('Sample_1'); // Diagnosis_Event_1
      expect(sortedSamples[1]).toBe('Sample_2'); // Diagnosis_Event_2
      expect(sortedSamples[2]).toBe('Sample_3'); // Diagnosis_Event_3
    });

    it('should handle the complete data processing flow without errors', () => {
      // This test ensures no exceptions are thrown during the full processing flow
      expect(() => {
        const result = DataProcessor.processData(mafData, metadataData);

        // Perform all operations that would happen during rendering
        DataProcessor.getMutationMatrix(result);
        DataProcessor.sortGenesByFrequency(result, true);
        DataProcessor.sortSamplesByMutationLoad(result, true);
        DataProcessor.sortSamplesByMetadata(result, 'Diagnosis_Event', true);
        DataProcessor.sortSamplesForOncoprint(result, result.genes);
      }).not.toThrow();
    });
  });


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