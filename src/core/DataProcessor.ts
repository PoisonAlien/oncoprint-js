import { 
  MafData, 
  MetadataRow, 
  ProcessedData, 
  ProcessedMutation, 
  ProcessedMetadata,
  CohortInfo,
  SampleGroup
} from '../types';
import { MetadataParser, FieldTypeMap } from '../parsers';

export class DataProcessor {
  static processData(maf: MafData[], metadata?: MetadataRow[], cohortInfo?: CohortInfo): ProcessedData {
    // Extract unique genes and samples
    const genes = Array.from(new Set(maf.map(row => row.Hugo_Symbol))).sort();
    const mafSamples = Array.from(new Set(maf.map(row => row.Tumor_Sample_Barcode))).sort();
    
    // Determine sample list and percentage calculation base
    let samples: string[];
    let percentageCalculationBase: number;
    let processedCohortInfo: ProcessedData['cohortInfo'];
    
    if (cohortInfo) {
      if (cohortInfo.samples) {
        // Full cohort sample list provided
        samples = cohortInfo.samples.slice().sort();
        percentageCalculationBase = cohortInfo.samples.length;
        const missingSamples = cohortInfo.samples.filter(s => !mafSamples.includes(s));
        processedCohortInfo = {
          totalSamples: cohortInfo.samples.length,
          providedSamples: cohortInfo.samples,
          missingSamples: missingSamples
        };
      } else if (cohortInfo.totalSamples) {
        // Only total count provided - use MAF samples for visualization but cohort count for percentages
        samples = mafSamples;
        percentageCalculationBase = cohortInfo.totalSamples;
        processedCohortInfo = {
          totalSamples: cohortInfo.totalSamples,
          providedSamples: undefined,
          missingSamples: []
        };
      } else {
        // Invalid cohort info - fall back to MAF-based
        samples = mafSamples;
        percentageCalculationBase = mafSamples.length;
      }
    } else {
      // Default: MAF-based calculation
      samples = mafSamples;
      percentageCalculationBase = mafSamples.length;
    }

    // Process mutations
    const mutations: ProcessedMutation[] = maf.map(row => ({
      gene: row.Hugo_Symbol,
      sample: row.Tumor_Sample_Barcode,
      variantType: row.Variant_Classification,
      proteinChange: row.Protein_Change,
      chromosome: row.Chromosome,
      startPosition: row.Start_Position,
      endPosition: row.End_Position
    }));

    // Calculate gene mutation counts
    const geneCounts: Record<string, number> = {};
    genes.forEach(gene => {
      geneCounts[gene] = mutations.filter(m => m.gene === gene).length;
    });

    // Calculate sample mutation counts
    const sampleCounts: Record<string, number> = {};
    samples.forEach(sample => {
      sampleCounts[sample] = mutations.filter(m => m.sample === sample).length;
    });

    // Process metadata
    let processedMetadata: ProcessedMetadata = {
      fields: [],
      data: {},
      fieldTypes: {}
    };

    if (metadata && metadata.length > 0) {
      const fieldTypes = MetadataParser.detectFieldTypes(metadata);
      const fields = Object.keys(fieldTypes).filter(f => f !== 'Tumor_Sample_Barcode');
      
      const metadataData: Record<string, Record<string, string | number>> = {};
      metadata.forEach(row => {
        if (samples.includes(row.Tumor_Sample_Barcode)) {
          metadataData[row.Tumor_Sample_Barcode] = { ...row };
          delete metadataData[row.Tumor_Sample_Barcode].Tumor_Sample_Barcode;
        }
      });

      processedMetadata = {
        fields,
        data: metadataData,
        fieldTypes
      };
    }

    return {
      genes,
      samples,
      mutations,
      geneCounts,
      sampleCounts,
      metadata: processedMetadata,
      percentageCalculationBase,
      cohortInfo: processedCohortInfo
      // sampleGroups will be added by DataProcessor.applySplitBy() if needed
    };
  }

  static filterByGenes(data: ProcessedData, genes: string[]): ProcessedData {
    const filteredGenes = data.genes.filter(gene => genes.includes(gene));
    const filteredMutations = data.mutations.filter(m => genes.includes(m.gene));
    
    const geneCounts: Record<string, number> = {};
    filteredGenes.forEach(gene => {
      geneCounts[gene] = filteredMutations.filter(m => m.gene === gene).length;
    });

    return {
      ...data,
      genes: filteredGenes,
      mutations: filteredMutations,
      geneCounts
    };
  }

  static filterBySamples(data: ProcessedData, samples: string[]): ProcessedData {
    const filteredSamples = data.samples.filter(sample => samples.includes(sample));
    const filteredMutations = data.mutations.filter(m => samples.includes(m.sample));
    
    const sampleCounts: Record<string, number> = {};
    filteredSamples.forEach(sample => {
      sampleCounts[sample] = filteredMutations.filter(m => m.sample === sample).length;
    });

    // Filter metadata
    const filteredMetadata = { ...data.metadata };
    const newMetadataData: Record<string, Record<string, string | number>> = {};
    filteredSamples.forEach(sample => {
      if (data.metadata.data[sample]) {
        newMetadataData[sample] = data.metadata.data[sample];
      }
    });
    filteredMetadata.data = newMetadataData;

    return {
      ...data,
      samples: filteredSamples,
      mutations: filteredMutations,
      sampleCounts,
      metadata: filteredMetadata
    };
  }

