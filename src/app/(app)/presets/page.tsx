import { getProfiles, getSplitPresets } from "@/lib/data";
import { PresetsClient } from "./PresetsClient";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const [profiles, presets] = await Promise.all([getProfiles(), getSplitPresets()]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Split presets</h1>
      <PresetsClient profiles={profiles} presets={presets} />
    </div>
  );
}
