import { create } from 'zustand'

interface IState {
    supportEmail: string
}

interface IActions {
    actions: {
        setSupportEmail: (email: string) => void
    }
}

const initialState: IState = {
    supportEmail: ''
}

export const useSupportStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setSupportEmail: (email: string) => {
            set({ supportEmail: email })
        }
    }
}))

export const useSupportStoreActions = () => useSupportStore((store) => store.actions)

export const useSupportEmail = () => useSupportStore((state) => state.supportEmail)
