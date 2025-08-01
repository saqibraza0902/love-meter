import { IQuotes } from "@/utils/types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface IState {
  quotes: IQuotes | null;
}

const initialState: IState = {
  quotes: null,
};

export const quotesSlice = createSlice({
  name: "quotes",
  initialState,
  reducers: {
    setQuote: (state, action: PayloadAction<IQuotes | null>) => {
      state.quotes = action.payload;
    },
  },
});

export const { setQuote } = quotesSlice.actions;

export default quotesSlice.reducer;
