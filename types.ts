import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

// Represents the authenticated user, aliased from Firebase for clarity.
export type User = FirebaseUser;

// Defines the possible pages in the application's navigation.
export type Page = 'overview' | 'extractor' | 'orders' | 'destinations';

// Defines the possible statuses for a purchase order.
export type PurchaseOrderStatus = 'Iniciado' | 'Recebido' | 'Cancelado';

// Represents a single item within a purchase order.
// Includes original fields and fields for mapping to an ERP system.
export interface PurchaseOrderItem {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
  // ERP Destination Fields
  codigoDestino?: string;
  descricaoDestino?: string;
  unidadeDestino?: string;
  quantidadeDestino?: number;
  precoUnitarioDestino?: number;
  precoTotalDestino?: number;
}

// Represents a file attached to a purchase order.
export interface Attachment {
  url: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
}

// Represents the data structure extracted from a document by the Gemini API.
// This is the base data before it's saved to the database.
export interface ExtractedPurchaseOrder {
  fornecedor: string;
  cnpj?: string; // CNPJ added
  notaFiscal?: string;
  operacao: string;
  filial: string;
  pedido: string;
  sequencia: string;
  data: string;
  emissao: string;
  recebimento: string;
  observacoes: string;
  linkEntrada?: string; // New field for entry link
  nomeReferencia: string;
  items: PurchaseOrderItem[];
  totalGeral: number;
  status: PurchaseOrderStatus;
  
  // Classification flags
  isBook: boolean;
  isSite: boolean;
  isRevisaoImpostos: boolean;
  isCasado: boolean;
  isEstoque: boolean;
  isRemarcar: boolean;
}

// Represents a complete purchase order as stored in the Firestore database.
// It includes the extracted data plus metadata like ID and timestamps.
export interface PurchaseOrder extends ExtractedPurchaseOrder {
  id: string;
  userId: string;
  createdBy: string;
  creatorEmail: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updaterEmail?: string;
  updatedAt?: Timestamp;
  attachments: Attachment[];
}
