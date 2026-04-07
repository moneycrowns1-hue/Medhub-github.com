import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages necesita export estático
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Base path para repositorio con nombre personalizado
  // Si tu repo es: username.github.io/repo-name, usa "/repo-name"
  // Si es username.github.io, usa "/"
  basePath: process.env.NODE_ENV === "production" ? "/somagnus" : "",
  assetPrefix: process.env.NODE_ENV === "production" ? "/somagnus" : "",
  // Permitir orígenes de desarrollo
  allowedDevOrigins: ["http://localhost:3000", "http://192.168.100.13:3000"],
};

export default nextConfig;
