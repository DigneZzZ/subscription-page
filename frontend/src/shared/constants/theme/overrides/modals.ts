import { Modal } from '@mantine/core'

/* Geolog: brand the default modal chrome (openConfirmModal — reset traffic,
   delete devices) to match the widget modals' .modalContent styling. */
export default {
    Modal: Modal.extend({
        styles: {
            content: {
                background:
                    'linear-gradient(160deg, rgba(16, 36, 27, 0.97) 0%, rgba(12, 21, 18, 0.97) 100%)',
                border: '1px solid rgba(95, 233, 164, 0.3)'
            },
            header: {
                background: 'transparent'
            },
            title: {
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: '#e7efe9'
            }
        }
    })
}
