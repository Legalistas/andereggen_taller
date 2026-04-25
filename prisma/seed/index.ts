import { execSync } from "node:child_process";

/**
 * Orquestador de seeds. Corre en orden:
 *   1. countries-states   (Argentina + provincias)
 *   2. roles-permissions  (admin/internal/customer/…)
 *   3. admin-user         (usuario admin inicial)
 *   4. app-settings       (singleton de configuración)
 *   5. insurance-companies
 *   6. lead-sources
 *
 * Cada seed es reruneable (upsert / limpia sus datos primero).
 */

const steps: Array<{ label: string; file: string }> = [
  { label: "Countries & states", file: "prisma/seed/countries-states.ts" },
  { label: "Roles & permissions", file: "prisma/seed/roles-permissions.ts" },
  { label: "Admin user", file: "prisma/seed/admin-user.ts" },
  { label: "App settings (singleton)", file: "prisma/seed/app-settings.ts" },
  { label: "Insurance companies", file: "prisma/seed/insurance-companies.ts" },
  { label: "Lead sources", file: "prisma/seed/lead-sources.ts" },
  { label: "Vehicle catalog", file: "prisma/seed/vehicle-catalog.ts" },
];

async function runAllSeeds() {
  try {
    console.log("Running all seeds...\n");
    steps.forEach(({ label, file }, idx) => {
      console.log(`${idx + 1}. ${label}`);
      execSync(`bunx tsx ${file}`, { stdio: "inherit" });
      console.log("");
    });
    console.log("All seeds completed successfully.");
  } catch (error) {
    console.error("Error running seeds:", error);
    process.exit(1);
  }
}

runAllSeeds();
