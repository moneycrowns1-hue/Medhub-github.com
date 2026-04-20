import { SpaceThemeProvider } from "@/components/space-theme";
import { SpaceClient } from "./space-client";

export default function SpacePage() {
  return (
    <SpaceThemeProvider>
      <SpaceClient />
    </SpaceThemeProvider>
  );
}
