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
  sellPrice: number; // aUEC per unit
  sellLocation: string;
  soldAt: string;
}

