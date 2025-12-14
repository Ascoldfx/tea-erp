export interface Contractor {
    id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    balance: number; // Positive = We owe them, Negative = They owe us
    paymentTerms: 'prepayment' | 'postpayment';
    paymentDelayDays: number;
}

export type JobStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface ContractorJob {
    id: string;
    contractorId: string;
    date: string;
    description: string;
    status: JobStatus;
    totalAmount: number; // Cost of service
}
