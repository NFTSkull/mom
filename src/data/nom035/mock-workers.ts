import type { Worker } from "@/types/nom035";

export const MOCK_WORKERS: Worker[] = [
  {
    id: "worker-001",
    employeeNumber: "A-1001",
    fullName: "Ana Torres",
    email: "ana.torres@acme.local",
    department: "Operaciones",
    position: "Coordinadora",
    status: "ACTIVE",
  },
  {
    id: "worker-002",
    employeeNumber: "A-1002",
    fullName: "Luis Mendoza",
    email: "luis.mendoza@acme.local",
    department: "Almacen",
    position: "Auxiliar",
    status: "ACTIVE",
  },
  {
    id: "worker-003",
    employeeNumber: "A-1003",
    fullName: "Sofia Ramirez",
    email: "sofia.ramirez@acme.local",
    department: "Recursos Humanos",
    position: "Generalista",
    status: "ACTIVE",
  },
];
