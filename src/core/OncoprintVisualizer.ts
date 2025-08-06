import { 
  MafData, 
  MetadataRow, 
  ProcessedData, 
  OncoprintConfig,
  ValidationResult,
  MetadataTrackConfig,
  CohortInfo
} from '../types';
import { MafParser, MetadataParser } from '../parsers';
import { DataProcessor } from './DataProcessor';
import { OncoprintRenderer } from '../renderers';
import { EventEmitter } from '../utils';

export class OncoprintVisualizer extends EventEmitter {
  private container: HTMLElement;
  private renderer: OncoprintRenderer;
  private processedData: ProcessedData | null = null;
  private rawMafData: MafData[] = [];
  private rawMetadataData: MetadataRow[] = [];
  private cohortInfo?: CohortInfo;
  private config: OncoprintConfig;

  constructor(container: HTMLElement, config: OncoprintConfig = {}) {
    super();
    this.container = container;
    this.config = config;
    this.renderer = new OncoprintRenderer(container, config);
    this.setupRendererEvents();
  }

  // Data loading methods
  async loadMafFile(file: File): Promise<ValidationResult> {
    try {
      const mafData = await MafParser.parseFromFile(file);
      const validation = MafParser.validateMafData(mafData);
      
      if (validation.isValid) {
        await this.loadMafData(mafData);
      }
      
      return validation;
    } catch (error) {
      const validationResult: ValidationResult = {
        isValid: false,
        errors: [{
          type: 'invalid_format',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }],
        warnings: []
      };
      this.emit('error', error);
      return validationResult;
    }
  }

