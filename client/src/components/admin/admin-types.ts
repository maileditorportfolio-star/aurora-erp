export interface PlatformStats {
  organizations: number;
  activeOrganizations: number;
  users: number;
  monthRevenue: number;
  monthInvoices: number;
  license: LicenseStatus;
}

export interface LicenseStatus {
  valid: boolean;
  enforced: boolean;
  edition: string;
  licensee?: string;
  expiresAt?: string;
  maxOrganizations?: number;
  maxUsers?: number;
  features: string[];
  licenseId?: string;
  reason?: string;
  environment?: string;
  appVersion?: string;
}
