import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Regatta {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue?: string;
  city?: string;
  state?: string;
  status?: string;
}

export interface Club {
  id: string;
  name: string;
  short_name: string;
  city?: string;
  state?: string;
}

export interface Athlete {
  id?: string;
  first_name: string;
  last_name: string;
  gender?: string;
  birth_date?: string;
  club_id?: string;
}

interface AppState {
  activeRegatta: Regatta | null;
  followedClub: Club | null;
  followedAthlete: Athlete | null;

  setActiveRegatta: (regatta: Regatta | null) => void;
  setFollowedClub: (club: Club | null) => void;
  setFollowedAthlete: (athlete: Athlete | null) => void;
  clearAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeRegatta: null,
      followedClub: null,
      followedAthlete: null,

      setActiveRegatta: (regatta) => set({ activeRegatta: regatta }),
      setFollowedClub: (club) => set({ followedClub: club }),
      setFollowedAthlete: (athlete) => set({ followedAthlete: athlete }),
      clearAll: () =>
        set({ activeRegatta: null, followedClub: null, followedAthlete: null }),
    }),
    {
      name: "rowday-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
