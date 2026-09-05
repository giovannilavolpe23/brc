export type PreviaProductInput = {
  legacyId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type PreviaInput = {
  legacyId: string;
  participantIds: string[];
  products: PreviaProductInput[];
  totalAmount: number;
  amountPerParticipant: number;
  occurredAt: string;
};

export type PreviaProduct = PreviaProductInput & {
  id: string;
};

export type PreviaParticipant = {
  id: string;
  legacyId: string;
  displayName: string;
};

export type Previa = {
  id: string;
  legacyId: string;
  creatorUserId: string;
  totalAmount: number;
  amountPerParticipant: number;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  participantIds: string[];
  participants: PreviaParticipant[];
  products: PreviaProduct[];
};

export type ResolvedParticipant = {
  id: string;
  legacyId: string;
  displayName: string;
};
