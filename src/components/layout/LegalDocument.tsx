import type { ReactNode } from "react";

export default function LegalDocument({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-cream pt-28 pb-20">
      <article className="mx-auto max-w-3xl px-4 md:px-8">
        <p className="font-ui text-sm uppercase tracking-[0.18em] text-red">{eyebrow}</p>
        <h1 className="mt-3 text-4xl text-charcoal md:text-5xl">{title}</h1>
        {intro ? <p className="mt-4 text-base leading-relaxed text-gray-mid">{intro}</p> : null}
        <div className="mt-10 space-y-8 text-base leading-relaxed text-charcoal">{children}</div>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-ui text-lg font-semibold text-charcoal">{title}</h2>
      <div className="space-y-3 text-[15px] leading-7 text-charcoal">{children}</div>
    </section>
  );
}
