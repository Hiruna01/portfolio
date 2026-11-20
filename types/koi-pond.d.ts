// Types for koi-pond (github.com/Hiruna01/ascii-koi), which ships plain JavaScript.
declare module "koi-pond" {
  export type KoiPondOptions = {
    target?: Element | string | null;
    canvas?: HTMLCanvasElement | null;
    count?: number;
    fishSize?: number | "auto";
    fishScale?: number;
    butterfly?: number;
    varieties?: "all" | string[];
    behavior?: "natural" | "simple";
    feeding?: boolean;
    colors?: "ink" | "koi";
    ink?: string;
    background?: string;
    mode?: "bayer" | "lines";
    tones?: number;
    pixelSize?: number;
    speed?: number;
    dartBoost?: number;
    dartDuration?: number;
    interactive?: boolean;
    reducedMotion?: "auto" | boolean;
    maxDpr?: number;
    zIndex?: number;
    seed?: number | null;
  };

  export type KoiPond = {
    canvas: HTMLCanvasElement;
    set(options: KoiPondOptions): void;
    pause(): void;
    resume(): void;
    destroy(): void;
  };

  export function createKoiPond(options?: KoiPondOptions): KoiPond;
  export default createKoiPond;
}
