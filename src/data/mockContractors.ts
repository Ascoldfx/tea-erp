import type { Contractor, ContractorJob } from '../types/contractors';

export const MOCK_CONTRACTORS: Contractor[] = [
    {
        id: 'cnt-001',
        name: 'УпакСервис',
        contactPerson: 'Иван Петров',
        email: 'ivan@upakservice.ua',
        phone: '+380 (50) 111-22-33',
        address: 'г. Киев, ул. Промышленная, 10',
        balance: 15000,
        paymentTerms: 'postpayment',
        paymentDelayDays: 14
    },
    {
        id: 'cnt-002',
        name: 'Фасовка ПРО',
        contactPerson: 'Анна Сидорова',
        email: 'anna@fasovka.pro',
        phone: '+380 (67) 444-55-66',
        address: 'г. Львов, ул. Зеленая, 5',
        balance: 0,
        paymentTerms: 'prepayment',
        paymentDelayDays: 0
    }
];

export const MOCK_JOBS: ContractorJob[] = [
    {
        id: 'job-1001',
        contractorId: 'cnt-001',
        date: '2023-10-25',
        description: 'Фасовка Чай Черный (1000 пачек)',
        status: 'completed',
        totalAmount: 50000
    },
    {
        id: 'job-1002',
        contractorId: 'cnt-002',
        date: '2023-10-26',
        description: 'Фасовка Ароматизированный (500 пачек)',
        status: 'in_progress',
        totalAmount: 35000
    },
    {
        id: 'job-1003',
        contractorId: 'cnt-001',
        date: '2023-10-27',
        description: 'Упаковка в термоусадочную пленку',
        status: 'planned',
        totalAmount: 15000
    }
];