  static sortGenesByFrequency(data: ProcessedData, descending: boolean = true, maxGenes?: number): string[] {
    // Calculate unique sample counts per gene (not total mutation counts)
    const geneFrequencies: Record<string, number> = {};
    data.genes.forEach(gene => {
      const uniqueSamples = new Set(
        data.mutations
          .filter(m => m.gene === gene)
          .map(m => m.sample)
      );
      geneFrequencies[gene] = uniqueSamples.size;
    });

    let sortedGenes = [...data.genes].sort((a, b) => {
      const freqA = geneFrequencies[a] || 0;
      const freqB = geneFrequencies[b] || 0;
      return descending ? freqB - freqA : freqA - freqB;
    });

    // Limit to top N genes if specified
    if (maxGenes && maxGenes > 0) {
      sortedGenes = sortedGenes.slice(0, maxGenes);
    }

    return sortedGenes;
  }

  static sortSamplesByMutationLoad(data: ProcessedData, descending: boolean = true): string[] {
    return [...data.samples].sort((a, b) => {
      const countA = data.sampleCounts[a] || 0;
      const countB = data.sampleCounts[b] || 0;
      return descending ? countB - countA : countA - countB;
    });
  }

  static sortSamplesForOncoprint(data: ProcessedData, sortedGenes: string[]): string[] {
    // Iterative reordering algorithm for oncoprint clustering
    let orderedSamples = [...data.samples];

    // Create mutation lookup for efficiency
    const geneMutationInfo: Record<string, Record<string, boolean>> = {};
    sortedGenes.forEach(gene => {
      geneMutationInfo[gene] = {};
      data.mutations
        .filter(m => m.gene === gene)
        .forEach(m => {
          geneMutationInfo[gene][m.sample] = true;
        });
    });

    // For each gene (in sorted order), reorder samples
    for (const gene of sortedGenes) {
      const mutatedSamples: string[] = [];
      const unmutatedSamples: string[] = [];

      orderedSamples.forEach(sample => {
        if (geneMutationInfo[gene][sample]) {
          mutatedSamples.push(sample);
        } else {
          unmutatedSamples.push(sample);
        }
      });

      // Reorder: mutated first, then unmutated
      orderedSamples = [...mutatedSamples, ...unmutatedSamples];
    }

    return orderedSamples;
  }

