import { Injectable, Logger } from '@nestjs/common';

export interface DnbRecord {
  dunsNumber: string;
  companyName: string;
  taxId: string;
  creditScore: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  annualRevenue: number;
  employeeCount: number;
  industry: string;
  state: string;
  yearFounded: number;
}

const MOCK_COMPANIES: DnbRecord[] = [
  { dunsNumber: '12-345-6789', companyName: 'Acme Corp', taxId: '12-3456789', creditScore: 720, riskTier: 'LOW', annualRevenue: 5000000, employeeCount: 50, industry: 'Manufacturing', state: 'NY', yearFounded: 1985 },
  { dunsNumber: '23-456-7890', companyName: 'TechVentures Inc', taxId: '23-4567890', creditScore: 680, riskTier: 'MEDIUM', annualRevenue: 12000000, employeeCount: 120, industry: 'Technology', state: 'CA', yearFounded: 2010 },
  { dunsNumber: '34-567-8901', companyName: 'Midwest Logistics LLC', taxId: '34-5678901', creditScore: 590, riskTier: 'HIGH', annualRevenue: 3200000, employeeCount: 35, industry: 'Transportation', state: 'IL', yearFounded: 1998 },
  { dunsNumber: '45-678-9012', companyName: 'Coastal Realty Group', taxId: '45-6789012', creditScore: 750, riskTier: 'LOW', annualRevenue: 22000000, employeeCount: 200, industry: 'Real Estate', state: 'FL', yearFounded: 1975 },
  { dunsNumber: '56-789-0123', companyName: 'Pioneer Construction', taxId: '56-7890123', creditScore: 620, riskTier: 'MEDIUM', annualRevenue: 8500000, employeeCount: 85, industry: 'Construction', state: 'TX', yearFounded: 2001 },
  { dunsNumber: '67-890-1234', companyName: 'NorthStar Healthcare', taxId: '67-8901234', creditScore: 710, riskTier: 'LOW', annualRevenue: 45000000, employeeCount: 500, industry: 'Healthcare', state: 'MN', yearFounded: 1992 },
  { dunsNumber: '78-901-2345', companyName: 'Skyline Hotels & Resorts', taxId: '78-9012345', creditScore: 540, riskTier: 'HIGH', annualRevenue: 18000000, employeeCount: 300, industry: 'Hospitality', state: 'NV', yearFounded: 2005 },
  { dunsNumber: '89-012-3456', companyName: 'GreenLeaf Agriculture', taxId: '89-0123456', creditScore: 660, riskTier: 'MEDIUM', annualRevenue: 2800000, employeeCount: 28, industry: 'Agriculture', state: 'IA', yearFounded: 1960 },
  { dunsNumber: '90-123-4567', companyName: 'Atlantic Shipping Co', taxId: '90-1234567', creditScore: 480, riskTier: 'VERY_HIGH', annualRevenue: 6700000, employeeCount: 72, industry: 'Maritime', state: 'NJ', yearFounded: 1988 },
  { dunsNumber: '01-234-5678', companyName: 'Summit Financial Services', taxId: '01-2345678', creditScore: 800, riskTier: 'LOW', annualRevenue: 95000000, employeeCount: 800, industry: 'Financial Services', state: 'NY', yearFounded: 1955 },
  { dunsNumber: '11-222-3333', companyName: 'Desert Solar Energy', taxId: '11-2223333', creditScore: 700, riskTier: 'LOW', annualRevenue: 15000000, employeeCount: 90, industry: 'Energy', state: 'AZ', yearFounded: 2015 },
  { dunsNumber: '22-333-4444', companyName: 'Lakeview Restaurants', taxId: '22-3334444', creditScore: 560, riskTier: 'HIGH', annualRevenue: 4100000, employeeCount: 110, industry: 'Food & Beverage', state: 'WI', yearFounded: 2003 },
  { dunsNumber: '33-444-5555', companyName: 'Pacific Tech Innovations', taxId: '33-4445555', creditScore: 730, riskTier: 'LOW', annualRevenue: 31000000, employeeCount: 250, industry: 'Technology', state: 'WA', yearFounded: 2008 },
  { dunsNumber: '44-555-6666', companyName: 'Heritage Insurance Group', taxId: '44-5556666', creditScore: 780, riskTier: 'LOW', annualRevenue: 120000000, employeeCount: 1200, industry: 'Insurance', state: 'CT', yearFounded: 1945 },
  { dunsNumber: '55-666-7777', companyName: 'Canyon Retail Partners', taxId: '55-6667777', creditScore: 610, riskTier: 'MEDIUM', annualRevenue: 7300000, employeeCount: 160, industry: 'Retail', state: 'CO', yearFounded: 2000 },
];

@Injectable()
export class DnbService {
  private readonly logger = new Logger(DnbService.name);

  lookup(taxId?: string, companyName?: string): {
    found: boolean;
    record?: DnbRecord;
    matchedBy?: string;
    lookedUpAt: string;
  } {
    this.logger.log(`D&B lookup: taxId=${taxId ?? 'n/a'} companyName=${companyName ?? 'n/a'}`);
    let record: DnbRecord | undefined;
    let matchedBy: string | undefined;

    if (taxId) {
      record = MOCK_COMPANIES.find((c) => c.taxId === taxId);
      if (record) matchedBy = 'taxId';
    }
    if (!record && companyName) {
      const lower = companyName.toLowerCase();
      record = MOCK_COMPANIES.find((c) => c.companyName.toLowerCase().includes(lower));
      if (record) matchedBy = 'companyName';
    }

    return { found: !!record, record, matchedBy, lookedUpAt: new Date().toISOString() };
  }

  list(): DnbRecord[] {
    return MOCK_COMPANIES;
  }
}
