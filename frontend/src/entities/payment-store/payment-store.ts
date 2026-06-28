import { create } from 'zustand'

export interface IPaymentTariff {
    amount: number
    currency: string
    months: number
    days?: number
    id?: number
    name?: string
    description?: string
}

export interface IPaymentReset {
    amount: number
    currency: string
    minPercent: number
    dynamic?: boolean
}

interface IState {
    paymentUrl: string
    reset: IPaymentReset | null
    tariffs: IPaymentTariff[]
}

interface IActions {
    actions: {
        setPaymentUrl: (url: string) => void
        setReset: (reset: IPaymentReset | null) => void
        setTariffs: (tariffs: IPaymentTariff[]) => void
    }
}

const initialState: IState = {
    paymentUrl: '',
    tariffs: [],
    reset: null
}

export const usePaymentStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setPaymentUrl: (url: string) => {
            set({ paymentUrl: url })
        },
        setTariffs: (tariffs: IPaymentTariff[]) => {
            set({ tariffs })
        },
        setReset: (reset: IPaymentReset | null) => {
            set({ reset })
        }
    }
}))

export const usePaymentStoreActions = () => usePaymentStore((store) => store.actions)

export const usePaymentUrl = () => usePaymentStore((state) => state.paymentUrl)

export const usePaymentTariffs = () => usePaymentStore((state) => state.tariffs)

export const usePaymentReset = () => usePaymentStore((state) => state.reset)
