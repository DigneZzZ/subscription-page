import { create } from 'zustand'

export interface IDevice {
    createdAt: string
    deviceModel: null | string
    hwid: string
    osVersion: null | string
    platform: null | string
}

interface IState {
    enabled: boolean
}

interface IActions {
    actions: {
        setEnabled: (v: boolean) => void
    }
}

const initialState: IState = {
    enabled: false
}

export const useDevicesStore = create<IActions & IState>()((set) => ({
    ...initialState,
    actions: {
        setEnabled: (v: boolean) => {
            set({ enabled: v })
        }
    }
}))

export const useDevicesStoreActions = () => useDevicesStore((store) => store.actions)

export const useDevicesEnabled = () => useDevicesStore((state) => state.enabled)
