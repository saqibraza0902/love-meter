import { combineReducers } from "redux";
import user from "./user-slice";
import quotes from "./quotes-slice";
const rootReducer = combineReducers({
  user: user,
  quotes: quotes,
});

export default rootReducer;
