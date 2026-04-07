import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages necesita export estático
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Base path fijo para repositorio /somagnus en GitHub Pages
  basePath: "/somagnus",
  assetPrefix: "/somagnus",
  // Permitir orígenes de desarrollo
  allowedDevOrigins: ["http://localhost:3000", "http://192.168.100.13:3000"],
};

export default nextConfig;
