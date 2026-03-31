import { create } from 'zustand'

interface IState {
    paymentUrl: string
}

interface IActions {
    actions: {
        setPaymentUrl: (url: string) => void
    }
}

const initialState: IState = {
    paymentUrl: ''
}

export const usePaymentStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setPaymentUrl: (url: string) => {
            set({ paymentUrl: url })
        }
    }
}))

export const usePaymentStoreActions = () => usePaymentStore((store) => store.actions)

export const usePaymentUrl = () => usePaymentStore((state) => state.paymentUrl)
