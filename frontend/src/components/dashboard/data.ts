// Sample portfolio data until there's a backend. `fetchProjects` mimics an
// async API call so the grid can swap to a real endpoint without UI changes.

export type Health = "red" | "potential-red" | "amber" | "green";

export type ProjectFilter = "all" | Health | "status-pending";

export type Region = "APAC" | "EMEA" | "Americas" | "MEA";

export type ProjectRow = {
  id: string;
  name: string;
  health: Health;
  criticalReason: string;
  priority: "P0" | "P1" | "P2" | "P3";
  daysOpen: number;
  owner: string;
  statusPending: boolean;
  region: Region;
};

export const PROJECTS: ProjectRow[] = [
  {
    id: "PRJ-2026-0042",
    name: "Global ERP Modernization",
    health: "red",
    criticalReason: "Vendor integration failed in APAC",
    priority: "P0",
    daysOpen: 14,
    owner: "Elena Vance",
    statusPending: true,
    region: "APAC",
  },
  {
    id: "PRJ-2026-0038",
    name: "Quantum Logistics Engine",
    health: "potential-red",
    criticalReason: "Resource gap: Technical Lead",
    priority: "P1",
    daysOpen: 4,
    owner: "Marcus Thorne",
    statusPending: false,
    region: "EMEA",
  },
  {
    id: "PRJ-2026-0031",
    name: "Data Privacy Audit 2024",
    health: "red",
    criticalReason: "Compliance blocker: GDPR Clause 4",
    priority: "P0",
    daysOpen: 22,
    owner: "Sarah Jenkins",
    statusPending: true,
    region: "EMEA",
  },
  {
    id: "PRJ-2025-0117",
    name: "Infrastructure Migration",
    health: "amber",
    criticalReason: "Cost variance > 10% against baseline",
    priority: "P2",
    daysOpen: 7,
    owner: "David Kim",
    statusPending: false,
    region: "Americas",
  },
  {
    id: "PRJ-2026-0027",
    name: "NorthStar Alpha",
    health: "red",
    criticalReason: "Go-live payment milestone at risk",
    priority: "P0",
    daysOpen: 9,
    owner: "Alexander Thorne",
    statusPending: true,
    region: "Americas",
  },
  {
    id: "PRJ-2026-0024",
    name: "FinSync Core Banking",
    health: "green",
    criticalReason: "UAT sign-off contractual by Oct 15",
    priority: "P2",
    daysOpen: 3,
    owner: "Priya Nair",
    statusPending: false,
    region: "MEA",
  },
  {
    id: "PRJ-2026-0019",
    name: "Atlas CRM Rollout",
    health: "potential-red",
    criticalReason: "Client sponsor unavailable for 3 weeks",
    priority: "P1",
    daysOpen: 11,
    owner: "Omar Haddad",
    statusPending: true,
    region: "APAC",
  },
  {
    id: "PRJ-2026-0015",
    name: "Helios Data Lake",
    health: "amber",
    criticalReason: "Data residency review pending legal",
    priority: "P2",
    daysOpen: 6,
    owner: "Chen Wei",
    statusPending: true,
    region: "APAC",
  },
  {
    id: "PRJ-2025-0102",
    name: "Orion Mobile Banking",
    health: "green",
    criticalReason: "On track — quarterly DE assessment due",
    priority: "P3",
    daysOpen: 2,
    owner: "Fatima Al-Rashid",
    statusPending: false,
    region: "MEA",
  },
  {
    id: "PRJ-2025-0096",
    name: "Zephyr API Gateway",
    health: "potential-red",
    criticalReason: "Forecast exceeds baseline by 18%",
    priority: "P1",
    daysOpen: 8,
    owner: "Lucas Meyer",
    statusPending: false,
    region: "Americas",
  },
  {
    id: "PRJ-2025-0089",
    name: "Titan Payments Hub",
    health: "red",
    criticalReason: "Trial SaaS instance in unauthorized region",
    priority: "P0",
    daysOpen: 1,
    owner: "Grace Osei",
    statusPending: false,
    region: "APAC",
  },
  {
    id: "PRJ-2025-0081",
    name: "Nova Analytics Suite",
    health: "green",
    criticalReason: "Steering committee review scheduled",
    priority: "P3",
    daysOpen: 5,
    owner: "Ivan Petrov",
    statusPending: false,
    region: "EMEA",
  },
];

function matches(project: ProjectRow, filter: ProjectFilter): boolean {
  if (filter === "all") return true;
  if (filter === "status-pending") return project.statusPending;
  return project.health === filter;
}

export function projectCount(filter: ProjectFilter): number {
  return PROJECTS.filter((p) => matches(p, filter)).length;
}

export function fetchProjects(filter: ProjectFilter): Promise<ProjectRow[]> {
  const rows = PROJECTS.filter((p) => matches(p, filter));
  return new Promise((resolve) => {
    setTimeout(() => resolve(rows), 300);
  });
}

