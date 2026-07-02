import { BadRequestException, Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ifsc = require('ifsc') as {
  fetchDetails: (code: string) => Promise<IfscApiResponse>;
};

interface IfscApiResponse {
  BANK: string;
  BANKCODE: string;
  BRANCH: string;
  CITY: string;
  STATE: string;
  DISTRICT?: string;
  ADDRESS?: string;
  IFSC: string;
}

export interface IfscLookupSuccess {
  found: true;
  data: {
    bankName: string;
    bankCode: string;
    branchName: string;
    city: string;
    state: string;
    district?: string;
    address?: string;
    ifscCode: string;
  };
}

export interface IfscLookupFailure {
  found: false;
  ifscCode: string;
  reason: 'not_found';
}

export type IfscLookupResult = IfscLookupSuccess | IfscLookupFailure;

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

@Injectable()
export class IfscLookupService {
  async lookup(ifscCode: string): Promise<IfscLookupResult> {
    const normalized = ifscCode.trim().toUpperCase();

    if (!IFSC_REGEX.test(normalized)) {
      throw new BadRequestException(
        'Invalid IFSC format. Expected pattern: AAAA0XXXXXX',
      );
    }

    try {
      const data = await ifsc.fetchDetails(normalized);
      return {
        found: true,
        data: {
          bankName: data.BANK,
          bankCode: data.BANKCODE,
          branchName: data.BRANCH,
          city: data.CITY,
          state: data.STATE,
          district: data.DISTRICT,
          address: data.ADDRESS,
          ifscCode: data.IFSC ?? normalized,
        },
      };
    } catch {
      return { found: false, ifscCode: normalized, reason: 'not_found' };
    }
  }
}
