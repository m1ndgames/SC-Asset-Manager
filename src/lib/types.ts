export interface Asset {
  id: string;
  item: string;
  amount: number;
  buyPrice: number; // aUEC per unit
  location: string;
  createdAt: string;
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
}

