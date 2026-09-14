import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Perf audit: tree-shake selectivo de librerías con barrel exports grandes.
  // `lucide-react` es el mayor ofensor (usamos ~35 íconos por archivo cliente
  // — sin este flag Next incluye TODOS los íconos en cada chunk).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-popover",
      "@radix-ui/react-dropdown-menu",
    ],
  },
};

export default nextConfig;
