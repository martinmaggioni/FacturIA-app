export enum InvoiceType {
  A = 'Factura A',
  B = 'Factura B',
  C = 'Factura C',
}

export enum ConceptType {
  PRODUCTS = 'Productos',
  SERVICES = 'Servicios',
  BOTH = 'Productos y Servicios'
}

export enum PaymentCondition {
  CASH = 'Contado',
  DEBIT_CARD = 'Tarjeta de Débito',
  CREDIT_CARD = 'Tarjeta de Crédito',
  TRANSFER = 'Transferencia',
}

export interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  posNumber: number; // Point of Sale
  type: InvoiceType;
  date: string; // ISO Date
  concept: ConceptType;
  items: LineItem[];
  paymentCondition: PaymentCondition;
  scheduledFor?: string; // If set, it's a scheduled invoice
}

export interface UserCredentials {
  cuit: string;
  cert: string; // Contenido del archivo .crt
  key: string;  // Contenido del archivo .key
  companyName?: string;
}

export interface AppSettings {
  serverUrl: string;
}

export interface UserProfile extends UserCredentials {
  isLoggedIn: boolean;
}