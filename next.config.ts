import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages necesita export estático
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Base path fijo para el nombre real del repositorio en GitHub Pages
  basePath: "/Medhub-github.com",
  assetPrefix: "/Medhub-github.com",
  // Permitir orígenes de desarrollo
  allowedDevOrigins: ["http://localhost:3000", "http://192.168.100.13:3000"],
};

export default nextConfig;
