import * as d3 from 'd3';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';

class MafParser {
    static async parseFromFile(file) {
        const content = await this.readFileContent(file);
        return this.parseFromString(content, this.detectDelimiter(content));
    }
    static parseFromString(content, delimiter = '\t') {
        const lines = content.trim().split('\n');
        if (lines.length === 0) {
            throw new Error('File is empty');
        }
        const headers = lines[0].split(delimiter).map(h => h.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(delimiter);
            if (values.length !== headers.length) {
                console.warn(`Line ${i + 1} has ${values.length} columns but expected ${headers.length}`);
                continue;
            }
            const row = {};
            headers.forEach((header, index) => {
                const value = values[index]?.trim();
                if (value && value !== '') {
                    if (header === 'Start_Position' || header === 'End_Position') {
                        const numValue = parseInt(value, 10);
                        if (!isNaN(numValue)) {
                            row[header] = numValue;
                        }
                    }
                    else {
                        row[header] = value;
                    }
                }
            });
            if (row.Hugo_Symbol && row.Tumor_Sample_Barcode && row.Variant_Classification) {
                data.push(row);
            }
        }
        return data;
    }
    static async parseFromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch MAF file from ${url}: ${response.statusText}`);
        }
        const content = await response.text();
        return this.parseFromString(content, this.detectDelimiter(content));
    }
    static validateMafData(data) {
        const errors = [];
        const warnings = [];
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
        const variantTypes = new Set();
        const genes = new Set();
        const samples = new Set();
        data.forEach((row, index) => {
            if (!row.Hugo_Symbol) {
                warnings.push({
                    type: 'data_quality',
                    message: `Missing gene symbol at row ${index + 1}`,
                    line: index + 1
                });
            }
            else {
                genes.add(row.Hugo_Symbol);
            }
            if (!row.Tumor_Sample_Barcode) {
                warnings.push({
                    type: 'data_quality',
                    message: `Missing sample barcode at row ${index + 1}`,
                    line: index + 1
                });
            }
            else {
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
        console.log(`Parsed ${data.length} mutations across ${genes.size} genes and ${samples.size} samples`);
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    static async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    static detectDelimiter(content) {
        const firstLine = content.split('\n')[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        return tabCount > commaCount ? '\t' : ',';
    }
}
MafParser.REQUIRED_COLUMNS = [
    'Hugo_Symbol',
    'Tumor_Sample_Barcode',
    'Variant_Classification'
];
MafParser.OPTIONAL_COLUMNS = [
    'Protein_Change',
    'Chromosome',
    'Start_Position',
    'End_Position'
];

class MetadataParser {
    static async parseFromFile(file) {
        const content = await this.readFileContent(file);
        return this.parseFromString(content, this.detectDelimiter(content));
    }
    static parseFromString(content, delimiter = '\t') {
        const lines = content.trim().split('\n');
        if (lines.length === 0) {
            throw new Error('File is empty');
        }
        const headers = lines[0].split(delimiter).map(h => h.trim());
        const data = [];
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
            const row = {};
            headers.forEach((header, index) => {
                const value = values[index]?.trim();
                if (value && value !== '') {
                    // Try to parse as number
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue) && isFinite(numValue)) {
                        row[header] = numValue;
                    }
                    else {
                        row[header] = value;
                    }
                }
            });
            if (row.Tumor_Sample_Barcode) {
                data.push(row);
            }
        }
        return data;
    }
    static async parseFromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch metadata file from ${url}: ${response.statusText}`);
        }
        const content = await response.text();
        return this.parseFromString(content, this.detectDelimiter(content));
    }
    static detectFieldTypes(data) {
        if (data.length === 0)
            return {};
        const fieldTypes = {};
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
            }
            else {
                fieldTypes[field] = 'numerical';
            }
        });
        return fieldTypes;
    }
    static validateMetadata(data, mafSamples) {
        const errors = [];
        const warnings = [];
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
    static async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    static detectDelimiter(content) {
        const firstLine = content.split('\n')[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        return tabCount > commaCount ? '\t' : ',';
    }
}

class DataProcessor {
    static processData(maf, metadata, cohortInfo) {
        // Extract unique genes and samples
        const genes = Array.from(new Set(maf.map(row => row.Hugo_Symbol))).sort();
        const mafSamples = Array.from(new Set(maf.map(row => row.Tumor_Sample_Barcode))).sort();
        // Determine sample list and percentage calculation base
        let samples;
        let percentageCalculationBase;
        let processedCohortInfo;
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
            }
            else if (cohortInfo.totalSamples) {
                // Only total count provided - use MAF samples for visualization but cohort count for percentages
                samples = mafSamples;
                percentageCalculationBase = cohortInfo.totalSamples;
                processedCohortInfo = {
                    totalSamples: cohortInfo.totalSamples,
                    providedSamples: undefined,
                    missingSamples: []
                };
            }
            else {
                // Invalid cohort info - fall back to MAF-based
                samples = mafSamples;
                percentageCalculationBase = mafSamples.length;
            }
        }
        else {
            // Default: MAF-based calculation
            samples = mafSamples;
            percentageCalculationBase = mafSamples.length;
        }
        // Process mutations
        const mutations = maf.map(row => ({
            gene: row.Hugo_Symbol,
            sample: row.Tumor_Sample_Barcode,
            variantType: row.Variant_Classification,
            proteinChange: row.Protein_Change,
            chromosome: row.Chromosome,
            startPosition: row.Start_Position,
            endPosition: row.End_Position
        }));
        // Calculate gene mutation counts
        const geneCounts = {};
        genes.forEach(gene => {
            geneCounts[gene] = mutations.filter(m => m.gene === gene).length;
        });
        // Calculate sample mutation counts
        const sampleCounts = {};
        samples.forEach(sample => {
            sampleCounts[sample] = mutations.filter(m => m.sample === sample).length;
        });
        // Process metadata
        let processedMetadata = {
            fields: [],
            data: {},
            fieldTypes: {}
        };
        if (metadata && metadata.length > 0) {
            const fieldTypes = MetadataParser.detectFieldTypes(metadata);
            const fields = Object.keys(fieldTypes).filter(f => f !== 'Tumor_Sample_Barcode');
            const metadataData = {};
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
    static filterByGenes(data, genes) {
        const filteredGenes = data.genes.filter(gene => genes.includes(gene));
        const filteredMutations = data.mutations.filter(m => genes.includes(m.gene));
        const geneCounts = {};
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
    static filterBySamples(data, samples) {
        const filteredSamples = data.samples.filter(sample => samples.includes(sample));
        const filteredMutations = data.mutations.filter(m => samples.includes(m.sample));
        const sampleCounts = {};
        filteredSamples.forEach(sample => {
            sampleCounts[sample] = filteredMutations.filter(m => m.sample === sample).length;
        });
        // Filter metadata
        const filteredMetadata = { ...data.metadata };
        const newMetadataData = {};
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
    static sortGenesByFrequency(data, descending = true, maxGenes) {
        // Calculate unique sample counts per gene (not total mutation counts)
        const geneFrequencies = {};
        data.genes.forEach(gene => {
            const uniqueSamples = new Set(data.mutations
                .filter(m => m.gene === gene)
                .map(m => m.sample));
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
    static sortSamplesByMutationLoad(data, descending = true) {
        return [...data.samples].sort((a, b) => {
            const countA = data.sampleCounts[a] || 0;
            const countB = data.sampleCounts[b] || 0;
            return descending ? countB - countA : countA - countB;
        });
    }
    static sortSamplesForOncoprint(data, sortedGenes) {
        // Iterative reordering algorithm for oncoprint clustering
        let orderedSamples = [...data.samples];
        // Create mutation lookup for efficiency
        const geneMutationInfo = {};
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
            const mutatedSamples = [];
            const unmutatedSamples = [];
            orderedSamples.forEach(sample => {
                if (geneMutationInfo[gene][sample]) {
                    mutatedSamples.push(sample);
                }
                else {
                    unmutatedSamples.push(sample);
                }
            });
            // Reorder: mutated first, then unmutated
            orderedSamples = [...mutatedSamples, ...unmutatedSamples];
        }
        return orderedSamples;
    }
    static sortSamplesByMetadata(data, field, ascending = true) {
        if (!data.metadata.fields.includes(field)) {
            console.warn(`Metadata field '${field}' not found`);
            return data.samples;
        }
        return [...data.samples].sort((a, b) => {
            const valueA = data.metadata.data[a]?.[field];
            const valueB = data.metadata.data[b]?.[field];
            if (valueA === undefined && valueB === undefined)
                return 0;
            if (valueA === undefined)
                return 1;
            if (valueB === undefined)
                return -1;
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return ascending ? valueA - valueB : valueB - valueA;
            }
            const strA = String(valueA).toLowerCase();
            const strB = String(valueB).toLowerCase();
            if (ascending) {
                return strA < strB ? -1 : strA > strB ? 1 : 0;
            }
            else {
                return strA > strB ? -1 : strA < strB ? 1 : 0;
            }
        });
    }
    static getMutationMatrix(data) {
        const matrix = {};
        // Initialize empty matrix
        data.genes.forEach(gene => {
            matrix[gene] = {};
            data.samples.forEach(sample => {
                matrix[gene][sample] = null;
            });
        });
        // Group mutations by gene-sample pair
        const mutationGroups = {};
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
                }
                else if (mutations.length === 2) {
                    matrix[gene][sample] = mutations;
                }
                else if (mutations.length > 2) {
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
    static calculateMutationFrequencies(data) {
        const frequencies = {};
        // Use the percentage calculation base (cohort-based or MAF-based)
        const totalSamples = data.percentageCalculationBase;
        data.genes.forEach(gene => {
            const mutatedSamples = new Set(data.mutations
                .filter(m => m.gene === gene)
                .map(m => m.sample));
            frequencies[gene] = mutatedSamples.size / totalSamples;
        });
        return frequencies;
    }
    static getVariantTypes(data) {
        return Array.from(new Set(data.mutations.map(m => m.variantType))).sort();
    }
    static applySplitBy(data, splitField, sortMethod = 'oncoprint', customSampleOrder, geneOrder) {
        // Check if the split field exists in metadata
        if (!data.metadata.fields.includes(splitField)) {
            console.warn(`Split field '${splitField}' not found in metadata. Ignoring split.`);
            return data;
        }
        // Group samples by the split field value
        const groupMap = new Map();
        data.samples.forEach(sample => {
            const value = data.metadata.data[sample]?.[splitField];
            const groupKey = value?.toString() || 'Unknown';
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey).push(sample);
        });
        // Sort groups by their names for consistent ordering
        const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => a.localeCompare(b));
        // Create SampleGroup objects with position information
        const sampleGroups = [];
        let currentIndex = 0;
        sortedGroups.forEach(([value, groupSamples]) => {
            // Sort samples within each group using the specified sorting method
            const sortedGroupSamples = this.sortSamplesWithinGroup(groupSamples, data, sortMethod, customSampleOrder, geneOrder);
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
        const newSampleOrder = [];
        sampleGroups.forEach(group => {
            newSampleOrder.push(...group.samples);
        });
        return {
            ...data,
            samples: newSampleOrder,
            sampleGroups
        };
    }
    static sortSamplesWithinGroup(samples, data, sortMethod = 'oncoprint', customSampleOrder, geneOrder) {
        // Create a subset of data containing only the samples in this group
        const groupData = {
            ...data,
            samples: samples,
            mutations: data.mutations.filter(m => samples.includes(m.sample)),
            sampleCounts: Object.fromEntries(samples.map(sample => [sample, data.sampleCounts[sample] || 0])),
            metadata: {
                ...data.metadata,
                data: Object.fromEntries(samples.map(sample => [sample, data.metadata.data[sample] || {}]))
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
    static getCoOccurrenceMatrix(data) {
        const matrix = {};
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

const DEFAULT_VARIANT_COLORS = {
    Missense_Mutation: "#16a085", // Teal
    Splice_Site: "#27ae60", // Green
    Frame_Shift_Del: "#2980b9", // Blue
    Frame_Shift_Ins: "#c0392b", // Red
    In_Frame_Del: "#f39c12", // Orange
    In_Frame_Ins: "#8e44ad", // Purple
    Nonsense_Mutation: "#34495e", // Dark Gray
    Multi_Hit: "#95a5a6", // Gray
    Translation_Start_Site: "#e74c3c", // Light Red
    Nonstop_Mutation: "#d35400", // Dark Orange
    Default: "#95a5a6", // Gray
    Empty: "#ecf0f1" // Light Gray
};
class VariantColorManager {
    constructor(predefinedColors = DEFAULT_VARIANT_COLORS) {
        this.dynamicColors = {};
        this.usedColors = new Set();
        this.predefinedColors = { ...predefinedColors };
        this.colorPalette = [
            ...d3.schemeCategory10,
            ...d3.schemeSet3
        ];
        // Mark predefined colors as used
        Object.values(this.predefinedColors).forEach(color => {
            this.usedColors.add(color);
        });
    }
    getColor(variant) {
        // Return predefined color if available
        if (this.predefinedColors[variant]) {
            return this.predefinedColors[variant];
        }
        // Generate dynamic color if not already assigned
        if (!this.dynamicColors[variant]) {
            this.dynamicColors[variant] = this.generateUniqueColor();
        }
        return this.dynamicColors[variant];
    }
    getAllColors() {
        return { ...this.predefinedColors, ...this.dynamicColors };
    }
    getKnownVariants() {
        return Object.keys(this.predefinedColors).filter(v => v !== 'Default' && v !== 'Empty');
    }
    getDynamicVariants() {
        return Object.keys(this.dynamicColors);
    }
    updateColor(variant, color) {
        if (this.predefinedColors[variant]) {
            this.predefinedColors[variant] = color;
        }
        else {
            this.dynamicColors[variant] = color;
        }
        this.usedColors.add(color);
    }
    resetDynamicColors() {
        // Remove dynamic colors from used colors set
        Object.values(this.dynamicColors).forEach(color => {
            this.usedColors.delete(color);
        });
        this.dynamicColors = {};
    }
    getColorLegend(variants) {
        const knownVariants = new Set(this.getKnownVariants());
        return variants
            .filter(v => v !== 'Empty' && v !== 'Default')
            .map(variant => ({
            variant,
            color: this.getColor(variant),
            isKnown: knownVariants.has(variant)
        }))
            .sort((a, b) => {
            // Sort known variants first, then alphabetically
            if (a.isKnown && !b.isKnown)
                return -1;
            if (!a.isKnown && b.isKnown)
                return 1;
            return a.variant.localeCompare(b.variant);
        });
    }
    generateUniqueColor() {
        // Try colors from the palette first
        for (const color of this.colorPalette) {
            if (!this.usedColors.has(color)) {
                this.usedColors.add(color);
                return color;
            }
        }
        // If all palette colors are used, generate a random color
        let attempts = 0;
        let color;
        do {
            color = this.generateRandomColor();
            attempts++;
        } while (this.usedColors.has(color) && attempts < 100);
        this.usedColors.add(color);
        return color;
    }
    generateRandomColor() {
        // Generate a color with good contrast and saturation
        const hue = Math.floor(Math.random() * 360);
        const saturation = 60 + Math.floor(Math.random() * 30); // 60-90%
        const lightness = 40 + Math.floor(Math.random() * 20); // 40-60%
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    getVariantsByFrequency(variants, counts) {
        return [...variants].sort((a, b) => {
            const countA = counts[a] || 0;
            const countB = counts[b] || 0;
            return countB - countA;
        });
    }
    static fromVariants(variants, customColors) {
        const manager = new VariantColorManager(customColors);
        // Pre-generate colors for all variants
        variants.forEach(variant => {
            manager.getColor(variant);
        });
        return manager;
    }
    exportColorMap() {
        return {
            ...this.predefinedColors,
            ...this.dynamicColors
        };
    }
    importColorMap(colorMap) {
        Object.entries(colorMap).forEach(([variant, color]) => {
            if (this.predefinedColors[variant]) {
                this.predefinedColors[variant] = color;
            }
            else {
                this.dynamicColors[variant] = color;
            }
            this.usedColors.add(color);
        });
    }
}

class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }
    off(event, callback) {
        if (!this.events[event])
            return;
        if (!callback) {
            delete this.events[event];
            return;
        }
        this.events[event] = this.events[event].filter(cb => cb !== callback);
        if (this.events[event].length === 0) {
            delete this.events[event];
        }
    }
    emit(event, ...args) {
        if (!this.events[event])
            return;
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            }
            catch (error) {
                console.error(`Error in event handler for '${event}':`, error);
            }
        });
    }
    once(event, callback) {
        const onceCallback = (...args) => {
            callback(...args);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
    }
    listenerCount(event) {
        return this.events[event]?.length || 0;
    }
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        }
        else {
            this.events = {};
        }
    }
}

class OncoprintRenderer extends EventEmitter {
    constructor(container, config = {}) {
        super();
        this.svg = null;
        this.data = null;
        this.geneOrder = [];
        this.sampleOrder = [];
        this.container = container;
        this.config = this.getDefaultConfig(config);
        this.colorManager = new VariantColorManager(this.config.variantColors);
        this.dimensions = this.calculateDimensions();
    }
    setData(data) {
        this.data = data;
        this.updateColorManager();
        this.updateOrdering();
        this.emit('dataLoaded', data);
    }
    updateConfig(config) {
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
    render() {
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
    resize(width, height) {
        if (width)
            this.dimensions.width = width;
        if (height)
            this.dimensions.height = height;
        this.dimensions = this.calculateDimensions();
        this.render();
    }
    exportSVG() {
        if (!this.svg) {
            throw new Error('No SVG available for export');
        }
        return new XMLSerializer().serializeToString(this.svg.node());
    }
    exportPNG(options) {
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
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                console.log(`Export SVG dimensions: ${img.width} x ${img.height}`);
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
                console.log(`Final export dimensions: ${finalWidth} x ${finalHeight} (scale: ${opts.scale})`);
                // Set canvas to final size
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                // Fill with background color
                if (opts.backgroundColor && opts.backgroundColor !== 'transparent') {
                    ctx.fillStyle = opts.backgroundColor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                // Draw the full image
                ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, finalWidth, finalHeight);
                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`PNG export successful: ${blob.size} bytes`);
                        resolve(blob);
                    }
                    else {
                        reject(new Error('Failed to create blob'));
                    }
                }, 'image/png');
            };
            img.onerror = (error) => {
                console.error('Image loading failed:', error);
                reject(new Error('Failed to load SVG as image'));
            };
            console.log('Starting PNG export with full-size SVG');
            img.src = 'data:image/svg+xml;base64,' + btoa(exportSVG);
        });
    }
    createFullSizeExportSVG() {
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
        const svgString = new XMLSerializer().serializeToString(tempSVG.node());
        // Restore original SVG and dimensions
        this.svg = originalSVG;
        this.dimensions = originalDimensions;
        return svgString;
    }
    getSampleXPosition(sampleIndex) {
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
    getTotalWidthWithGaps(cellWidth) {
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
    getContentBounds() {
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
    calculateFullSizeDimensions() {
        // Return the original configured cell dimensions (not scaled)
        return {
            cellWidth: this.config.cellWidth || 10,
            cellHeight: this.config.cellHeight || 20
        };
    }
    createSVG() {
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
        console.log(`Created SVG with dimensions: ${this.dimensions.width} x ${this.dimensions.height}`);
        console.log(`Cell dimensions: ${this.dimensions.cellWidth} x ${this.dimensions.cellHeight}`);
        console.log(`Container size: ${this.container.getBoundingClientRect().width} x ${this.container.getBoundingClientRect().height}`);
        // Log matrix dimensions for debugging
        if (this.data) {
            const matrixWidth = this.sampleOrder.length * this.dimensions.cellWidth;
            const matrixHeight = this.geneOrder.length * this.dimensions.cellHeight;
            console.log(`Matrix dimensions: ${matrixWidth} x ${matrixHeight} (${this.sampleOrder.length} samples x ${this.geneOrder.length} genes)`);
        }
    }
    renderMainMatrix() {
        if (!this.svg || !this.data)
            return;
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
                }
                else if (Array.isArray(mutation)) {
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
                }
                else {
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
    renderGeneLabels() {
        if (!this.svg || !this.data || !this.config.geneLabels)
            return;
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
            const mutatedSampleCount = new Set(this.data.mutations
                .filter(m => m.gene === gene)
                .map(m => m.sample)).size;
            const frequency = mutatedSampleCount / this.data.percentageCalculationBase;
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
    renderSampleLabels() {
        if (!this.svg || !this.data || !this.config.sampleLabels)
            return;
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
    renderMetadataTracks() {
        if (!this.svg || !this.data)
            return;
        // Get active tracks - support both legacy and new configuration
        const activeTracks = this.getActiveMetadataTracks();
        if (!activeTracks.length)
            return;
        const tracksGroup = this.svg.append('g')
            .attr('class', 'metadata-tracks')
            .attr('transform', `translate(${this.dimensions.geneLabelWidth + this.dimensions.marginLeft}, ${this.dimensions.marginTop})`);
        let currentY = 0;
        activeTracks.forEach((trackConfig, trackIndex) => {
            if (!this.data.metadata.fields.includes(trackConfig.field))
                return;
            const trackHeight = trackConfig.height || this.dimensions.metadataTrackHeight;
            const trackSpacing = this.config.metadata?.trackSpacing || 3;
            this.renderSingleMetadataTrack(tracksGroup, trackConfig, currentY);
            // Add track label if enabled
            if (trackConfig.showLabels !== false && this.config.metadata?.showLabels !== false) {
                const label = trackConfig.label || trackConfig.field;
                this.svg.append('text')
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
    getActiveMetadataTracks() {
        // Support legacy configuration
        if (this.config.metadataFields?.length && !this.config.metadata?.tracks) {
            return this.config.metadataFields.map(field => ({
                field,
                visible: true,
                type: 'auto',
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
    renderGroupHeaders() {
        if (!this.svg || !this.data?.sampleGroups || !this.config.splitBy)
            return;
        const showGroupHeaders = this.config.splitBy.showGroupHeaders !== false;
        const showGroupCounts = this.config.splitBy.showGroupCounts !== false;
        if (!showGroupHeaders && !showGroupCounts)
            return;
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
                const gapSize = this.config.splitBy.gapSize || 20;
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
    renderSingleMetadataTrack(container, trackConfig, y) {
        const field = trackConfig.field;
        const trackHeight = trackConfig.height || this.dimensions.metadataTrackHeight;
        // Determine field type
        const detectedType = this.data.metadata.fieldTypes[field];
        const fieldType = trackConfig.type === 'auto' || !trackConfig.type ? detectedType : trackConfig.type;
        // Create color scale
        const colorScale = this.createColorScale(field, fieldType, trackConfig);
        this.sampleOrder.forEach((sample, sampleIndex) => {
            const value = this.data.metadata.data[sample]?.[field];
            const x = this.getSampleXPosition(sampleIndex);
            let color = '#f0f0f0'; // Default for missing values
            let tooltip = '';
            if (value !== undefined) {
                if (trackConfig.customRenderer) {
                    const result = trackConfig.customRenderer(value, sample);
                    color = result.color;
                    tooltip = result.tooltip || String(value);
                }
                else {
                    if (fieldType === 'numerical' && typeof value === 'number') {
                        color = colorScale(value);
                    }
                    else {
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
    createColorScale(field, fieldType, trackConfig) {
        if (fieldType === 'numerical') {
            // Get all available numerical values for this field (not just displayed samples)
            const allValues = Object.values(this.data.metadata.data)
                .map(sampleData => sampleData?.[field])
                .filter(v => v !== undefined && typeof v === 'number');
            // Calculate domain from all data, not just displayed samples
            let extent = trackConfig.domain;
            if (!extent && allValues.length > 0) {
                extent = d3.extent(allValues);
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
                case 'viridis':
                    interpolator = d3.interpolateViridis;
                    break;
                case 'plasma':
                    interpolator = d3.interpolatePlasma;
                    break;
                case 'reds':
                    interpolator = d3.interpolateReds;
                    break;
                case 'greens':
                    interpolator = d3.interpolateGreens;
                    break;
                default:
                    interpolator = d3.interpolateBlues;
                    break;
            }
            return d3.scaleSequential(interpolator).domain(extent);
        }
        else {
            // Get all unique categorical values for this field (not just displayed samples)
            const allValues = Array.from(new Set(Object.values(this.data.metadata.data)
                .map(sampleData => sampleData?.[field])
                .filter(v => v !== undefined)
                .map(v => String(v))));
            if (trackConfig.colors) {
                if (Array.isArray(trackConfig.colors)) {
                    return d3.scaleOrdinal(trackConfig.colors).domain(allValues);
                }
                else if (typeof trackConfig.colors === 'string') {
                    // Handle string-based color scheme names (e.g., 'category10', 'category20')
                    let colorScheme;
                    switch (trackConfig.colors) {
                        case 'category10':
                            colorScheme = d3.schemeCategory10;
                            break;
                        case 'category20':
                            colorScheme = d3.schemeCategory10.concat(d3.schemeCategory10);
                            break;
                        case 'pastel1':
                            colorScheme = d3.schemePastel1;
                            break;
                        case 'set3':
                            colorScheme = d3.schemeSet3;
                            break;
                        default:
                            colorScheme = d3.schemeCategory10;
                            break;
                    }
                    return d3.scaleOrdinal(colorScheme).domain(allValues);
                }
                else {
                    // Record-based color mapping
                    return (value) => trackConfig.colors[value] || '#bdc3c7';
                }
            }
            // Default categorical color scheme - use more colors for better distinction
            const defaultScheme = allValues.length <= 10 ? d3.schemeCategory10 :
                allValues.length <= 20 ? d3.schemeCategory10.concat(d3.schemePastel1) :
                    d3.schemeCategory10.concat(d3.schemePastel1).concat(d3.schemeSet3);
            return d3.scaleOrdinal(defaultScheme).domain(allValues);
        }
    }
    renderLegend() {
        if (!this.svg || !this.data || !this.config.legend)
            return;
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
        legend.forEach((item, index) => {
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
    renderMetadataLegends(parentGroup, yOffset) {
        if (!this.data)
            return;
        const activeTracks = this.getActiveMetadataTracks();
        if (!activeTracks.length)
            return;
        let currentX = 0;
        const trackSpacing = 200; // Horizontal spacing between tracks
        activeTracks.forEach((trackConfig, trackIndex) => {
            const field = trackConfig.field;
            if (!this.data.metadata.fields.includes(field))
                return;
            const detectedType = this.data.metadata.fieldTypes[field];
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
            }
            else {
                this.renderNumericalMetadataLegend(parentGroup, trackConfig, currentX, yOffset + 25);
                currentX += trackSpacing;
            }
        });
    }
    renderCategoricalMetadataLegend(parentGroup, trackConfig, startX, y) {
        const field = trackConfig.field;
        // Only get values that are actually present in the displayed samples
        const displayedSamples = this.sampleOrder;
        const values = Array.from(new Set(displayedSamples
            .map(sample => this.data.metadata.data[sample]?.[field])
            .filter(v => v !== undefined)
            .map(v => String(v))));
        if (!values.length)
            return 0;
        const colorScale = this.createColorScale(field, 'categorical', trackConfig);
        // Arrange in multiple columns for efficient space usage
        const maxWidth = 180; // Maximum width per track
        const itemSpacing = 5;
        let currentX = 0;
        let currentY = 0;
        let maxUsedWidth = 0;
        values.forEach((value, index) => {
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
    renderNumericalMetadataLegend(parentGroup, trackConfig, startX, y) {
        const field = trackConfig.field;
        // Only get values that are actually present in the displayed samples
        const displayedSamples = this.sampleOrder;
        const values = displayedSamples
            .map(sample => this.data.metadata.data[sample]?.[field])
            .filter(v => v !== undefined && typeof v === 'number');
        if (!values.length)
            return;
        const extent = trackConfig.domain || d3.extent(values);
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
    setupInteractions() {
        if (!this.svg || !this.data)
            return;
        // Cell interactions
        this.svg.selectAll('.oncoprint-matrix rect')
            .on('click', (event, d) => {
            const element = event.target;
            const gene = element.getAttribute('data-gene');
            const sample = element.getAttribute('data-sample');
            const variant = element.getAttribute('data-variant');
            this.emit('cellClick', { gene, sample, variant });
        })
            .on('mouseenter', (event, d) => {
            if (!this.config.tooltips)
                return;
            // Tooltip implementation would go here
        });
        // Gene label interactions
        this.svg.selectAll('.gene-labels text')
            .on('click', (event, d) => {
            const gene = event.target.textContent;
            this.emit('geneClick', { gene });
        });
        // Sample label interactions
        this.svg.selectAll('.sample-labels text')
            .on('click', (event, d) => {
            const sample = event.target.textContent;
            this.emit('sampleClick', { sample });
        });
    }
    updateColorManager() {
        if (!this.data)
            return;
        const variants = Array.from(new Set(this.data.mutations.map(m => m.variantType)));
        variants.forEach(variant => {
            this.colorManager.getColor(variant);
        });
    }
    updateOrdering() {
        if (!this.data)
            return;
        // Update gene order - default to top 25 most frequently mutated genes
        switch (this.config.sortGenes) {
            case 'frequency':
                this.geneOrder = DataProcessor.sortGenesByFrequency(this.data, true, 25).reverse();
                break;
            case 'alphabetical':
                const limitedGenes = DataProcessor.sortGenesByFrequency(this.data, true, 25);
                this.geneOrder = limitedGenes.sort();
                break;
            case 'custom':
                this.geneOrder = this.config.customGeneOrder?.filter(g => this.data.genes.includes(g)) ||
                    DataProcessor.sortGenesByFrequency(this.data, true, 25).reverse();
                break;
            default:
                this.geneOrder = DataProcessor.sortGenesByFrequency(this.data, true, 25).reverse();
        }
        // Update sample order - apply split with current sort settings if enabled
        if (this.config.splitBy?.field) {
            // Re-apply split with current sort configuration to ensure proper ordering within groups
            this.data = DataProcessor.applySplitBy(this.data, this.config.splitBy.field, this.config.sortSamples, this.config.customSampleOrder, this.geneOrder);
            this.sampleOrder = [...this.data.samples];
        }
        else {
            // Normal sorting when no split is active
            switch (this.config.sortSamples) {
                case 'mutation_load':
                    this.sampleOrder = DataProcessor.sortSamplesByMutationLoad(this.data, true);
                    break;
                case 'alphabetical':
                    this.sampleOrder = [...this.data.samples].sort();
                    break;
                case 'custom':
                    this.sampleOrder = this.config.customSampleOrder?.filter(s => this.data.samples.includes(s)) || this.data.samples;
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
    createMutationMatrix() {
        return DataProcessor.getMutationMatrix(this.data);
    }
    calculateDimensions() {
        const containerRect = this.container.getBoundingClientRect();
        let availableWidth = containerRect.width || 1000;
        let availableHeight = containerRect.height || 700;
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
                console.log(`Scaling visualization by ${scale.toFixed(2)} to fit container`);
                console.log(`Container: ${availableWidth} x ${availableHeight}, Required: ${requiredWidth} x ${requiredHeight}`);
                console.log(`Original cell size: ${this.config.cellWidth || 10} x ${this.config.cellHeight || 20}`);
                console.log(`Scaled cell size: ${cellWidth} x ${cellHeight}`);
                console.log(`Sample count: ${this.sampleOrder.length}, Gene count: ${this.geneOrder.length}`);
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
    getMetadataTracksHeight() {
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
                if (showGroupHeaders)
                    headerHeight += 15;
                if (showGroupCounts)
                    headerHeight += 15;
                totalHeight += headerHeight + 10; // Add some padding
            }
        }
        return totalHeight;
    }
    getDefaultConfig(config) {
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
    addMetadataTrack(trackConfig) {
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
    removeMetadataTrack(fieldName) {
        if (this.config.metadata?.tracks) {
            this.config.metadata.tracks = this.config.metadata.tracks.filter(t => t.field !== fieldName);
            this.render();
        }
    }
    updateMetadataTrack(fieldName, updates) {
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
    showMetadataTrack(fieldName) {
        this.updateMetadataTrack(fieldName, { visible: true });
    }
    hideMetadataTrack(fieldName) {
        this.updateMetadataTrack(fieldName, { visible: false });
    }
    reorderMetadataTracks(fieldOrder) {
        if (this.config.metadata?.tracks) {
            const orderedTracks = [];
            fieldOrder.forEach((field, index) => {
                const track = this.config.metadata.tracks.find(t => t.field === field);
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
    getMetadataConfig() {
        return this.config.metadata?.tracks || [];
    }
    setMetadataConfig(tracks) {
        if (!this.config.metadata) {
            this.config.metadata = {};
        }
        this.config.metadata.tracks = tracks;
        this.render();
    }
    getAvailableMetadataFields() {
        return this.data?.metadata.fields || [];
    }
}

class OncoprintVisualizer extends EventEmitter {
    constructor(container, config = {}) {
        super();
        this.processedData = null;
        this.rawMafData = [];
        this.rawMetadataData = [];
        this.container = container;
        this.config = config;
        this.renderer = new OncoprintRenderer(container, config);
        this.setupRendererEvents();
    }
    // Data loading methods
    async loadMafFile(file) {
        try {
            const mafData = await MafParser.parseFromFile(file);
            const validation = MafParser.validateMafData(mafData);
            if (validation.isValid) {
                await this.loadMafData(mafData);
            }
            return validation;
        }
        catch (error) {
            const validationResult = {
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
    async loadMafData(data, cohortInfo) {
        try {
            this.rawMafData = [...data]; // Store original data
            this.cohortInfo = cohortInfo; // Store cohort information
            this.reprocessData();
            this.emit('dataLoaded', this.processedData);
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async loadMetadataFile(file) {
        try {
            const metadataData = await MetadataParser.parseFromFile(file);
            const mafSamples = this.processedData?.samples;
            const validation = MetadataParser.validateMetadata(metadataData, mafSamples);
            if (validation.isValid) {
                await this.loadMetadataData(metadataData);
            }
            return validation;
        }
        catch (error) {
            const validationResult = {
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
    async loadMetadataData(data) {
        try {
            if (this.rawMafData.length === 0) {
                throw new Error('MAF data must be loaded before metadata');
            }
            this.rawMetadataData = [...data]; // Store original metadata
            this.reprocessData();
            this.emit('dataLoaded', this.processedData);
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    // Rendering methods
    render() {
        if (!this.processedData) {
            throw new Error('No data available for rendering. Load MAF data first.');
        }
        this.renderer.render();
    }
    update(config) {
        if (config) {
            const oldConfig = { ...this.config };
            this.config = { ...this.config, ...config };
            this.renderer.updateConfig(config);
            // Check if we need to reprocess data due to filtering or split changes
            const splitChanged = 'splitBy' in config && (JSON.stringify(config.splitBy) !== JSON.stringify(oldConfig.splitBy));
            const needsReprocessing = this.rawMafData.length > 0 && (config.geneList !== undefined ||
                config.sampleList !== undefined ||
                splitChanged);
            if (needsReprocessing) {
                this.reprocessData();
            }
        }
        this.render();
    }
    resize(width, height) {
        this.renderer.resize(width, height);
    }
    // Export methods
    exportSVG() {
        return this.renderer.exportSVG();
    }
    async exportPNG(options) {
        return this.renderer.exportPNG(options);
    }
    exportData() {
        if (!this.processedData) {
            throw new Error('No data available for export');
        }
        return { ...this.processedData }; // Return a copy
    }
    // Selection methods
    getSelectedGenes() {
        return this.config.geneList || [];
    }
    getSelectedSamples() {
        return this.config.sampleList || [];
    }
    setGeneSelection(genes) {
        this.update({ geneList: genes });
    }
    setSampleSelection(samples) {
        this.update({ sampleList: samples });
    }
    // Utility methods
    getAvailableGenes() {
        return this.processedData?.genes || [];
    }
    getAllGenes() {
        // Return all genes from the original data, not just the filtered ones
        if (this.rawMafData.length === 0)
            return [];
        const allGenes = [...new Set(this.rawMafData.map(row => row.Hugo_Symbol))];
        return allGenes.sort();
    }
    getAvailableSamples() {
        return this.processedData?.samples || [];
    }
    getAllSamples() {
        // Return all samples from the cohort if provided, otherwise from MAF data
        if (this.cohortInfo?.samples) {
            return this.cohortInfo.samples.slice();
        }
        // Fall back to MAF-based samples
        if (this.rawMafData.length === 0)
            return [];
        const allSamples = [...new Set(this.rawMafData.map(row => row.Tumor_Sample_Barcode))];
        return allSamples.sort();
    }
    getPercentageCalculationBase() {
        // Return the base used for percentage calculations
        return this.processedData?.percentageCalculationBase || 0;
    }
    getCohortInfo() {
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
    getMetadataFields() {
        return this.processedData?.metadata.fields || [];
    }
    getVariantTypes() {
        if (!this.processedData)
            return [];
        return Array.from(new Set(this.processedData.mutations.map(m => m.variantType))).sort();
    }
    getMutationStats() {
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
    setConfig(config) {
        this.config = config;
        this.renderer.updateConfig(config);
    }
    getConfig() {
        return { ...this.config };
    }
    // Sorting methods
    sortGenesByFrequency(descending = true) {
        if (!this.processedData)
            return;
        const sortedGenes = DataProcessor.sortGenesByFrequency(this.processedData, descending);
        this.update({
            sortGenes: 'custom',
            customGeneOrder: sortedGenes
        });
    }
    sortSamplesByMutationLoad(descending = true) {
        if (!this.processedData)
            return;
        const sortedSamples = DataProcessor.sortSamplesByMutationLoad(this.processedData, descending);
        this.update({
            sortSamples: 'custom',
            customSampleOrder: sortedSamples
        });
    }
    sortSamplesByMetadata(field, ascending = true) {
        if (!this.processedData)
            return;
        const sortedSamples = DataProcessor.sortSamplesByMetadata(this.processedData, field, ascending);
        this.update({
            sortSamples: 'custom',
            customSampleOrder: sortedSamples
        });
    }
    // Filter methods
    filterByMutationFrequency(minFrequency, maxFrequency = 1) {
        if (!this.processedData)
            return;
        const frequencies = DataProcessor.calculateMutationFrequencies(this.processedData);
        const filteredGenes = this.processedData.genes.filter(gene => {
            const freq = frequencies[gene];
            return freq >= minFrequency && freq <= maxFrequency;
        });
        this.update({ geneList: filteredGenes });
    }
    filterByMutationCount(minCount, maxCount) {
        if (!this.processedData)
            return;
        const filteredGenes = this.processedData.genes.filter(gene => {
            const count = this.processedData.geneCounts[gene];
            return count >= minCount && (maxCount === undefined || count <= maxCount);
        });
        this.update({ geneList: filteredGenes });
    }
    // Private methods
    setupRendererEvents() {
        this.renderer.on('cellClick', (data) => this.emit('cellClick', data));
        this.renderer.on('geneClick', (data) => this.emit('geneClick', data));
        this.renderer.on('sampleClick', (data) => this.emit('sampleClick', data));
        this.renderer.on('dataLoaded', (data) => this.emit('dataLoaded', data));
        this.renderer.on('error', (error) => this.emit('error', error));
    }
    applyDataFilters(data) {
        let filteredData = [...data];
        // Filter by genes if specified
        if (this.config.geneList && this.config.geneList.length > 0) {
            filteredData = filteredData.filter(row => this.config.geneList.includes(row.Hugo_Symbol));
        }
        // Filter by samples if specified
        if (this.config.sampleList && this.config.sampleList.length > 0) {
            filteredData = filteredData.filter(row => this.config.sampleList.includes(row.Tumor_Sample_Barcode));
        }
        return filteredData;
    }
    reprocessData() {
        if (this.rawMafData.length === 0) {
            throw new Error('No MAF data available for reprocessing');
        }
        const filteredData = this.applyDataFilters(this.rawMafData);
        const metadataToUse = this.rawMetadataData.length > 0 ? this.rawMetadataData : undefined;
        // Pass cohort information for percentage calculation and missing sample handling
        this.processedData = DataProcessor.processData(filteredData, metadataToUse, this.cohortInfo);
        // Apply split grouping if configured
        if (this.config.splitBy?.field) {
            this.processedData = DataProcessor.applySplitBy(this.processedData, this.config.splitBy.field, this.config.sortSamples, this.config.customSampleOrder, undefined // geneOrder will be determined later in updateOrdering
            );
        }
        this.renderer.setData(this.processedData);
    }
    reconstructMafData() {
        if (!this.processedData)
            return [];
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
    addMetadataTrack(trackConfig) {
        this.renderer.addMetadataTrack(trackConfig);
    }
    removeMetadataTrack(fieldName) {
        this.renderer.removeMetadataTrack(fieldName);
    }
    updateMetadataTrack(fieldName, updates) {
        this.renderer.updateMetadataTrack(fieldName, updates);
    }
    showMetadataTrack(fieldName) {
        this.renderer.showMetadataTrack(fieldName);
    }
    hideMetadataTrack(fieldName) {
        this.renderer.hideMetadataTrack(fieldName);
    }
    reorderMetadataTracks(fieldOrder) {
        this.renderer.reorderMetadataTracks(fieldOrder);
    }
    getMetadataConfig() {
        return this.renderer.getMetadataConfig();
    }
    setMetadataConfig(tracks) {
        this.renderer.setMetadataConfig(tracks);
    }
    getAvailableMetadataFields() {
        return this.renderer.getAvailableMetadataFields();
    }
    // Cleanup
    destroy() {
        this.removeAllListeners();
        this.renderer.removeAllListeners();
        // Clear container
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
    }
}

const Oncoprint = forwardRef(({ mafData, metadataData, mafFile, metadataFile, config = {}, width, height, onGeneClick, onSampleClick, onCellClick, onDataLoaded, onError, onRenderComplete, className, style }, ref) => {
    const containerRef = useRef(null);
    const visualizerRef = useRef(null);
    // Initialize visualizer
    useEffect(() => {
        if (!containerRef.current)
            return;
        const visualizer = new OncoprintVisualizer(containerRef.current, config);
        visualizerRef.current = visualizer;
        // Set up event listeners
        if (onGeneClick) {
            visualizer.on('geneClick', (data) => onGeneClick(data.gene));
        }
        if (onSampleClick) {
            visualizer.on('sampleClick', (data) => onSampleClick(data.sample));
        }
        if (onCellClick) {
            visualizer.on('cellClick', (data) => {
                const mutation = data.variant ? { variantType: data.variant } : undefined;
                onCellClick(data.gene, data.sample, mutation);
            });
        }
        if (onDataLoaded) {
            visualizer.on('dataLoaded', onDataLoaded);
        }
        if (onError) {
            visualizer.on('error', onError);
        }
        return () => {
            visualizer.destroy();
        };
    }, []);
    // Handle config updates
    useEffect(() => {
        if (visualizerRef.current) {
            visualizerRef.current.setConfig(config);
        }
    }, [config]);
    // Handle resize
    useEffect(() => {
        if (visualizerRef.current && (width || height)) {
            visualizerRef.current.resize(width, height);
        }
    }, [width, height]);
    // Load MAF data from file
    useEffect(() => {
        if (mafFile && visualizerRef.current) {
            visualizerRef.current.loadMafFile(mafFile)
                .then((validation) => {
                if (validation.isValid) {
                    visualizerRef.current?.render();
                    onRenderComplete?.();
                }
                else {
                    const error = new Error(validation.errors[0]?.message || 'MAF file validation failed');
                    onError?.(error);
                }
            })
                .catch((error) => {
                onError?.(error);
            });
        }
    }, [mafFile, onError, onRenderComplete]);
    // Load MAF data directly
    useEffect(() => {
        if (mafData && visualizerRef.current) {
            visualizerRef.current.loadMafData(mafData)
                .then(() => {
                visualizerRef.current?.render();
                onRenderComplete?.();
            })
                .catch((error) => {
                onError?.(error);
            });
        }
    }, [mafData, onError, onRenderComplete]);
    // Load metadata from file
    useEffect(() => {
        if (metadataFile && visualizerRef.current) {
            visualizerRef.current.loadMetadataFile(metadataFile)
                .then((validation) => {
                if (validation.isValid) {
                    visualizerRef.current?.render();
                    onRenderComplete?.();
                }
                else {
                    const error = new Error(validation.errors[0]?.message || 'Metadata file validation failed');
                    onError?.(error);
                }
            })
                .catch((error) => {
                onError?.(error);
            });
        }
    }, [metadataFile, onError, onRenderComplete]);
    // Load metadata directly
    useEffect(() => {
        if (metadataData && visualizerRef.current) {
            visualizerRef.current.loadMetadataData(metadataData)
                .then(() => {
                visualizerRef.current?.render();
                onRenderComplete?.();
            })
                .catch((error) => {
                onError?.(error);
            });
        }
    }, [metadataData, onError, onRenderComplete]);
    // Expose methods through ref
    useImperativeHandle(ref, () => ({
        exportSVG: () => {
            if (!visualizerRef.current) {
                throw new Error('Visualizer not initialized');
            }
            return visualizerRef.current.exportSVG();
        },
        exportPNG: async () => {
            if (!visualizerRef.current) {
                throw new Error('Visualizer not initialized');
            }
            return visualizerRef.current.exportPNG();
        },
        exportData: () => {
            if (!visualizerRef.current) {
                throw new Error('Visualizer not initialized');
            }
            return visualizerRef.current.exportData();
        },
        setGeneSelection: (genes) => {
            visualizerRef.current?.setGeneSelection(genes);
        },
        setSampleSelection: (samples) => {
            visualizerRef.current?.setSampleSelection(samples);
        },
        getSelectedGenes: () => {
            return visualizerRef.current?.getSelectedGenes() || [];
        },
        getSelectedSamples: () => {
            return visualizerRef.current?.getSelectedSamples() || [];
        },
        getMutationStats: () => {
            return visualizerRef.current?.getMutationStats();
        },
        getAvailableGenes: () => {
            return visualizerRef.current?.getAvailableGenes() || [];
        },
        getAvailableSamples: () => {
            return visualizerRef.current?.getAvailableSamples() || [];
        },
        getMetadataFields: () => {
            return visualizerRef.current?.getMetadataFields() || [];
        },
        sortGenesByFrequency: (descending = true) => {
            visualizerRef.current?.sortGenesByFrequency(descending);
        },
        sortSamplesByMutationLoad: (descending = true) => {
            visualizerRef.current?.sortSamplesByMutationLoad(descending);
        },
        sortSamplesByMetadata: (field, ascending = true) => {
            visualizerRef.current?.sortSamplesByMetadata(field, ascending);
        },
        filterByMutationFrequency: (minFreq, maxFreq = 1) => {
            visualizerRef.current?.filterByMutationFrequency(minFreq, maxFreq);
        },
        render: () => {
            visualizerRef.current?.render();
        },
        update: (newConfig) => {
            visualizerRef.current?.update(newConfig);
        }
    }), []);
    return (jsx("div", { ref: containerRef, className: className, style: {
            width: width || '100%',
            height: height || '100%',
            ...style
        } }));
});
Oncoprint.displayName = 'Oncoprint';

function useOncoprint({ container, config = {}, autoRender = true } = {}) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedGenes, setSelectedGenes] = useState([]);
    const [selectedSamples, setSelectedSamples] = useState([]);
    const [availableGenes, setAvailableGenes] = useState([]);
    const [availableSamples, setAvailableSamples] = useState([]);
    const [metadataFields, setMetadataFields] = useState([]);
    const [mutationStats, setMutationStats] = useState({});
    const visualizerRef = useRef(null);
    // Initialize visualizer when container is available
    useEffect(() => {
        if (!container)
            return;
        const visualizer = new OncoprintVisualizer(container, config);
        visualizerRef.current = visualizer;
        // Set up event listeners
        visualizer.on('dataLoaded', (loadedData) => {
            setData(loadedData);
            setAvailableGenes(visualizer.getAvailableGenes());
            setAvailableSamples(visualizer.getAvailableSamples());
            setMetadataFields(visualizer.getMetadataFields());
            setMutationStats(visualizer.getMutationStats());
            setIsLoading(false);
            setError(null);
        });
        visualizer.on('error', (err) => {
            setError(err);
            setIsLoading(false);
        });
        return () => {
            visualizer.destroy();
        };
    }, [container, config]);
    // Data loading methods
    const loadMafFile = useCallback(async (file) => {
        if (!visualizerRef.current) {
            throw new Error('Visualizer not initialized');
        }
        setIsLoading(true);
        setError(null);
        try {
            const validation = await visualizerRef.current.loadMafFile(file);
            if (validation.isValid && autoRender) {
                visualizerRef.current.render();
            }
            return validation;
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            setIsLoading(false);
            throw error;
        }
    }, [autoRender]);
    const loadMafData = useCallback(async (mafData) => {
        if (!visualizerRef.current) {
            throw new Error('Visualizer not initialized');
        }
        setIsLoading(true);
        setError(null);
        try {
            await visualizerRef.current.loadMafData(mafData);
            if (autoRender) {
                visualizerRef.current.render();
            }
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            setIsLoading(false);
            throw error;
        }
    }, [autoRender]);
    const loadMetadataFile = useCallback(async (file) => {
        if (!visualizerRef.current) {
            throw new Error('Visualizer not initialized');
        }
        setIsLoading(true);
        setError(null);
        try {
            const validation = await visualizerRef.current.loadMetadataFile(file);
            if (validation.isValid && autoRender) {
                visualizerRef.current.render();
            }
            return validation;
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            setIsLoading(false);
            throw error;
        }
    }, [autoRender]);
    const loadMetadataData = useCallback(async (metadataData) => {
        if (!visualizerRef.current) {
            throw new Error('Visualizer not initialized');
        }
        setIsLoading(true);
        setError(null);
        try {
            await visualizerRef.current.loadMetadataData(metadataData);
            if (autoRender) {
                visualizerRef.current.render();
            }
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            setIsLoading(false);
            throw error;
        }
    }, [autoRender]);
    // Rendering methods
    const render = useCallback(() => {
        visualizerRef.current?.render();
    }, []);
    const update = useCallback((newConfig) => {
        visualizerRef.current?.update(newConfig);
    }, []);
    const resize = useCallback((width, height) => {
        visualizerRef.current?.resize(width, height);
    }, []);
    // Export methods
    const exportSVG = useCallback(() => {
        if (!visualizerRef.current) {
            throw new Error('Visualizer not initialized');
        }
        return visualizerRef.current.exportSVG();
    }, []);
    const exportPNG = useCallback(async () => {
        if (!visualizerRef.current) {
            throw new Error('Visualizer not initialized');
        }
        return visualizerRef.current.exportPNG();
    }, []);
    const exportData = useCallback(() => {
        if (!visualizerRef.current) {
            throw new Error('Visualizer not initialized');
        }
        return visualizerRef.current.exportData();
    }, []);
    // Selection methods
    const setGeneSelection = useCallback((genes) => {
        setSelectedGenes(genes);
        visualizerRef.current?.setGeneSelection(genes);
    }, []);
    const setSampleSelection = useCallback((samples) => {
        setSelectedSamples(samples);
        visualizerRef.current?.setSampleSelection(samples);
    }, []);
    // Analysis methods
    const sortGenesByFrequency = useCallback((descending = true) => {
        visualizerRef.current?.sortGenesByFrequency(descending);
    }, []);
    const sortSamplesByMutationLoad = useCallback((descending = true) => {
        visualizerRef.current?.sortSamplesByMutationLoad(descending);
    }, []);
    const sortSamplesByMetadata = useCallback((field, ascending = true) => {
        visualizerRef.current?.sortSamplesByMetadata(field, ascending);
    }, []);
    const filterByMutationFrequency = useCallback((minFreq, maxFreq = 1) => {
        visualizerRef.current?.filterByMutationFrequency(minFreq, maxFreq);
    }, []);
    return {
        // State
        data,
        isLoading,
        error,
        // Data loading methods
        loadMafFile,
        loadMafData,
        loadMetadataFile,
        loadMetadataData,
        // Rendering methods
        render,
        update,
        resize,
        // Export methods
        exportSVG,
        exportPNG,
        exportData,
        // Selection methods
        selectedGenes,
        selectedSamples,
        setGeneSelection,
        setSampleSelection,
        // Analysis methods
        availableGenes,
        availableSamples,
        metadataFields,
        mutationStats,
        sortGenesByFrequency,
        sortSamplesByMutationLoad,
        sortSamplesByMetadata,
        filterByMutationFrequency,
        // Visualizer instance
        visualizer: visualizerRef.current
    };
}

export { DEFAULT_VARIANT_COLORS, DataProcessor, EventEmitter, MafParser, MetadataParser, Oncoprint, OncoprintRenderer, OncoprintVisualizer, VariantColorManager, useOncoprint };
//# sourceMappingURL=index.esm.js.map
