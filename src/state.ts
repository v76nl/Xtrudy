export interface SliderConfig {
  sliderId: string;
  numId: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
}

export const SLIDER_CONFIGS = {
  textSize: {
    sliderId: "text-size",
    numId: "val-text-size",
    min: 5,
    max: 100,
    step: 1,
    defaultValue: 10,
    unit: "mm",
  },
  textSpacing: {
    sliderId: "text-spacing",
    numId: "val-text-spacing",
    min: -5,
    max: 20,
    step: 0.5,
    defaultValue: -1,
    unit: "mm",
  },
  svgScale: {
    sliderId: "svg-scale",
    numId: "val-svg-scale",
    min: 0.01,
    max: 5,
    step: 0.01,
    defaultValue: 1.0,
    unit: "x",
  },
  modelThickness: {
    sliderId: "model-thickness",
    numId: "val-model-thickness",
    min: 0.25,
    max: 15,
    step: 0.25,
    defaultValue: 1,
    unit: "mm",
  },
  basePadding: {
    sliderId: "base-padding",
    numId: "val-base-padding",
    min: 0,
    max: 20,
    step: 0.5,
    defaultValue: 2,
    unit: "mm",
  },
  baseThickness: {
    sliderId: "base-thickness",
    numId: "val-base-thickness",
    min: 0.5,
    max: 10,
    step: 0.5,
    defaultValue: 2,
    unit: "mm",
  },
  baseRadius: {
    sliderId: "base-radius",
    numId: "val-base-radius",
    min: 0,
    max: 20,
    step: 0.5,
    defaultValue: 5,
    unit: "mm",
  },
  ringX: {
    sliderId: "ring-x",
    numId: "val-ring-x",
    min: -100,
    max: 100,
    step: 0.5,
    defaultValue: 0,
    unit: "mm",
  },
  ringY: {
    sliderId: "ring-y",
    numId: "val-ring-y",
    min: -100,
    max: 100,
    step: 0.5,
    defaultValue: 11.5,
    unit: "mm",
  },
  ringSize: {
    sliderId: "ring-size",
    numId: "val-ring-size",
    min: 1,
    max: 20,
    step: 0.5,
    defaultValue: 3,
    unit: "mm",
  },
  ringTube: {
    sliderId: "ring-tube",
    numId: "val-ring-tube",
    min: 0.5,
    max: 5,
    step: 0.1,
    defaultValue: 1,
    unit: "mm",
  },
  ringRot: {
    sliderId: "ring-rot",
    numId: "val-ring-rot",
    min: 0,
    max: 360,
    step: 15,
    defaultValue: 0,
    unit: "°",
  },
} as const satisfies Record<string, SliderConfig>;

export type SliderKey = keyof typeof SLIDER_CONFIGS;

export interface StateType {
  mode: "text" | "svg";
  text: string;
  fontKey: string;
  textDirection: "horizontal" | "vertical";
  textSize: number;
  textSpacing: number;
  modelThickness: number;
  svgContent: string | null;
  svgScale: number;
  mirrorX: boolean;
  baseEnabled: boolean;
  basePadding: number;
  baseThickness: number;
  baseRadius: number;
  ringEnabled: boolean;
  ringShape: number;
  ringAutoY: boolean;
  ringX: number;
  ringY: number;
  ringSize: number;
  ringTube: number;
  ringRot: number;
  ringReinforce: boolean;
  [key: string]: any;
}

export const state: StateType = {
  mode: "text",
  text: "Xtrudy",
  fontKey: "sans",
  textDirection: "horizontal",
  textSize: SLIDER_CONFIGS.textSize.defaultValue,
  textSpacing: SLIDER_CONFIGS.textSpacing.defaultValue,
  modelThickness: SLIDER_CONFIGS.modelThickness.defaultValue,
  svgContent: null,
  svgScale: SLIDER_CONFIGS.svgScale.defaultValue,
  mirrorX: false,
  baseEnabled: true,
  basePadding: SLIDER_CONFIGS.basePadding.defaultValue,
  baseThickness: SLIDER_CONFIGS.baseThickness.defaultValue,
  baseRadius: SLIDER_CONFIGS.baseRadius.defaultValue,
  ringEnabled: true,
  ringShape: 32,
  ringAutoY: false,
  ringX: SLIDER_CONFIGS.ringX.defaultValue,
  ringY: SLIDER_CONFIGS.ringY.defaultValue,
  ringSize: SLIDER_CONFIGS.ringSize.defaultValue,
  ringTube: SLIDER_CONFIGS.ringTube.defaultValue,
  ringRot: SLIDER_CONFIGS.ringRot.defaultValue,
  ringReinforce: true,
};
