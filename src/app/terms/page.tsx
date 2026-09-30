import type { Metadata } from "next";
import Link from "next/link";
import LegalDocument, { LegalSection } from "@/components/layout/LegalDocument";
import { LEGAL, SITE } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || SITE.url;

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for using the Sublime Design NV website and the Sublime Design NV text messaging program.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terms"
      title="Terms of Service"
      intro={`Effective ${LEGAL.effectiveDate}. These terms cover use of the Sublime Design NV website and our text messaging program.`}
    >
      <LegalSection title="Using this site">
        <p>
          {LEGAL.entityName} publishes this website so homeowners and businesses in the Las Vegas
          valley can learn about our finish carpentry work and request a quote. You may use the
          site for that purpose. Do not misuse the forms, attempt to disrupt the site, or submit
          someone else’s contact information without their permission.
        </p>
      </LegalSection>

      <LegalSection title="Quotes">
        <p>
          A quote request is not a contract. Pricing, timing, and scope are confirmed separately
          after we review the details, and sometimes after a site visit. Photos and measurements
          you send help us estimate the work. They do not obligate either of us to proceed.
        </p>
      </LegalSection>

      <LegalSection title="SMS Terms">
        <p>
          Program name: {LEGAL.programName}. These SMS terms apply when you opt in to texts from
          Sublime Design NV at {LEGAL.smsPhoneDisplay}.
        </p>
        <p>
          If you check the optional box on the quote form, you agree that we may text the mobile
          number you entered. Messages are about quotes, scheduling, appointment reminders, project
          updates, and replies to customer questions.
        </p>
        <p>Message frequency varies.</p>
        <p>Message and data rates may apply.</p>
        <p>Reply STOP to opt out, HELP for help.</p>
        <p>
          After you reply STOP, we will not send further texts unless you opt in again. Consent to
          texts is not a condition of requesting a quote or hiring us. Carriers are not liable for
          delayed or undelivered messages.
        </p>
        <p>
          For how we handle mobile numbers and text-message consent, see our{" "}
          <Link href="/privacy" className="font-semibold text-red hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Photos and site content">
        <p>
          Project photos, descriptions, and page content on this site belong to {LEGAL.entityName}
          or are used with permission. You may not copy them for your own commercial use without
          written permission. Photos you upload with a quote request are used to review and quote
          your project.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <address className="not-italic">
          <p className="font-semibold text-charcoal">{LEGAL.entityName}</p>
          <p>{LEGAL.street}</p>
          <p>{LEGAL.cityStateZip}</p>
          <p className="mt-2">
            <a href={LEGAL.emailHref} className="font-semibold text-red hover:underline">
              {LEGAL.email}
            </a>
          </p>
        </address>
      </LegalSection>
    </LegalDocument>
  );
}
