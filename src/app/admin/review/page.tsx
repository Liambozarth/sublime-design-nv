import ReviewQueue from "@/components/admin/ReviewQueue";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Review Queue" };

export default async function AdminReviewPage() {
  await requireAdmin("/admin/review");

  return (
    <main className="bg-cream px-4 pb-16 pt-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mt-8 text-4xl text-charcoal">Review Queue</h1>
        <p className="mt-3 max-w-3xl font-ui text-sm text-gray-mid">
          Approve, edit, or reject AI-tagged photos. Approving applies the suggestions and
          publishes the photo to the site.
        </p>
        <ReviewQueue />
      </div>
    </main>
  );
}
