import { Timestamp } from "firebase/firestore";

export interface IUser {
  id: string;
  name: string;
  email: string;

  verified: boolean;
  paid: boolean;
  lastbill: Timestamp;
  profile: string;
  bio: string;
  partnerId: string;
  isPaired: boolean;
  score: number;
}

export interface IQuotes {
  id: string;
  users: string[];
  data: {
    date: string;
    quotes: {
      id: string;
      name: string;
      seen: boolean;
      text: string;
      time: string;
    }[];
  }[];
}
