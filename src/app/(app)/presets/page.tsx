import { getProfiles, getSplitPresets } from "@/lib/data";
import { PresetsClient } from "./PresetsClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const [profiles, presets] = await Promise.all([getProfiles(), getSplitPresets()]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Split presets" subtitle="Save common split rules to pick from when adding an expense." />
      <PresetsClient profiles={profiles} presets={presets} />
    </div>
  );
}
