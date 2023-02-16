export interface PackageAdvisory {
    id: string;
    type: string;
    score: string;
    severity: string;
    package: string;
    introduced: string;
    fixed?: string;
};