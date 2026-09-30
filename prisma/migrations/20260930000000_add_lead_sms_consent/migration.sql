-- Optional SMS opt-in collected on the public quote form.
ALTER TABLE "Lead" ADD COLUMN "smsConsent" BOOLEAN NOT NULL DEFAULT false;
