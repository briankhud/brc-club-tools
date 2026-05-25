import { create } from "zustand";

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

export const useAppStore = create<AppState>((set) => ({
  // Default to Brighton Burn 2026 / BRC for development convenience.
  // In production this would be persisted to AsyncStorage and start as null
  // until the user completes onboarding.
  activeRegatta: {
    id: "bb-2026",
    name: "Brighton Burn 2026",
    start_date: "2026-02-28",
    end_date: "2026-02-28",
    venue: "Twelve Corners Middle School",
    city: "Rochester",
    state: "NY",
    status: "upcoming",
  },
  followedClub: {
    id: "c1",
    name: "Brighton Rowing Club",
    short_name: "BRC",
    city: "Rochester",
    state: "NY",
  },
  followedAthlete: {
    id: "a2",
    first_name: "Nora",
    last_name: "Ashworth",
    gender: "F",
  },

  setActiveRegatta: (regatta) => set({ activeRegatta: regatta }),
  setFollowedClub: (club) => set({ followedClub: club }),
  setFollowedAthlete: (athlete) => set({ followedAthlete: athlete }),
  clearAll: () =>
    set({ activeRegatta: null, followedClub: null, followedAthlete: null }),
}));
