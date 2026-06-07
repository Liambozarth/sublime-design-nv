import PhotoMap from "@/components/admin/PhotoMap";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Photo Map" };

export default async function AdminMapPage() {
  await requireAdmin("/admin/map");

  return (
    <main className="bg-cream px-4 pb-16 pt-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mt-8 text-4xl text-charcoal">Photo Map</h1>
        <p className="mt-3 max-w-3xl font-ui text-sm text-gray-mid">
          Photos plotted by GPS location. Red pins have photos awaiting review; navy pins are all
          reviewed. GPS data is admin-only.
        </p>
        <PhotoMap />
      </div>
    </main>
  );
}
