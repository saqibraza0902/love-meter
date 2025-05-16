import { IUser } from "@/utils/types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface IState {
  user: IUser | null;
  partner: IUser | null;
  timer: number;
  lastSent: null | number;
}

const initialState: IState = {
  user: null,
  partner: null,
  timer: 0,
  lastSent: null as number | null,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setPartner: (state, action) => {
      state.partner = action.payload;
    },
    setTimer: (state, action: PayloadAction<number>) => {
      state.timer = action.payload;
    },
    setLastSent: (state, action: PayloadAction<number>) => {
      state.lastSent = action.payload;
    },
  },
});

export const { setUser, setPartner, setTimer, setLastSent } = userSlice.actions;

export default userSlice.reducer;
