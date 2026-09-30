import type { Metadata } from "next";
import Link from "next/link";
import LegalDocument, { LegalSection } from "@/components/layout/LegalDocument";
import { LEGAL, SITE } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || SITE.url;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Sublime Design NV LLC collects, uses, and protects information submitted through the quote form, including mobile numbers and SMS consent.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Privacy"
      title="Privacy Policy"
      intro={`Effective ${LEGAL.effectiveDate}. This policy describes how ${LEGAL.entityName} handles information collected on ${SITE.url.replace("https://", "")}.`}
    >
      <LegalSection title="Who we are">
        <p>
          {LEGAL.entityName} (“Sublime Design NV,” “we,” “us”) is a custom finish carpentry business
          serving the Las Vegas valley. We build floating shelves, built-ins, pantry pullouts,
          closets, cabinetry, mantels, and related finish work.
        </p>
      </LegalSection>

      <LegalSection title="Information collected through the quote form">
        <p>When you request a quote at {SITE.url.replace("https://", "")}/quote, we collect:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>First and last name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>The service you are asking about</li>
          <li>Neighborhood or city</li>
          <li>Timeline and budget range, if you choose to share them</li>
          <li>Your project description</li>
          <li>Photos you choose to upload</li>
          <li>Whether you checked the optional box to receive text messages</li>
        </ul>
        <p>
          We also store basic context about the request, such as the page you started from, so we
          can understand which project or service you were looking at. That context is used to
          reply to you. It is not sold.
        </p>
      </LegalSection>

      <LegalSection title="How we use that information">
        <p>We use quote-form information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Review your request and reply by email or phone</li>
          <li>Prepare a quote, schedule a visit, and coordinate the project</li>
          <li>Send appointment reminders and project updates you asked for</li>
          <li>
            Send text messages only if you opt in on the quote form, and only about your quote,
            scheduling, appointments, and project
          </li>
          <li>Keep a record of the request so we can follow up and complete the work</li>
        </ul>
        <p>
          Checking the text-message box is optional. You can submit a quote request without it. We
          do not use your mobile number for marketing texts unless you opt in.
        </p>
      </LegalSection>

      <LegalSection title="Text messaging">
        <p>
          Our texting program is called {LEGAL.programName}. Messages come from our business line,{" "}
          <a href={LEGAL.smsPhoneHref} className="font-semibold text-red hover:underline">
            {LEGAL.smsPhoneDisplay}
          </a>
          . Message frequency varies. Message and data rates may apply. Reply STOP to opt out and
          HELP for help.
        </p>
        <p>{LEGAL.smsNoShareStatement}</p>
        <p>
          Opting out of texts does not cancel a quote request or a project. You can still reach us
          by email or by calling the number listed on the site. More detail is in our{" "}
          <Link href="/terms" className="font-semibold text-red hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Who we share information with">
        <p>
          We share quote details with service providers that host the website, store photos you
          upload, and deliver email, and only so they can perform those services for us. Those
          providers may not use your information for their own marketing.
        </p>
        <p>
          We may also disclose information if the law requires it, or to protect our customers,
          our business, or the public. We do not sell personal information.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep quote and project records for as long as we need them to respond to you, complete
          the work, and meet ordinary business and tax record needs. You can ask us to delete a
          quote request that has not turned into an active project by emailing us.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can skip the text-message checkbox, reply STOP to any text we send, and email us to
          update or delete the contact details on a quote request. Phone calls and emails about a
          quote you submitted are part of answering that request.
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
          <p>
            Text:{" "}
            <a href={LEGAL.smsPhoneHref} className="font-semibold text-red hover:underline">
              {LEGAL.smsPhoneDisplay}
            </a>
          </p>
        </address>
      </LegalSection>
    </LegalDocument>
  );
}
