import { execSync } from "node:child_process";

/**
 * Orquestador de seeds. Corre en orden:
 *   1. countries-states  (Argentina + provincias — base geográfica)
 *   2. roles-permissions (admin/internal/customer/…)
 *   3. admin-user        (usuario admin@example.com / Admin$123456)
 *   4. sample-clients    (3 customers base + sus vehicles)
 *   5. sample-leads-budgets (customers extra + 10 leads con todos los estados del embudo)
 *
 * Cada seed es reruneable (limpia sus datos primero).
 */

const steps: Array<{ label: string; file: string }> = [
    { label: "🌍 Countries & states", file: "prisma/seed/countries-states.ts" },
    { label: "🔐 Roles & permissions", file: "prisma/seed/roles-permissions.ts" },
    { label: "👤 Admin user (default)", file: "prisma/seed/admin-user.ts" },
    { label: "👤 Admin user (test)", file: "prisma/seed/test-admin-user.ts" },
    { label: "⚙️  App settings (singleton)", file: "prisma/seed/app-settings.ts" },
    { label: "🏢 Insurance companies", file: "prisma/seed/insurance-companies.ts" },
    { label: "📥 Lead sources", file: "prisma/seed/lead-sources.ts" },
    { label: "👥 Sample clients", file: "prisma/seed/sample-clients.ts" },
    { label: "🔧 Sample parts (inventory)", file: "prisma/seed/sample-parts.ts" },
    { label: "🔨 Sample tools", file: "prisma/seed/sample-tools.ts" },
    { label: "📝 Sample leads + budgets", file: "prisma/seed/sample-leads-budgets.ts" },
    { label: "💰 Sample payments", file: "prisma/seed/sample-payments.ts" },
];

async function runAllSeeds() {
    try {
        console.log("🌱 Running all seeds...\n");
        steps.forEach(({ label, file }, idx) => {
            console.log(`${idx + 1}️⃣  ${label}`);
            execSync(`bunx tsx ${file}`, { stdio: "inherit" });
            console.log("");
        });
        console.log("✅ All seeds completed successfully!");
    } catch (error) {
        console.error("❌ Error running seeds:", error);
        process.exit(1);
    }
}

runAllSeeds();
