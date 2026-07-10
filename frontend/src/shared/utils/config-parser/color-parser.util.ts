/* Geolog brand: neutral names (cyan/teal/green/violet/blue) collapse to the
   brand green — same monochrome mapping as global.css; warm names stay semantic. */
const COLORS: Record<string, [number, number, number]> = {
    cyan: [95, 233, 164],
    teal: [95, 233, 164],
    green: [95, 233, 164],
    lime: [130, 201, 30],
    yellow: [250, 176, 5],
    orange: [253, 126, 20],
    red: [250, 82, 82],
    pink: [230, 73, 128],
    grape: [190, 75, 219],
    violet: [95, 233, 164],
    indigo: [92, 124, 250],
    blue: [95, 233, 164],
    gray: [134, 142, 150],
    dark: [55, 58, 64]
}

const DEFAULT_COLOR = COLORS.cyan

const hexToRgb = (hex: string): [number, number, number] | null => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null
}

const getRgb = (color: string): [number, number, number] =>
    COLORS[color] ?? hexToRgb(color) ?? DEFAULT_COLOR

export interface ColorGradientStyle {
    background: string
    border: string
    boxShadow?: string
}

export const getColorGradient = (color: string): ColorGradientStyle => {
    const [r, g, b] = getRgb(color)
    return {
        background: `linear-gradient(135deg, rgba(${r},${g},${b},0.15) 0%, rgba(${r},${g},${b},0.08) 100%)`,
        border: `1px solid rgba(${r},${g},${b},0.3)`
    }
}

export const getColorGradientSolid = (color: string): ColorGradientStyle => {
    const [r, g, b] = getRgb(color)
    const dark1 = [14 + r * 0.08, 21 + g * 0.08, 19 + b * 0.08].map(Math.floor)
    const dark2 = [11 + r * 0.05, 16 + g * 0.05, 14 + b * 0.05].map(Math.floor)

    return {
        background: `linear-gradient(135deg, rgb(${dark1}) 0%, rgb(${dark2}) 100%)`,
        border: `1px solid rgba(${r},${g},${b},0.4)`,
        boxShadow: `inset 0 0 20px rgba(${r},${g},${b},0.15)`
    }
}
