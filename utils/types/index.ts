export interface IUser {
  id: string;
  name: string;
  email: string;

  verified: boolean;
  paid: boolean;
  lastbill?: string;
  profile?: string;
  photoURL?: string | null;
  bio: string;
  partnerId: string;
  isPaired: boolean;
  score: number;
  coupleId?: string;
  ai_consent_at?: string | null;
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
