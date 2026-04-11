export type Role = 'admin' | 'moderator' | 'user';

export interface ScItem {
  name: string;
  /** clothing | armor | weapon | commodity | consumable | paint | ship | item */
  type: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface Asset {
  id: string;
  item: string;
  amount: number;
  buyPrice: number; // aUEC per unit
  location: string;
  createdAt: string;
  loggedBy?: string; // nickname of the user who created the record (Firebase mode only)
}

export interface Trade {
  id: string;
  assetId: string;
  item: string;
  amountSold: number;
  buyPrice?: number;  // aUEC per unit at time of sale (absent on legacy records)
  sellPrice: number;  // aUEC per unit
  sellLocation: string;
  soldAt: string;
  loggedBy?: string; // nickname of the user who logged the trade (Firebase mode only)
}

