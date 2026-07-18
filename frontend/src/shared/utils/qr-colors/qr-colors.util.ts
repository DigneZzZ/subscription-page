/* QR-код рисуется как SVG со статическими цветами — читаем действующие
   значения темы из --sp-* на момент открытия модалки. */
export const getQrColors = (): { blackColor: string; whiteColor: string } => {
    const styles = getComputedStyle(document.documentElement)
    return {
        blackColor: styles.getPropertyValue('--sp-acc').trim() || '#e8c56b',
        whiteColor: styles.getPropertyValue('--sp-inset-bg').trim() || '#0b1222'
    }
}
