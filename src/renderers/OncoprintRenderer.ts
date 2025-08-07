import * as d3 from 'd3';
import { ProcessedData, ProcessedMutation, OncoprintConfig, MetadataTrackConfig } from '../types';
import { VariantColorManager, DEFAULT_VARIANT_COLORS } from '../core/VariantColorManager';
import { DataProcessor } from '../core/DataProcessor';
import { EventEmitter } from '../utils';

export interface RendererDimensions {
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  geneLabelWidth: number;
  sampleLabelHeight: number;
  metadataTrackHeight: number;
  legendWidth: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export class OncoprintRenderer extends EventEmitter {
  private container: HTMLElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private data: ProcessedData | null = null;
  private config: OncoprintConfig;
  private colorManager: VariantColorManager;
  private dimensions: RendererDimensions;
  private geneOrder: string[] = [];
  private sampleOrder: string[] = [];

  constructor(container: HTMLElement, config: OncoprintConfig = {}) {
    super();
    this.container = container;
    this.config = this.getDefaultConfig(config);
    this.colorManager = new VariantColorManager(this.config.variantColors);
    this.dimensions = this.calculateDimensions();
  }

  setData(data: ProcessedData): void {
    this.data = data;
    this.updateColorManager();
    this.updateOrdering();
    this.emit('dataLoaded', data);
  }

  updateConfig(config: Partial<OncoprintConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.variantColors) {
      this.colorManager = new VariantColorManager(config.variantColors);
      if (this.data) {
        this.updateColorManager();
      }
    }
    
    // Update ordering if sort configuration changed
    if (this.data && (config.sortGenes || config.sortSamples || config.customGeneOrder || config.splitBy)) {
      this.updateOrdering();
    }
    
    this.dimensions = this.calculateDimensions();
  }

  render(): void {
    if (!this.data) {
      throw new Error('No data available for rendering');
    }

    this.createSVG();
    this.renderMetadataTracks();
    this.renderGroupHeaders();
    this.renderMainMatrix();
    this.renderGeneLabels();
    this.renderSampleLabels();
    this.renderLegend();
    this.setupInteractions();
  }

  resize(width?: number, height?: number): void {
    if (width) this.dimensions.width = width;
    if (height) this.dimensions.height = height;
    this.dimensions = this.calculateDimensions();
    this.render();
  }

  exportSVG(): string {
    if (!this.svg) {
      throw new Error('No SVG available for export');
    }
    return new XMLSerializer().serializeToString(this.svg.node()!);
  }

