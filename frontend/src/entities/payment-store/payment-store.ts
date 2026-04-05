import { create } from 'zustand'

export interface IPaymentTariff {
    months: number
    amount: number
    currency: string
    url: string
}

interface IState {
    paymentUrl: string
    tariffs: IPaymentTariff[]
}

interface IActions {
    actions: {
        setPaymentUrl: (url: string) => void
        setTariffs: (tariffs: IPaymentTariff[]) => void
    }
}

const initialState: IState = {
    paymentUrl: '',
    tariffs: []
}

export const usePaymentStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setPaymentUrl: (url: string) => {
            set({ paymentUrl: url })
        },
        setTariffs: (tariffs: IPaymentTariff[]) => {
            set({ tariffs })
        }
    }
}))

export const usePaymentStoreActions = () => usePaymentStore((store) => store.actions)

export const usePaymentUrl = () => usePaymentStore((state) => state.paymentUrl)

export const usePaymentTariffs = () => usePaymentStore((state) => state.tariffs)
