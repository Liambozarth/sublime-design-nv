import Link from "next/link";
import { Clock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import { LEGAL, SITE } from "@/lib/constants";
import { ACTIVE_SERVICES } from "@/content/services";
import { getBusinessSettings } from "@/lib/settings";
import FooterLogo from "@/components/layout/FooterLogo";

export default async function Footer() {
  const year = new Date().getFullYear();
  const biz = await getBusinessSettings();

  const phone = biz.phone || SITE.phone;
  const email = biz.email || SITE.email;
  const address = biz.address
    ? [biz.address, biz.city, biz.state].filter(Boolean).join(", ")
    : SITE.address;
  const phoneHref = `tel:${phone.replace(/\D/g, "")}`;
  const emailHref = `mailto:${email}`;
  const hoursWeekdays = biz.hoursMonFri ?? SITE.hours.weekdays;
  const hoursWeekend = biz.hoursSat ?? SITE.hours.weekend;

  return (
    <footer className="mt-20 bg-charcoal text-white">
      <div className="bg-red">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-ui text-xl font-semibold md:text-2xl">
            Ready to transform your space?
          </p>
          <Link
            href="/quote"
            className="font-ui inline-flex w-fit rounded-sm bg-white px-4 py-2 text-sm font-semibold text-red transition-opacity hover:opacity-90"
          >
            GET A FREE QUOTE
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 md:grid-cols-3 md:px-8">
        <div className="space-y-4">
          <Link href="/" aria-label={SITE.name} className="inline-block">
            <FooterLogo />
          </Link>
          <p className="font-ui text-sm text-white/80">{biz.tagline ?? SITE.tagline}</p>
          <p className="font-ui text-sm text-white/80">{biz.city ?? "Las Vegas"}, NV</p>
        </div>

        <div>
          <h3 className="font-ui text-base font-semibold text-white">Services</h3>
          <ul className="mt-4 space-y-2">
            {ACTIVE_SERVICES.map((service) => (
              <li key={service.slug}>
                <Link
                  href={`/services/${service.slug}`}
                  className="font-ui text-sm text-white/80 transition-colors hover:text-white"
                >
                  {service.shortTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-ui text-base font-semibold text-white">Contact</h3>
          <div className="mt-4 space-y-3">
            {biz.showPhone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                <a
                  href={phoneHref}
                  className="font-ui text-sm text-white/80 transition-colors hover:text-white"
                >
                  {phone}
                </a>
              </div>
            )}
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
              <a
                href={LEGAL.smsPhoneHref}
                className="font-ui text-sm text-white/80 transition-colors hover:text-white"
              >
                Text us {LEGAL.smsPhoneDisplay}
              </a>
            </div>
            {biz.showEmail && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                <a
                  href={emailHref}
                  className="font-ui text-sm text-white/80 transition-colors hover:text-white"
                >
                  {email}
                </a>
              </div>
            )}
            {biz.showAddress && address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                <a
                  href={SITE.addressHref}
                  className="font-ui text-sm text-white/80 transition-colors hover:text-white"
                >
                  {address}
                </a>
              </div>
            )}
            {biz.showHours && (
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                <div className="font-ui text-sm text-white/80">
                  <p>{hoursWeekdays}</p>
                  {hoursWeekend && <p>{hoursWeekend}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 md:flex-row md:justify-between md:px-8">
          <p className="font-ui text-center text-sm text-white/70 md:text-left">
            &copy; {year} {SITE.name}. All Rights Reserved.
          </p>
          <nav aria-label="Legal" className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="font-ui text-sm text-white/70 transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-ui text-sm text-white/70 transition-colors hover:text-white"
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