  exportPNG(options?: { 
    backgroundColor?: string; 
    cropToContent?: boolean; 
    padding?: number;
    scale?: number;
  }): Promise<Blob> {
    const defaults = {
      backgroundColor: 'white',
      cropToContent: true,
      padding: 10,
      scale: 1
    };
    const opts = { ...defaults, ...options };

    return new Promise((resolve, reject) => {
      if (!this.data) {
        reject(new Error('No data available for export'));
        return;
      }

      // Create a temporary full-size SVG for export
      const exportSVG = this.createFullSizeExportSVG();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // console.log(`Export SVG dimensions: ${img.width} x ${img.height}`);
        
        // For export, use the full image dimensions
        let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;
        
        if (opts.cropToContent && opts.padding) {
          // Add padding around the content
          sourceX = Math.max(0, sourceX - opts.padding);
          sourceY = Math.max(0, sourceY - opts.padding);
          sourceWidth = Math.min(img.width - sourceX, sourceWidth + (2 * opts.padding));
          sourceHeight = Math.min(img.height - sourceY, sourceHeight + (2 * opts.padding));
        }
        
        // Apply scaling
        const finalWidth = Math.round(sourceWidth * opts.scale);
        const finalHeight = Math.round(sourceHeight * opts.scale);
        
        // console.log(`Final export dimensions: ${finalWidth} x ${finalHeight} (scale: ${opts.scale})`);
        
        // Set canvas to final size
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        
        // Fill with background color
        if (opts.backgroundColor && opts.backgroundColor !== 'transparent') {
          ctx.fillStyle = opts.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw the full image
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, finalWidth, finalHeight
        );
        
        canvas.toBlob((blob) => {
          if (blob) {
            // console.log(`PNG export successful: ${blob.size} bytes`);
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/png');
      };

      img.onerror = (error) => {
        console.error('Image loading failed:', error);
        reject(new Error('Failed to load SVG as image'));
      };
      
      // console.log('Starting PNG export with full-size SVG');
      img.src = 'data:image/svg+xml;base64,' + btoa(exportSVG);
    });
  }

  private createFullSizeExportSVG(): string {
    // Save current dimensions and temporarily switch to full-size
    const originalDimensions = { ...this.dimensions };
    
    // Calculate full-size dimensions for export
    const fullSizeCellWidth = this.config.cellWidth || 10;
    const fullSizeCellHeight = this.config.cellHeight || 20;
    
    const geneLabelWidth = this.config.geneLabels ? 120 : 0;
    const marginLeft = 20;
    const marginRight = 80;
    const marginTop = 20;
    const marginBottom = 80 + (this.config.sampleLabels ? 100 : 0);
    
    const matrixWidth = this.data?.sampleGroups && this.config.splitBy ? 
      this.getTotalWidthWithGaps(fullSizeCellWidth) : 
      this.sampleOrder.length * fullSizeCellWidth;
    
    const metadataTracksHeight = this.getMetadataTracksHeight();
    const matrixHeight = this.geneOrder.length * fullSizeCellHeight;
    
    let legendHeight = 0;
    if (this.config.legend) {
      legendHeight += 60;
      const metadataFields = this.getActiveMetadataTracks();
      if (metadataFields.length > 0) {
        legendHeight += metadataFields.length * 25;
      }
    }
    
    const fullWidth = marginLeft + geneLabelWidth + matrixWidth + marginRight;
    const fullHeight = marginTop + metadataTracksHeight + matrixHeight + 
                      (this.config.legend ? 30 + legendHeight : 0) + marginBottom;
    
    // Temporarily set full-size dimensions
    this.dimensions = {
      ...originalDimensions,
      width: fullWidth,
      height: fullHeight,
      cellWidth: fullSizeCellWidth,
      cellHeight: fullSizeCellHeight
    };
    
    // Create temporary SVG element in memory
    const tempContainer = document.createElement('div');
    const tempSVG = d3.select(tempContainer)
      .append('svg')
      .attr('width', fullWidth)
      .attr('height', fullHeight)
      .style('font-family', 'Arial, sans-serif')
      .style('font-size', '12px');
    
    // Store original SVG and temporarily switch
    const originalSVG = this.svg;
    this.svg = tempSVG;
    
    // Render all components to the temporary SVG
    this.renderMetadataTracks();
    this.renderGroupHeaders();
    this.renderMainMatrix();
    this.renderGeneLabels();
    this.renderSampleLabels();
    this.renderLegend();
    
    // Get the SVG string
    const svgString = new XMLSerializer().serializeToString(tempSVG.node()!);
    
    // Restore original SVG and dimensions
    this.svg = originalSVG;
    this.dimensions = originalDimensions;
    
    return svgString;
  }

  private getSampleXPosition(sampleIndex: number): number {
    if (!this.data?.sampleGroups || !this.config.splitBy) {
      // No splitting - use normal positioning
      return sampleIndex * this.dimensions.cellWidth;
    }

    const gapSize = this.config.splitBy.gapSize || 20;
    let x = 0;
    let currentIndex = 0;

    // Find which group this sample belongs to and calculate position
    for (const group of this.data.sampleGroups) {
      if (sampleIndex >= currentIndex && sampleIndex <= currentIndex + group.count - 1) {
        // Sample is in this group
        const indexInGroup = sampleIndex - currentIndex;
        return x + (indexInGroup * this.dimensions.cellWidth);
      }
      // Move to next group
      x += group.count * this.dimensions.cellWidth + gapSize;
      currentIndex += group.count;
    }

    // Fallback (shouldn't happen)
    return sampleIndex * this.dimensions.cellWidth;
  }

  private getTotalWidthWithGaps(cellWidth?: number): number {
    const actualCellWidth = cellWidth || this.dimensions.cellWidth;
    
    if (!this.data?.sampleGroups || !this.config.splitBy) {
      return this.sampleOrder.length * actualCellWidth;
    }

    const gapSize = this.config.splitBy.gapSize || 20;
    let totalWidth = 0;
    const sampleGroups = this.data.sampleGroups;

    sampleGroups.forEach((group, index) => {
      totalWidth += group.count * actualCellWidth;
      if (index < sampleGroups.length - 1) {
        totalWidth += gapSize; // Add gap except after last group
      }
    });

    return totalWidth;
  }

  private getContentBounds(): { x: number; y: number; width: number; height: number } {
    if (!this.data || this.sampleOrder.length === 0 || this.geneOrder.length === 0) {
      // Fallback to current SVG size if no data
      return { 
        x: 0, 
        y: 0, 
        width: this.dimensions.width || 200, 
        height: this.dimensions.height || 100 
      };
    }

    const padding = 15;

    // For PNG export, use full-size dimensions (not scaled to fit container)
    const fullSizeDimensions = this.calculateFullSizeDimensions();
    
    const includeGeneLabels = this.config.geneLabels ? 120 : 0; // Use fixed size for export
    const matrixWidth = this.data?.sampleGroups && this.config.splitBy ? 
      this.getTotalWidthWithGaps(fullSizeDimensions.cellWidth) : 
      this.sampleOrder.length * fullSizeDimensions.cellWidth;
    const includeFrequencies = this.config.showPercentages ? 80 : 0;
    const contentWidth = 20 + includeGeneLabels + matrixWidth + includeFrequencies + 80;

    const metadataTracksHeight = this.getMetadataTracksHeight();
    const matrixHeight = this.geneOrder.length * fullSizeDimensions.cellHeight;
    
    let legendHeight = 0;
    if (this.config.legend) {
      legendHeight += 60;
      const metadataFields = this.getActiveMetadataTracks();
      if (metadataFields.length > 0) {
        legendHeight += metadataFields.length * 30;
      }
    }
    
    const totalContentHeight = 20 + metadataTracksHeight + matrixHeight + 
                              (this.config.legend ? 30 + legendHeight : 0) + 80;

    const finalWidth = Math.max(contentWidth + (2 * padding), 400);
    const finalHeight = Math.max(totalContentHeight + (2 * padding), 300);

    return {
      x: 0,
      y: 0,
      width: finalWidth,
      height: finalHeight
    };
  }

  private calculateFullSizeDimensions(): { cellWidth: number; cellHeight: number } {
    // Return the original configured cell dimensions (not scaled)
    return {
      cellWidth: this.config.cellWidth || 10,
      cellHeight: this.config.cellHeight || 20
    };
  }

  private createSVG(): void {
    // Remove existing SVG
    d3.select(this.container).selectAll('svg').remove();

    // Create new SVG with exact dimensions needed
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.dimensions.width)
      .attr('height', this.dimensions.height)
      .style('font-family', 'Arial, sans-serif')
      .style('font-size', '12px')
      .style('display', 'block');
      
    // console.log(`Created SVG with dimensions: ${this.dimensions.width} x ${this.dimensions.height}`);
    // console.log(`Cell dimensions: ${this.dimensions.cellWidth} x ${this.dimensions.cellHeight}`);
    // console.log(`Container size: ${this.container.getBoundingClientRect().width} x ${this.container.getBoundingClientRect().height}`);
    
    // Log matrix dimensions for debugging
    if (this.data) {
      const matrixWidth = this.sampleOrder.length * this.dimensions.cellWidth;
      const matrixHeight = this.geneOrder.length * this.dimensions.cellHeight;
      // console.log(`Matrix dimensions: ${matrixWidth} x ${matrixHeight} (${this.sampleOrder.length} samples x ${this.geneOrder.length} genes)`);
    }
  }

  private renderMainMatrix(): void {
    if (!this.svg || !this.data) return;

    const matrixGroup = this.svg.append('g')
      .attr('class', 'oncoprint-matrix')
      .attr('transform', `translate(${this.dimensions.geneLabelWidth + this.dimensions.marginLeft}, ${this.dimensions.marginTop + this.getMetadataTracksHeight()})`);

    // Create mutation matrix
    const mutationMatrix = this.createMutationMatrix();

    // Render cells
    this.geneOrder.forEach((gene, geneIndex) => {
      this.sampleOrder.forEach((sample, sampleIndex) => {
        const mutation = mutationMatrix[gene][sample];
        const x = this.getSampleXPosition(sampleIndex) + 1;
        const y = (this.geneOrder.length - 1 - geneIndex) * this.dimensions.cellHeight + 1;

        if (!mutation) {
          // Empty cell
          matrixGroup.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', this.dimensions.cellWidth - 2)
            .attr('height', this.dimensions.cellHeight - 2)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', this.colorManager.getColor('Empty'))
            .attr('stroke', 'none')
            .attr('data-gene', gene)
            .attr('data-sample', sample)
            .style('cursor', 'pointer');
        } else if (Array.isArray(mutation)) {
          // Two mutations - split the cell
          const mutation1 = mutation[0];
          const mutation2 = mutation[1];
          const color1 = this.colorManager.getColor(mutation1.variantType);
          const color2 = this.colorManager.getColor(mutation2.variantType);
          
          // Top half
          const cell1 = matrixGroup.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', this.dimensions.cellWidth - 2)
            .attr('height', (this.dimensions.cellHeight - 2) / 2)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', color1)
            .attr('stroke', 'none')
            .attr('data-gene', gene)
            .attr('data-sample', sample)
            .attr('data-variant', mutation1.variantType)
            .style('cursor', 'pointer');
          
          // Create tooltip for first mutation
          let tooltip1 = `Gene: ${gene}\nSample: ${sample}\nVariant: ${mutation1.variantType}`;
          if (mutation1.proteinChange) {
            tooltip1 += `\nProtein Change: ${mutation1.proteinChange}`;
          }
          cell1.append('title').text(tooltip1);
          
          // Bottom half
          const cell2 = matrixGroup.append('rect')
            .attr('x', x)
            .attr('y', y + (this.dimensions.cellHeight - 2) / 2)
            .attr('width', this.dimensions.cellWidth - 2)
            .attr('height', (this.dimensions.cellHeight - 2) / 2)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', color2)
            .attr('stroke', 'none')
            .attr('data-gene', gene)
            .attr('data-sample', sample)
            .attr('data-variant', mutation2.variantType)
            .style('cursor', 'pointer');
          
          // Create tooltip for second mutation
          let tooltip2 = `Gene: ${gene}\nSample: ${sample}\nVariant: ${mutation2.variantType}`;
          if (mutation2.proteinChange) {
            tooltip2 += `\nProtein Change: ${mutation2.proteinChange}`;
          }
          cell2.append('title').text(tooltip2);
        } else {
          // Single mutation
          const color = this.colorManager.getColor(mutation.variantType);
          const cell = matrixGroup.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', this.dimensions.cellWidth - 2)
            .attr('height', this.dimensions.cellHeight - 2)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', color)
            .attr('stroke', 'none')
            .attr('data-gene', gene)
            .attr('data-sample', sample)
            .attr('data-variant', mutation.variantType)
            .style('cursor', 'pointer');

          // Create tooltip for single mutation
          let tooltip = `Gene: ${gene}\nSample: ${sample}\nVariant: ${mutation.variantType}`;
          if (mutation.proteinChange) {
            tooltip += `\nProtein Change: ${mutation.proteinChange}`;
          }
          cell.append('title').text(tooltip);
        }
      });
    });
  }

  private renderGeneLabels(): void {
    if (!this.svg || !this.data || !this.config.geneLabels) return;

    // Gene names on the left
    const labelGroup = this.svg.append('g')
      .attr('class', 'gene-labels')
      .attr('transform', `translate(${this.dimensions.marginLeft}, ${this.dimensions.marginTop + this.getMetadataTracksHeight()})`);

    // Frequency labels on the right
    const frequencyGroup = this.svg.append('g')
      .attr('class', 'gene-frequencies')
      .attr('transform', `translate(${this.dimensions.marginLeft + this.dimensions.geneLabelWidth + this.getTotalWidthWithGaps() + 10}, ${this.dimensions.marginTop + this.getMetadataTracksHeight()})`);

    this.geneOrder.forEach((gene, index) => {
      const y = (this.geneOrder.length - 1 - index) * this.dimensions.cellHeight + this.dimensions.cellHeight / 2;
      // Calculate frequency based on percentage calculation base (cohort or MAF-based)
      const mutatedSampleCount = new Set(
        this.data!.mutations
          .filter(m => m.gene === gene)
          .map(m => m.sample)
      ).size;
      const frequency = mutatedSampleCount / this.data!.percentageCalculationBase;
      
      // Gene name on the left
      labelGroup.append('text')
        .attr('x', this.dimensions.geneLabelWidth - 5)
        .attr('y', y)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .style('font-size', Math.min(12, this.dimensions.cellHeight * 0.8) + 'px')
        .style('cursor', 'pointer')
        .text(gene)
        .on('click', () => {
          this.emit('geneClick', { gene });
        });

      // Frequency on the right
      if (this.config.showPercentages) {
        frequencyGroup.append('text')
          .attr('x', 0)
          .attr('y', y)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'start')
          .style('font-size', '10px')
          .style('fill', '#666')
          .text(`${Math.round(frequency * 100)}%`);
      }
    });
  }