  async loadMafData(data: MafData[], cohortInfo?: CohortInfo): Promise<void> {
    try {
      this.rawMafData = [...data]; // Store original data
      this.cohortInfo = cohortInfo; // Store cohort information
      this.reprocessData();
      this.emit('dataLoaded', this.processedData);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async loadMetadataFile(file: File): Promise<ValidationResult> {
    try {
      const metadataData = await MetadataParser.parseFromFile(file);
      const mafSamples = this.processedData?.samples;
      const validation = MetadataParser.validateMetadata(metadataData, mafSamples);
      
      if (validation.isValid) {
        await this.loadMetadataData(metadataData);
      }
      
      return validation;
    } catch (error) {
      const validationResult: ValidationResult = {
        isValid: false,
        errors: [{
          type: 'invalid_format',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }],
        warnings: []
      };
      this.emit('error', error);
      return validationResult;
    }
  }

  async loadMetadataData(data: MetadataRow[]): Promise<void> {
    try {
      if (this.rawMafData.length === 0) {
        throw new Error('MAF data must be loaded before metadata');
      }

      this.rawMetadataData = [...data]; // Store original metadata
      this.reprocessData();
      this.emit('dataLoaded', this.processedData);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Rendering methods
  render(): void {
    if (!this.processedData) {
      throw new Error('No data available for rendering. Load MAF data first.');
    }
    this.renderer.render();
  }

  update(config?: Partial<OncoprintConfig>): void {
    if (config) {
      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...config };
      this.renderer.updateConfig(config);
      
      // Check if we need to reprocess data due to filtering or split changes
      const splitChanged = 'splitBy' in config && (
        JSON.stringify(config.splitBy) !== JSON.stringify(oldConfig.splitBy)
      );
      const needsReprocessing = this.rawMafData.length > 0 && (
        config.geneList !== undefined ||
        config.sampleList !== undefined ||
        splitChanged
      );
      
      if (needsReprocessing) {
        this.reprocessData();
      }
    }
    this.render();
  }

  resize(width?: number, height?: number): void {
    this.renderer.resize(width, height);
  }

  // Export methods
  exportSVG(): string {
    return this.renderer.exportSVG();
  }

  async exportPNG(options?: { 
    backgroundColor?: string; 
    cropToContent?: boolean; 
    padding?: number;
    scale?: number;
  }): Promise<Blob> {
    return this.renderer.exportPNG(options);
  }

  exportData(): ProcessedData {
    if (!this.processedData) {
      throw new Error('No data available for export');
    }
    return { ...this.processedData }; // Return a copy
  }

  // Selection methods
  getSelectedGenes(): string[] {
    return this.config.geneList || [];
  }

  getSelectedSamples(): string[] {
    return this.config.sampleList || [];
  }

  setGeneSelection(genes: string[]): void {
    this.update({ geneList: genes });
  }

  setSampleSelection(samples: string[]): void {
    this.update({ sampleList: samples });
  }

  // Utility methods
  getAvailableGenes(): string[] {
    return this.processedData?.genes || [];
  }

  getAllGenes(): string[] {
    // Return all genes from the original data, not just the filtered ones
    if (this.rawMafData.length === 0) return [];
    const allGenes = [...new Set(this.rawMafData.map(row => row.Hugo_Symbol))];
    return allGenes.sort();
  }

  getAvailableSamples(): string[] {
    return this.processedData?.samples || [];
  }

  getAllSamples(): string[] {
    // Return all samples from the cohort if provided, otherwise from MAF data
    if (this.cohortInfo?.samples) {
      return this.cohortInfo.samples.slice();
    }
    // Fall back to MAF-based samples
    if (this.rawMafData.length === 0) return [];
    const allSamples = [...new Set(this.rawMafData.map(row => row.Tumor_Sample_Barcode))];
    return allSamples.sort();
  }

  getPercentageCalculationBase(): number {
    // Return the base used for percentage calculations
    return this.processedData?.percentageCalculationBase || 0;
  }

  getCohortInfo(): { totalSamples: number; hasCohortInfo: boolean; missingSamples?: string[] } {
    if (this.cohortInfo) {
      return {
        totalSamples: this.cohortInfo.totalSamples || this.cohortInfo.samples?.length || 0,
        hasCohortInfo: true,
        missingSamples: this.processedData?.cohortInfo?.missingSamples
      };
    }
    return {
      totalSamples: this.getAllSamples().length,
      hasCohortInfo: false
    };
  }

  getMetadataFields(): string[] {
    return this.processedData?.metadata.fields || [];
  }

  getVariantTypes(): string[] {
    if (!this.processedData) return [];
    return Array.from(new Set(this.processedData.mutations.map(m => m.variantType))).sort();
  }

  getMutationStats(): {
    totalMutations: number;
    totalGenes: number;
    totalSamples: number;
    averageMutationsPerSample: number;
    averageMutationsPerGene: number;
  } {
    if (!this.processedData) {
      return {
        totalMutations: 0,
        totalGenes: 0,
        totalSamples: 0,
        averageMutationsPerSample: 0,
        averageMutationsPerGene: 0
      };
    }

    const { mutations, genes, samples } = this.processedData;
    
    return {
      totalMutations: mutations.length,
      totalGenes: genes.length,
      totalSamples: samples.length,
      averageMutationsPerSample: mutations.length / samples.length,
      averageMutationsPerGene: mutations.length / genes.length
    };
  }

  // Configuration methods
  setConfig(config: OncoprintConfig): void {
    this.config = config;
    this.renderer.updateConfig(config);
  }

  getConfig(): OncoprintConfig {
    return { ...this.config };
  }

  // Sorting methods
  sortGenesByFrequency(descending: boolean = true): void {
    if (!this.processedData) return;
    
    const sortedGenes = DataProcessor.sortGenesByFrequency(this.processedData, descending);
    this.update({ 
      sortGenes: 'custom',
      customGeneOrder: sortedGenes 
    });
  }

  sortSamplesByMutationLoad(descending: boolean = true): void {
    if (!this.processedData) return;
    
    const sortedSamples = DataProcessor.sortSamplesByMutationLoad(this.processedData, descending);
    this.update({ 
      sortSamples: 'custom',
      customSampleOrder: sortedSamples 
    });
  }

  sortSamplesByMetadata(field: string, ascending: boolean = true): void {
    if (!this.processedData) return;
    
    const sortedSamples = DataProcessor.sortSamplesByMetadata(this.processedData, field, ascending);
    this.update({ 
      sortSamples: 'custom',
      customSampleOrder: sortedSamples 
    });
  }

  // Filter methods
  filterByMutationFrequency(minFrequency: number, maxFrequency: number = 1): void {
    if (!this.processedData) return;
    
    const frequencies = DataProcessor.calculateMutationFrequencies(this.processedData);
    const filteredGenes = this.processedData.genes.filter(gene => {
      const freq = frequencies[gene];
      return freq >= minFrequency && freq <= maxFrequency;
    });
    
    this.update({ geneList: filteredGenes });
  }

  filterByMutationCount(minCount: number, maxCount?: number): void {
    if (!this.processedData) return;
    
    const filteredGenes = this.processedData.genes.filter(gene => {
      const count = this.processedData!.geneCounts[gene];
      return count >= minCount && (maxCount === undefined || count <= maxCount);
    });
    
    this.update({ geneList: filteredGenes });
  }

  // Private methods
  private setupRendererEvents(): void {
    this.renderer.on('cellClick', (data) => this.emit('cellClick', data));
    this.renderer.on('geneClick', (data) => this.emit('geneClick', data));
    this.renderer.on('sampleClick', (data) => this.emit('sampleClick', data));
    this.renderer.on('dataLoaded', (data) => this.emit('dataLoaded', data));
    this.renderer.on('error', (error) => this.emit('error', error));
  }

  private applyDataFilters(data: MafData[]): MafData[] {
    let filteredData = [...data];

    // Filter by genes if specified
    if (this.config.geneList && this.config.geneList.length > 0) {
      filteredData = filteredData.filter(row => 
        this.config.geneList!.includes(row.Hugo_Symbol)
      );
    }

    // Filter by samples if specified
    if (this.config.sampleList && this.config.sampleList.length > 0) {
      filteredData = filteredData.filter(row => 
        this.config.sampleList!.includes(row.Tumor_Sample_Barcode)
      );
    }

    return filteredData;
  }

  private reprocessData(): void {
    if (this.rawMafData.length === 0) {
      throw new Error('No MAF data available for reprocessing');
    }

    const filteredData = this.applyDataFilters(this.rawMafData);
    const metadataToUse = this.rawMetadataData.length > 0 ? this.rawMetadataData : undefined;
    // Pass cohort information for percentage calculation and missing sample handling
    this.processedData = DataProcessor.processData(filteredData, metadataToUse, this.cohortInfo);
    
    // Apply split grouping if configured
    if (this.config.splitBy?.field) {
      this.processedData = DataProcessor.applySplitBy(
        this.processedData, 
        this.config.splitBy.field,
        this.config.sortSamples,
        this.config.customSampleOrder,
        undefined // geneOrder will be determined later in updateOrdering
      );
    }
    
    this.renderer.setData(this.processedData);
  }

  private reconstructMafData(): MafData[] {
    if (!this.processedData) return [];
    
    return this.processedData.mutations.map(mutation => ({
      Hugo_Symbol: mutation.gene,
      Tumor_Sample_Barcode: mutation.sample,
      Variant_Classification: mutation.variantType,
      Protein_Change: mutation.proteinChange,
      Chromosome: mutation.chromosome,
      Start_Position: mutation.startPosition,
      End_Position: mutation.endPosition
    }));
  }

  // Metadata track management methods
  public addMetadataTrack(trackConfig: MetadataTrackConfig): void {
    this.renderer.addMetadataTrack(trackConfig);
  }

  public removeMetadataTrack(fieldName: string): void {
    this.renderer.removeMetadataTrack(fieldName);
  }

  public updateMetadataTrack(fieldName: string, updates: Partial<MetadataTrackConfig>): void {
    this.renderer.updateMetadataTrack(fieldName, updates);
  }

  public showMetadataTrack(fieldName: string): void {
    this.renderer.showMetadataTrack(fieldName);
  }

  public hideMetadataTrack(fieldName: string): void {
    this.renderer.hideMetadataTrack(fieldName);
  }

  public reorderMetadataTracks(fieldOrder: string[]): void {
    this.renderer.reorderMetadataTracks(fieldOrder);
  }

  public getMetadataConfig(): MetadataTrackConfig[] {
    return this.renderer.getMetadataConfig();
  }

  public setMetadataConfig(tracks: MetadataTrackConfig[]): void {
    this.renderer.setMetadataConfig(tracks);
  }

  public getAvailableMetadataFields(): string[] {
    return this.renderer.getAvailableMetadataFields();
  }

  // Cleanup
  destroy(): void {
    this.removeAllListeners();
    this.renderer.removeAllListeners();
    
    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}