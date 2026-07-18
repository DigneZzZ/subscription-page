const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
    const value = bytes / 1024 ** exp
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${UNITS[exp]}`
}
