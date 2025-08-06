export declare const DEFAULT_VARIANT_COLORS: {
    Missense_Mutation: string;
    Splice_Site: string;
    Frame_Shift_Del: string;
    Frame_Shift_Ins: string;
    In_Frame_Del: string;
    In_Frame_Ins: string;
    Nonsense_Mutation: string;
    Multi_Hit: string;
    Translation_Start_Site: string;
    Nonstop_Mutation: string;
    Default: string;
    Empty: string;
};
export declare class VariantColorManager {
    private predefinedColors;
    private dynamicColors;
    private colorPalette;
    private usedColors;
    constructor(predefinedColors?: Record<string, string>);
    getColor(variant: string): string;
    getAllColors(): Record<string, string>;
    getKnownVariants(): string[];
    getDynamicVariants(): string[];
    updateColor(variant: string, color: string): void;
    resetDynamicColors(): void;
    getColorLegend(variants: string[]): Array<{
        variant: string;
        color: string;
        isKnown: boolean;
    }>;
    private generateUniqueColor;
    private generateRandomColor;
    getVariantsByFrequency(variants: string[], counts: Record<string, number>): string[];
    static fromVariants(variants: string[], customColors?: Record<string, string>): VariantColorManager;
    exportColorMap(): Record<string, string>;
    importColorMap(colorMap: Record<string, string>): void;
}
