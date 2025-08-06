import * as d3 from 'd3';

export const DEFAULT_VARIANT_COLORS = {
  Missense_Mutation: "#16a085",      // Teal
  Splice_Site: "#27ae60",            // Green
  Frame_Shift_Del: "#2980b9",        // Blue
  Frame_Shift_Ins: "#c0392b",        // Red
  In_Frame_Del: "#f39c12",           // Orange
  In_Frame_Ins: "#8e44ad",           // Purple
  Nonsense_Mutation: "#34495e",      // Dark Gray
  Multi_Hit: "#95a5a6",              // Gray
  Translation_Start_Site: "#e74c3c", // Light Red
  Nonstop_Mutation: "#d35400",       // Dark Orange
  Default: "#95a5a6",                // Gray
  Empty: "#ecf0f1"                   // Light Gray
};

export class VariantColorManager {
  private predefinedColors: Record<string, string>;
  private dynamicColors: Record<string, string> = {};
  private colorPalette: readonly string[];
  private usedColors: Set<string> = new Set();

  constructor(predefinedColors: Record<string, string> = DEFAULT_VARIANT_COLORS) {
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

  getColor(variant: string): string {
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

  getAllColors(): Record<string, string> {
    return { ...this.predefinedColors, ...this.dynamicColors };
  }

  getKnownVariants(): string[] {
    return Object.keys(this.predefinedColors).filter(v => v !== 'Default' && v !== 'Empty');
  }

  getDynamicVariants(): string[] {
    return Object.keys(this.dynamicColors);
  }

  updateColor(variant: string, color: string): void {
    if (this.predefinedColors[variant]) {
      this.predefinedColors[variant] = color;
    } else {
      this.dynamicColors[variant] = color;
    }
    this.usedColors.add(color);
  }

  resetDynamicColors(): void {
    // Remove dynamic colors from used colors set
    Object.values(this.dynamicColors).forEach(color => {
      this.usedColors.delete(color);
    });
    this.dynamicColors = {};
  }

  getColorLegend(variants: string[]): Array<{ variant: string; color: string; isKnown: boolean }> {
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
        if (a.isKnown && !b.isKnown) return -1;
        if (!a.isKnown && b.isKnown) return 1;
        return a.variant.localeCompare(b.variant);
      });
  }

  private generateUniqueColor(): string {
    // Try colors from the palette first
    for (const color of this.colorPalette) {
      if (!this.usedColors.has(color)) {
        this.usedColors.add(color);
        return color;
      }
    }

    // If all palette colors are used, generate a random color
    let attempts = 0;
    let color: string;
    
    do {
      color = this.generateRandomColor();
      attempts++;
    } while (this.usedColors.has(color) && attempts < 100);

    this.usedColors.add(color);
    return color;
  }

  private generateRandomColor(): string {
    // Generate a color with good contrast and saturation
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.floor(Math.random() * 30); // 60-90%
    const lightness = 40 + Math.floor(Math.random() * 20);  // 40-60%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  getVariantsByFrequency(variants: string[], counts: Record<string, number>): string[] {
    return [...variants].sort((a, b) => {
      const countA = counts[a] || 0;
      const countB = counts[b] || 0;
      return countB - countA;
    });
  }

  static fromVariants(variants: string[], customColors?: Record<string, string>): VariantColorManager {
    const manager = new VariantColorManager(customColors);
    
    // Pre-generate colors for all variants
    variants.forEach(variant => {
      manager.getColor(variant);
    });

    return manager;
  }

  exportColorMap(): Record<string, string> {
    return {
      ...this.predefinedColors,
      ...this.dynamicColors
    };
  }

  importColorMap(colorMap: Record<string, string>): void {
    Object.entries(colorMap).forEach(([variant, color]) => {
      if (this.predefinedColors[variant]) {
        this.predefinedColors[variant] = color;
      } else {
        this.dynamicColors[variant] = color;
      }
      this.usedColors.add(color);
    });
  }
}