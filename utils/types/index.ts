export interface IUser {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  profile: string;
  bio: string;
  partnerId: string;
  isPaired: boolean;
  points: number;
}

export interface IQuotes {
  id: string;
  users: string[];
  score: number;
  paid: boolean;
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