  private renderSampleLabels(): void {
    if (!this.svg || !this.data || !this.config.sampleLabels) return;

    const labelGroup = this.svg.append('g')
      .attr('class', 'sample-labels')
      .attr('transform', `translate(${this.dimensions.geneLabelWidth + this.dimensions.marginLeft}, ${this.dimensions.height - this.dimensions.marginBottom})`);

    this.sampleOrder.forEach((sample, index) => {
      const x = index * this.dimensions.cellWidth + this.dimensions.cellWidth / 2;
      
      labelGroup.append('text')
        .attr('x', x)
        .attr('y', -5)
        .attr('text-anchor', 'end')
        .attr('transform', `rotate(-45, ${x}, -5)`)
        .style('font-size', Math.min(10, this.dimensions.cellWidth * 0.8) + 'px')
        .style('cursor', 'pointer')
        .text(sample);
    });
  }

  private renderMetadataTracks(): void {
    if (!this.svg || !this.data) return;

    // Get active tracks - support both legacy and new configuration
    const activeTracks = this.getActiveMetadataTracks();
    if (!activeTracks.length) return;

    const tracksGroup = this.svg.append('g')
      .attr('class', 'metadata-tracks')
      .attr('transform', `translate(${this.dimensions.geneLabelWidth + this.dimensions.marginLeft}, ${this.dimensions.marginTop})`);

    let currentY = 0;
    activeTracks.forEach((trackConfig) => {
      if (!this.data!.metadata.fields.includes(trackConfig.field)) return;

      const trackHeight = trackConfig.height || this.dimensions.metadataTrackHeight;
      const trackSpacing = this.config.metadata?.trackSpacing || 3;
      
      this.renderSingleMetadataTrack(tracksGroup, trackConfig, currentY);
      
      // Add track label if enabled
      if (trackConfig.showLabels !== false && this.config.metadata?.showLabels !== false) {
        const label = trackConfig.label || trackConfig.field;
        this.svg!.append('text')
          .attr('x', this.dimensions.marginLeft + this.dimensions.geneLabelWidth - 5)
          .attr('y', this.dimensions.marginTop + currentY + trackHeight / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .style('font-size', '10px')
          .text(label);
      }

      currentY += trackHeight + trackSpacing;
    });
  }

  private getActiveMetadataTracks(): MetadataTrackConfig[] {
    // Support legacy configuration
    if (this.config.metadataFields?.length && !this.config.metadata?.tracks) {
      return this.config.metadataFields.map(field => ({
        field,
        visible: true,
        type: 'auto' as const,
        height: this.config.metadataTrackHeight
      }));
    }

    // Use new enhanced configuration
    if (this.config.metadata?.tracks) {
      return this.config.metadata.tracks
        .filter(track => track.visible !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return [];
  }

  private renderGroupHeaders(): void {
    if (!this.svg || !this.data?.sampleGroups || !this.config.splitBy) return;

    const showGroupHeaders = this.config.splitBy.showGroupHeaders !== false;
    const showGroupCounts = this.config.splitBy.showGroupCounts !== false;

    if (!showGroupHeaders && !showGroupCounts) return;

    const headerGroup = this.svg.append('g')
      .attr('class', 'group-headers')
      .attr('transform', `translate(${this.dimensions.geneLabelWidth + this.dimensions.marginLeft}, ${this.dimensions.marginTop + this.getMetadataTracksHeight() - 25})`);

    const sampleGroups = this.data.sampleGroups;
    
    sampleGroups.forEach((group, groupIndex) => {
      const groupStartX = this.getSampleXPosition(group.startIndex);
      const groupWidth = group.count * this.dimensions.cellWidth;
      const groupCenterX = groupStartX + groupWidth / 2;

      // Add group header text
      if (showGroupHeaders) {
        headerGroup.append('text')
          .attr('x', groupCenterX)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .style('fill', '#333')
          .text(group.value);
      }

      // Add sample count
      if (showGroupCounts) {
        headerGroup.append('text')
          .attr('x', groupCenterX)
          .attr('y', showGroupHeaders ? 15 : 0)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('font-size', '10px')
          .style('fill', '#666')
          .text(`(n=${group.count})`);
      }

      // Add separator line between groups (except for the last group)
      if (groupIndex < sampleGroups.length - 1) {
        const gapSize = this.config.splitBy!.gapSize || 20;
        const lineX = groupStartX + groupWidth + gapSize / 2;
        
        headerGroup.append('line')
          .attr('x1', lineX)
          .attr('y1', -10)
          .attr('x2', lineX)
          .attr('y2', 20)
          .attr('stroke', '#ddd')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');
      }
    });
  }

  private renderSingleMetadataTrack(container: any, trackConfig: MetadataTrackConfig, y: number): void {
    const field = trackConfig.field;
    const trackHeight = trackConfig.height || this.dimensions.metadataTrackHeight;
    
    // Determine field type
    const detectedType = this.data!.metadata.fieldTypes[field];
    const fieldType = trackConfig.type === 'auto' || !trackConfig.type ? detectedType : trackConfig.type;
    
    // Create color scale
    const colorScale = this.createColorScale(field, fieldType, trackConfig);

    this.sampleOrder.forEach((sample, sampleIndex) => {
      const value = this.data!.metadata.data[sample]?.[field];
      const x = this.getSampleXPosition(sampleIndex);

      let color = '#f0f0f0'; // Default for missing values
      let tooltip = '';

      if (value !== undefined) {
        if (trackConfig.customRenderer) {
          const result = trackConfig.customRenderer(value, sample);
          color = result.color;
          tooltip = result.tooltip || String(value);
        } else {
          if (fieldType === 'numerical' && typeof value === 'number') {
            color = colorScale(value);
          } else {
            color = colorScale(String(value));
          }
          tooltip = String(value);
        }
      }

      const rect = container.append('rect')
        .attr('x', x + 1)
        .attr('y', y + 1)
        .attr('width', this.dimensions.cellWidth - 2)
        .attr('height', trackHeight - 2)
        .attr('rx', 3)
        .attr('ry', 3)
        .attr('fill', color)
        .attr('stroke', 'none')
        .attr('data-field', field)
        .attr('data-sample', sample)
        .attr('data-value', value !== undefined ? String(value) : '');

      // Add tooltip if enabled
      if (trackConfig.tooltips !== false && this.config.tooltips !== false) {
        rect.append('title').text(`${trackConfig.label || field}: ${tooltip}`);
      }
    });
  }

  private createColorScale(field: string, fieldType: string, trackConfig: MetadataTrackConfig): any {
    if (fieldType === 'numerical') {
      // Get all available numerical values for this field (not just displayed samples)
      const allValues = Object.values(this.data!.metadata.data)
        .map(sampleData => sampleData?.[field])
        .filter(v => v !== undefined && typeof v === 'number') as number[];
      
      // Calculate domain from all data, not just displayed samples
      let extent = trackConfig.domain;
      if (!extent && allValues.length > 0) {
        extent = d3.extent(allValues) as [number, number];
        // Handle edge case where all values are the same
        if (extent[0] === extent[1]) {
          extent = [extent[0] - 1, extent[1] + 1];
        }
      }
      
      // Fallback if no valid domain can be calculated
      if (!extent || extent[0] === undefined || extent[1] === undefined) {
        extent = [0, 1];
      }
      
      // Handle different color scales
      let interpolator;
      switch (trackConfig.colorScale) {
        case 'viridis': interpolator = d3.interpolateViridis; break;
        case 'plasma': interpolator = d3.interpolatePlasma; break;
        case 'reds': interpolator = d3.interpolateReds; break;
        case 'greens': interpolator = d3.interpolateGreens; break;
        default: interpolator = d3.interpolateBlues; break;
      }
      
      return d3.scaleSequential(interpolator).domain(extent);
    } else {
      // Get all unique categorical values for this field (not just displayed samples)
      const allValues = Array.from(new Set(
        Object.values(this.data!.metadata.data)
          .map(sampleData => sampleData?.[field])
          .filter(v => v !== undefined)
          .map(v => String(v))
      ));

      if (trackConfig.colors) {
        if (Array.isArray(trackConfig.colors)) {
          return d3.scaleOrdinal(trackConfig.colors).domain(allValues);
        } else if (typeof trackConfig.colors === 'string') {
          // Handle string-based color scheme names (e.g., 'category10', 'category20')
          let colorScheme;
          switch (trackConfig.colors) {
            case 'category10': colorScheme = d3.schemeCategory10; break;
            case 'category20': colorScheme = d3.schemeCategory10.concat(d3.schemeCategory10); break;
            case 'pastel1': colorScheme = d3.schemePastel1; break;
            case 'set3': colorScheme = d3.schemeSet3; break;
            default: colorScheme = d3.schemeCategory10; break;
          }
          return d3.scaleOrdinal(colorScheme).domain(allValues);
        } else {
          // Record-based color mapping
          return (value: string) => (trackConfig.colors as Record<string, string>)[value] || '#bdc3c7';
        }
      }
      
      // Default categorical color scheme - use more colors for better distinction
      const defaultScheme = allValues.length <= 10 ? d3.schemeCategory10 : 
                           allValues.length <= 20 ? d3.schemeCategory10.concat(d3.schemePastel1) :
                           d3.schemeCategory10.concat(d3.schemePastel1).concat(d3.schemeSet3);
      
      return d3.scaleOrdinal(defaultScheme).domain(allValues);
    }
  }

  private renderLegend(): void {
    if (!this.svg || !this.data || !this.config.legend) return;

    const variants = Array.from(new Set(this.data.mutations.map(m => m.variantType)));
    const legend = this.colorManager.getColorLegend(variants);

    // Calculate legend position at bottom
    const matrixHeight = this.geneOrder.length * this.dimensions.cellHeight;
    const legendY = this.dimensions.marginTop + this.getMetadataTracksHeight() + matrixHeight + 30;
    
    const legendGroup = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${this.dimensions.marginLeft + this.dimensions.geneLabelWidth}, ${legendY})`);

    legendGroup.append('text')
      .attr('x', 0)
      .attr('y', 15)
      .style('font-weight', 'bold')
      .style('font-size', '12px')
      .text('Mutation Types');

    // Render legend items horizontally
    let currentX = 0;
    legend.forEach((item) => {
      const itemGroup = legendGroup.append('g')
        .attr('transform', `translate(${currentX}, 25)`);

      itemGroup.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', item.color);

      const text = itemGroup.append('text')
        .attr('x', 18)
        .attr('y', 6)
        .attr('dy', '0.35em')
        .style('font-size', '10px')
        .text(item.variant);

      if (!item.isKnown) {
        text.append('tspan')
          .style('font-size', '9px')
          .style('fill', '#666')
          .text(' (auto)');
      }

      // Calculate width for next item
      const textWidth = text.node()?.getBBox().width || 0;
      currentX += textWidth + 30 + 18; // rect + text + spacing
    });

    // Render metadata legends below mutation legend
    this.renderMetadataLegends(legendGroup, 60);
  }

  private renderMetadataLegends(parentGroup: any, yOffset: number): void {
    if (!this.data) return;

    const activeTracks = this.getActiveMetadataTracks();
    if (!activeTracks.length) return;

    let currentX = 0;
    const trackSpacing = 200; // Horizontal spacing between tracks

    activeTracks.forEach((trackConfig) => {
      const field = trackConfig.field;
      if (!this.data!.metadata.fields.includes(field)) return;

      const detectedType = this.data!.metadata.fieldTypes[field];
      const fieldType = trackConfig.type === 'auto' || !trackConfig.type ? detectedType : trackConfig.type;
      const label = trackConfig.label || field;

      // Add track title
      parentGroup.append('text')
        .attr('x', currentX)
        .attr('y', yOffset + 15)
        .style('font-weight', 'bold')
        .style('font-size', '11px')
        .text(label);

      if (fieldType === 'categorical') {
        const width = this.renderCategoricalMetadataLegend(parentGroup, trackConfig, currentX, yOffset + 25);
        currentX += Math.max(width, trackSpacing);
      } else {
        this.renderNumericalMetadataLegend(parentGroup, trackConfig, currentX, yOffset + 25);
        currentX += trackSpacing;
      }
    });
  }

  private renderCategoricalMetadataLegend(parentGroup: any, trackConfig: MetadataTrackConfig, startX: number, y: number): number {
    const field = trackConfig.field;
    
    // Only get values that are actually present in the displayed samples
    const displayedSamples = this.sampleOrder;
    const values = Array.from(new Set(
      displayedSamples
        .map(sample => this.data!.metadata.data[sample]?.[field])
        .filter(v => v !== undefined)
        .map(v => String(v))
    ));

    if (!values.length) return 0;

    const colorScale = this.createColorScale(field, 'categorical', trackConfig);
    
    // Arrange in multiple columns for efficient space usage
    const maxWidth = 180; // Maximum width per track
    const itemSpacing = 5;
    let currentX = 0;
    let currentY = 0;
    let maxUsedWidth = 0;

    values.forEach((value) => {
      const color = colorScale(value);
      
      const itemGroup = parentGroup.append('g')
        .attr('transform', `translate(${startX + currentX}, ${y + currentY})`);

      itemGroup.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 8)
        .attr('height', 8)
        .attr('rx', 1)
        .attr('ry', 1)
        .attr('fill', color);

      const text = itemGroup.append('text')
        .attr('x', 12)
        .attr('y', 4)
        .attr('dy', '0.35em')
        .style('font-size', '9px')
        .text(value);

      const textWidth = text.node()?.getBBox().width || 0;
      const itemWidth = textWidth + 12 + itemSpacing;
      
      // Check if we need to wrap to next row
      if (currentX + itemWidth > maxWidth && currentX > 0) {
        currentY += 18;
        currentX = 0;
        // Re-position this item
        itemGroup.attr('transform', `translate(${startX + currentX}, ${y + currentY})`);
      }
      
      currentX += itemWidth;
      maxUsedWidth = Math.max(maxUsedWidth, currentX);
    });

    return Math.min(maxUsedWidth, maxWidth);
  }

  private renderNumericalMetadataLegend(parentGroup: any, trackConfig: MetadataTrackConfig, startX: number, y: number): void {
    const field = trackConfig.field;
    
    // Only get values that are actually present in the displayed samples
    const displayedSamples = this.sampleOrder;
    const values = displayedSamples
      .map(sample => this.data!.metadata.data[sample]?.[field])
      .filter(v => v !== undefined && typeof v === 'number') as number[];
    
    if (!values.length) return;

    const extent = trackConfig.domain || (d3.extent(values) as [number, number]);
    const colorScale = this.createColorScale(field, 'numerical', trackConfig);

    // Create gradient
    const gradientId = `gradient-${field}`;
    const defs = parentGroup.select('defs').empty() ? 
      parentGroup.append('defs') : parentGroup.select('defs');
    
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '100%');

    // Add gradient stops
    for (let i = 0; i <= 10; i++) {
      const value = extent[0] + (extent[1] - extent[0]) * (i / 10);
      gradient.append('stop')
        .attr('offset', `${i * 10}%`)
        .attr('stop-color', colorScale(value));
    }

    // Render gradient bar
    parentGroup.append('rect')
      .attr('x', startX)
      .attr('y', y)
      .attr('width', 80)
      .attr('height', 10)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', `url(#${gradientId})`);

    // Add min/max labels
    parentGroup.append('text')
      .attr('x', startX)
      .attr('y', y + 22)
      .style('font-size', '8px')
      .text(extent[0].toFixed(1));

    parentGroup.append('text')
      .attr('x', startX + 80)
      .attr('y', y + 22)
      .attr('text-anchor', 'end')
      .style('font-size', '8px')
      .text(extent[1].toFixed(1));
  }

  private setupInteractions(): void {
    if (!this.svg || !this.data) return;

    // Cell interactions
    this.svg.selectAll('.oncoprint-matrix rect')
      .on('click', (event) => {
        const element = event.target as SVGRectElement;
        const gene = element.getAttribute('data-gene')!;
        const sample = element.getAttribute('data-sample')!;
        const variant = element.getAttribute('data-variant');
        
        this.emit('cellClick', { gene, sample, variant });
      })
      .on('mouseenter', () => {
        if (!this.config.tooltips) return;
        // Tooltip implementation would go here
      });

    // Gene label interactions
    this.svg.selectAll('.gene-labels text')
      .on('click', (event) => {
        const gene = (event.target as SVGTextElement).textContent!;
        this.emit('geneClick', { gene });
      });

    // Sample label interactions
    this.svg.selectAll('.sample-labels text')
      .on('click', (event) => {
        const sample = (event.target as SVGTextElement).textContent!;
        this.emit('sampleClick', { sample });
      });
  }

  private updateColorManager(): void {
    if (!this.data) return;
    
    const variants = Array.from(new Set(this.data.mutations.map(m => m.variantType)));
    variants.forEach(variant => {
      this.colorManager.getColor(variant);
    });
  }

  private updateOrdering(): void {
    if (!this.data) return;

    // Update gene order - default to top 25 most frequently mutated genes
    switch (this.config.sortGenes) {
      case 'frequency':
        this.geneOrder = DataProcessor.sortGenesByFrequency(this.data, true, 25).reverse();
        break;
      case 'alphabetical': {
        const limitedGenes = DataProcessor.sortGenesByFrequency(this.data, true, 25);
        this.geneOrder = limitedGenes.sort();
        break;
      }
      case 'custom':
        this.geneOrder = this.config.customGeneOrder?.filter(g => this.data!.genes.includes(g)) || 
                        DataProcessor.sortGenesByFrequency(this.data, true, 25).reverse();
        break;
      default:
        this.geneOrder = DataProcessor.sortGenesByFrequency(this.data, true, 25).reverse();
    }

    // Update sample order - apply split with current sort settings if enabled
    if (this.config.splitBy?.field) {
      // Re-apply split with current sort configuration to ensure proper ordering within groups
      this.data = DataProcessor.applySplitBy(
        this.data, 
        this.config.splitBy.field,
        this.config.sortSamples,
        this.config.customSampleOrder,
        this.geneOrder
      );
      this.sampleOrder = [...this.data.samples];
    } else {
      // Normal sorting when no split is active
      switch (this.config.sortSamples) {
        case 'mutation_load':
          this.sampleOrder = DataProcessor.sortSamplesByMutationLoad(this.data, true);
          break;
        case 'alphabetical':
          this.sampleOrder = [...this.data.samples].sort();
          break;
        case 'custom':
          this.sampleOrder = this.config.customSampleOrder?.filter(s => this.data!.samples.includes(s)) || this.data.samples;
          break;
        case 'oncoprint':
          this.sampleOrder = DataProcessor.sortSamplesForOncoprint(this.data, this.geneOrder);
          break;
        default:
          // Default to oncoprint clustering for best visual effect
          this.sampleOrder = DataProcessor.sortSamplesForOncoprint(this.data, this.geneOrder).reverse();
      }
    }
  }

  private createMutationMatrix(): Record<string, Record<string, ProcessedMutation | ProcessedMutation[] | null>> {
    return DataProcessor.getMutationMatrix(this.data!);
  }

  private calculateDimensions(): RendererDimensions {
    const containerRect = this.container.getBoundingClientRect();
    const availableWidth = containerRect.width || 1000;
    const availableHeight = containerRect.height || 700;

    // If we have data, calculate what dimensions we need and scale to fit if necessary
    if (this.data && this.geneOrder.length > 0 && this.sampleOrder.length > 0) {
      let cellWidth = this.config.cellWidth || 10;
      let cellHeight = this.config.cellHeight || 20;
      
      const geneLabelWidth = this.config.geneLabels ? 120 : 0;
      const marginLeft = 20;
      const marginRight = 80; // Space for frequency labels on right
      const marginTop = 20;
      
      // Calculate matrix width including gaps for split visualization
      const matrixWidth = this.data?.sampleGroups && this.config.splitBy ? 
        this.getTotalWidthWithGaps() : 
        this.sampleOrder.length * cellWidth;
      
      // Calculate metadata tracks height
      const metadataTracksHeight = this.getMetadataTracksHeight();
      
      // Calculate matrix height
      const matrixHeight = this.geneOrder.length * cellHeight;
      
      // Calculate legend height
      let legendHeight = 0;
      if (this.config.legend) {
        legendHeight += 60; // Base legend height
        const metadataFields = this.getActiveMetadataTracks();
        if (metadataFields.length > 0) {
          legendHeight += metadataFields.length * 25;
        }
      }
      
      // Calculate required dimensions
      const marginBottom = 80 + (this.config.sampleLabels ? 100 : 0);
      const requiredWidth = marginLeft + geneLabelWidth + matrixWidth + marginRight;
      const requiredHeight = marginTop + metadataTracksHeight + matrixHeight + 
                            (this.config.legend ? 30 + legendHeight : 0) + marginBottom;
      
      // Calculate scaling factors to fit content in available space
      const widthScale = availableWidth / requiredWidth;
      const heightScale = availableHeight / requiredHeight;
      const scale = Math.min(widthScale, heightScale, 1); // Don't scale up, only down
      
      // Apply scaling to cell dimensions if we need to scale down
      if (scale < 1) {
        cellWidth = Math.max(1, cellWidth * scale); // Minimum cell width of 1px
        cellHeight = Math.max(1, cellHeight * scale); // Minimum cell height of 1px
        
        // console.log(`Scaling visualization by ${scale.toFixed(2)} to fit container`);
        // console.log(`Container: ${availableWidth} x ${availableHeight}, Required: ${requiredWidth} x ${requiredHeight}`);
        // console.log(`Original cell size: ${this.config.cellWidth || 10} x ${this.config.cellHeight || 20}`);
        // console.log(`Scaled cell size: ${cellWidth} x ${cellHeight}`);
        // console.log(`Sample count: ${this.sampleOrder.length}, Gene count: ${this.geneOrder.length}`);
      }
      
      // Recalculate with scaled cell dimensions
      const scaledMatrixWidth = this.data?.sampleGroups && this.config.splitBy ? 
        this.getTotalWidthWithGaps(cellWidth) : 
        this.sampleOrder.length * cellWidth;
      const scaledMatrixHeight = this.geneOrder.length * cellHeight;
      
      const finalWidth = Math.min(availableWidth, marginLeft + geneLabelWidth + scaledMatrixWidth + marginRight);
      const finalHeight = Math.min(availableHeight, marginTop + metadataTracksHeight + scaledMatrixHeight + 
                                  (this.config.legend ? 30 + legendHeight : 0) + marginBottom);
      
      return {
        width: finalWidth,
        height: finalHeight,
        cellWidth,
        cellHeight,
        geneLabelWidth: this.config.geneLabels ? 120 : 0,
        sampleLabelHeight: this.config.sampleLabels ? 100 : 0,
        metadataTrackHeight: this.config.metadataTrackHeight || 15,
        legendWidth: 0,
        marginTop: 20,
        marginRight: 80,
        marginBottom: 80 + (this.config.sampleLabels ? 100 : 0),
        marginLeft: 20
      };
    }

    return {
      width: availableWidth,
      height: availableHeight,
      cellWidth: this.config.cellWidth || 10,
      cellHeight: this.config.cellHeight || 20,
      geneLabelWidth: this.config.geneLabels ? 120 : 0,
      sampleLabelHeight: this.config.sampleLabels ? 100 : 0,
      metadataTrackHeight: this.config.metadataTrackHeight || 15,
      legendWidth: 0,
      marginTop: 20,
      marginRight: 80,
      marginBottom: 80 + (this.config.sampleLabels ? 100 : 0),
      marginLeft: 20
    };
  }

  private getMetadataTracksHeight(): number {
    const activeTracks = this.getActiveMetadataTracks();
    let totalHeight = 0;
    const trackSpacing = this.config.metadata?.trackSpacing || 3;
    
    // Add height for metadata tracks
    activeTracks.forEach((track, index) => {
      const trackHeight = track.height || this.dimensions.metadataTrackHeight;
      totalHeight += trackHeight;
      if (index < activeTracks.length - 1) {
        totalHeight += trackSpacing;
      }
    });
    
    // Add extra gap between metadata and main matrix
    if (activeTracks.length > 0) {
      totalHeight += 10;
    }
    
    // Add height for group headers if split is enabled
    if (this.data?.sampleGroups && this.config.splitBy) {
      const showGroupHeaders = this.config.splitBy.showGroupHeaders !== false;
      const showGroupCounts = this.config.splitBy.showGroupCounts !== false;
      
      if (showGroupHeaders || showGroupCounts) {
        let headerHeight = 0;
        if (showGroupHeaders) headerHeight += 15;
        if (showGroupCounts) headerHeight += 15;
        totalHeight += headerHeight + 10; // Add some padding
      }
    }
    
    return totalHeight;
  }

  private getDefaultConfig(config: OncoprintConfig): OncoprintConfig {
    return {
      geneList: config.geneList || [],
      sampleList: config.sampleList || [],
      cellWidth: config.cellWidth || 10,
      cellHeight: config.cellHeight || 20,
      geneLabels: config.geneLabels !== false,
      sampleLabels: config.sampleLabels || false,
      variantColors: config.variantColors || DEFAULT_VARIANT_COLORS,
      metadataFields: config.metadataFields || [],
      metadataTrackHeight: config.metadataTrackHeight || 15,
      sortGenes: config.sortGenes || 'frequency',
      sortSamples: config.sortSamples || 'oncoprint', // Default to oncoprint clustering
      customGeneOrder: config.customGeneOrder || [],
      customSampleOrder: config.customSampleOrder || [],
      tooltips: config.tooltips !== false,
      exportable: config.exportable !== false,
      resizable: config.resizable !== false,
      showPercentages: config.showPercentages !== false, // Show percentages by default
      showTotals: config.showTotals || false,
      legend: config.legend !== false,
      metadata: config.metadata || { tracks: [] }
    };
  }

  // Runtime API methods for metadata track management
  public addMetadataTrack(trackConfig: MetadataTrackConfig): void {
    if (!this.config.metadata) {
      this.config.metadata = { tracks: [] };
    }
    if (!this.config.metadata.tracks) {
      this.config.metadata.tracks = [];
    }
    
    // Remove existing track with same field if any
    this.config.metadata.tracks = this.config.metadata.tracks.filter(t => t.field !== trackConfig.field);
    
    // Add new track
    this.config.metadata.tracks.push({ visible: true, ...trackConfig });
    
    this.render();
  }

  public removeMetadataTrack(fieldName: string): void {
    if (this.config.metadata?.tracks) {
      this.config.metadata.tracks = this.config.metadata.tracks.filter(t => t.field !== fieldName);
      this.render();
    }
  }

  public updateMetadataTrack(fieldName: string, updates: Partial<MetadataTrackConfig>): void {
    if (this.config.metadata?.tracks) {
      const trackIndex = this.config.metadata.tracks.findIndex(t => t.field === fieldName);
      if (trackIndex >= 0) {
        this.config.metadata.tracks[trackIndex] = { 
          ...this.config.metadata.tracks[trackIndex], 
          ...updates 
        };
        this.render();
      }
    }
  }

  public showMetadataTrack(fieldName: string): void {
    this.updateMetadataTrack(fieldName, { visible: true });
  }

  public hideMetadataTrack(fieldName: string): void {
    this.updateMetadataTrack(fieldName, { visible: false });
  }

  public reorderMetadataTracks(fieldOrder: string[]): void {
    if (this.config.metadata?.tracks) {
      const orderedTracks: MetadataTrackConfig[] = [];
      
      fieldOrder.forEach((field, index) => {
        const track = this.config.metadata!.tracks!.find(t => t.field === field);
        if (track) {
          orderedTracks.push({ ...track, order: index });
        }
      });
      
      // Add any tracks not in fieldOrder at the end
      this.config.metadata.tracks.forEach(track => {
        if (!fieldOrder.includes(track.field)) {
          orderedTracks.push({ ...track, order: fieldOrder.length });
        }
      });
      
      this.config.metadata.tracks = orderedTracks;
      this.render();
    }
  }

  public getMetadataConfig(): MetadataTrackConfig[] {
    return this.config.metadata?.tracks || [];
  }

  public setMetadataConfig(tracks: MetadataTrackConfig[]): void {
    if (!this.config.metadata) {
      this.config.metadata = {};
    }
    this.config.metadata.tracks = tracks;
    this.render();
  }

  public getAvailableMetadataFields(): string[] {
    return this.data?.metadata.fields || [];
  }
}