  static sortSamplesByMetadata(
    data: ProcessedData, 
    field: string, 
    ascending: boolean = true
  ): string[] {
    if (!data.metadata.fields.includes(field)) {
      console.warn(`Metadata field '${field}' not found`);
      return data.samples;
    }

    return [...data.samples].sort((a, b) => {
      const valueA = data.metadata.data[a]?.[field];
      const valueB = data.metadata.data[b]?.[field];

      if (valueA === undefined && valueB === undefined) return 0;
      if (valueA === undefined) return 1;
      if (valueB === undefined) return -1;

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return ascending ? valueA - valueB : valueB - valueA;
      }

      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      
      if (ascending) {
        return strA < strB ? -1 : strA > strB ? 1 : 0;
      } else {
        return strA > strB ? -1 : strA < strB ? 1 : 0;
      }
    });
  }

  static getMutationMatrix(data: ProcessedData): Record<string, Record<string, ProcessedMutation | ProcessedMutation[] | null>> {
    const matrix: Record<string, Record<string, ProcessedMutation | ProcessedMutation[] | null>> = {};
    
    // Initialize empty matrix
    data.genes.forEach(gene => {
      matrix[gene] = {};
      data.samples.forEach(sample => {
        matrix[gene][sample] = null;
      });
    });

    // Group mutations by gene-sample pair
    const mutationGroups: Record<string, Record<string, ProcessedMutation[]>> = {};
    data.mutations.forEach(mutation => {
      if (!mutationGroups[mutation.gene]) {
        mutationGroups[mutation.gene] = {};
      }
      if (!mutationGroups[mutation.gene][mutation.sample]) {
        mutationGroups[mutation.gene][mutation.sample] = [];
      }
      mutationGroups[mutation.gene][mutation.sample].push(mutation);
    });

    // Fill matrix with single mutations or arrays for multiple mutations
    Object.keys(mutationGroups).forEach(gene => {
      Object.keys(mutationGroups[gene]).forEach(sample => {
        const mutations = mutationGroups[gene][sample];
        if (mutations.length === 1) {
          matrix[gene][sample] = mutations[0];
        } else if (mutations.length === 2) {
          matrix[gene][sample] = mutations;
        } else if (mutations.length > 2) {
          // Create Multi_Hit mutation
          matrix[gene][sample] = {
            gene: mutations[0].gene,
            sample: mutations[0].sample,
            variantType: 'Multi_Hit',
            proteinChange: `${mutations.length} mutations`
          };
        }
      });
    });

    return matrix;
  }

  static calculateMutationFrequencies(data: ProcessedData): Record<string, number> {
    const frequencies: Record<string, number> = {};
    // Use the percentage calculation base (cohort-based or MAF-based)
    const totalSamples = data.percentageCalculationBase;

    data.genes.forEach(gene => {
      const mutatedSamples = new Set(
        data.mutations
          .filter(m => m.gene === gene)
          .map(m => m.sample)
      );
      frequencies[gene] = mutatedSamples.size / totalSamples;
    });

    return frequencies;
  }

  static getVariantTypes(data: ProcessedData): string[] {
    return Array.from(new Set(data.mutations.map(m => m.variantType))).sort();
  }

  static applySplitBy(
    data: ProcessedData, 
    splitField: string,
    sortMethod: 'mutation_load' | 'alphabetical' | 'custom' | 'oncoprint' = 'oncoprint',
    customSampleOrder?: string[],
    geneOrder?: string[]
  ): ProcessedData {
    // Check if the split field exists in metadata
    if (!data.metadata.fields.includes(splitField)) {
      console.warn(`Split field '${splitField}' not found in metadata. Ignoring split.`);
      return data;
    }

    // Group samples by the split field value
    const groupMap = new Map<string, string[]>();
    
    data.samples.forEach(sample => {
      const value = data.metadata.data[sample]?.[splitField];
      const groupKey = value?.toString() || 'Unknown';
      
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(sample);
    });

    // Sort groups by their names for consistent ordering
    const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    // Create SampleGroup objects with position information
    const sampleGroups: SampleGroup[] = [];
    let currentIndex = 0;

    sortedGroups.forEach(([value, groupSamples]) => {
      // Sort samples within each group using the specified sorting method
      const sortedGroupSamples = this.sortSamplesWithinGroup(
        groupSamples, 
        data, 
        sortMethod, 
        customSampleOrder,
        geneOrder
      );
      
      sampleGroups.push({
        value,
        samples: sortedGroupSamples,
        count: sortedGroupSamples.length,
        startIndex: currentIndex,
        endIndex: currentIndex + sortedGroupSamples.length - 1
      });

      currentIndex += sortedGroupSamples.length;
    });

    // Create new sample order by concatenating all groups
    const newSampleOrder: string[] = [];
    sampleGroups.forEach(group => {
      newSampleOrder.push(...group.samples);
    });

    return {
      ...data,
      samples: newSampleOrder,
      sampleGroups
    };
  }

  private static sortSamplesWithinGroup(
    samples: string[], 
    data: ProcessedData,
    sortMethod: 'mutation_load' | 'alphabetical' | 'custom' | 'oncoprint' = 'oncoprint',
    customSampleOrder?: string[],
    geneOrder?: string[]
  ): string[] {
    // Create a subset of data containing only the samples in this group
    const groupData: ProcessedData = {
      ...data,
      samples: samples,
      mutations: data.mutations.filter(m => samples.includes(m.sample)),
      sampleCounts: Object.fromEntries(
        samples.map(sample => [sample, data.sampleCounts[sample] || 0])
      ),
      metadata: {
        ...data.metadata,
        data: Object.fromEntries(
          samples.map(sample => [sample, data.metadata.data[sample] || {}])
        )
      }
    };

    // Apply the specified sorting method within this group
    switch (sortMethod) {
      case 'mutation_load':
        return this.sortSamplesByMutationLoad(groupData, true);
      case 'alphabetical':
        return [...samples].sort();
      case 'custom':
        if (customSampleOrder) {
          // Filter custom order to only include samples in this group, maintaining order
          const customFiltered = customSampleOrder.filter(s => samples.includes(s));
          // Add any remaining samples in this group that weren't in the custom order
          const remaining = samples.filter(s => !customSampleOrder.includes(s));
          return [...customFiltered, ...remaining];
        }
        return samples;
      case 'oncoprint':
      default:
        // Get the most frequently mutated genes for this group for clustering
        const topGenes = geneOrder || this.sortGenesByFrequency(groupData, true, Math.min(25, data.genes.length));
        // Apply oncoprint clustering within this group
        return this.sortSamplesForOncoprint(groupData, topGenes);
    }
  }

  static getCoOccurrenceMatrix(data: ProcessedData): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};
    
    // Initialize matrix
    data.genes.forEach(gene1 => {
      matrix[gene1] = {};
      data.genes.forEach(gene2 => {
        matrix[gene1][gene2] = 0;
      });
    });

    // Calculate co-occurrences
    data.samples.forEach(sample => {
      const sampleMutations = data.mutations
        .filter(m => m.sample === sample)
        .map(m => m.gene);
      
      // Count co-occurrences for this sample
      for (let i = 0; i < sampleMutations.length; i++) {
        for (let j = i; j < sampleMutations.length; j++) {
          const gene1 = sampleMutations[i];
          const gene2 = sampleMutations[j];
          matrix[gene1][gene2]++;
          if (gene1 !== gene2) {
            matrix[gene2][gene1]++;
          }
        }
      }
    });

    return matrix;
  }
}