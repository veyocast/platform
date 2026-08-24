export const onboardingTermsVersion = "launch-terms-2026-08-24-v1";
export const onboardingSetupCookieName = "veyocast-setup-intent";

export const onboardingOrganizationTypes = [
  "sportclub",
  "hospitality",
  "organization"
] as const;
export const onboardingUseCases = [
  "club_communication",
  "venue_information",
  "internal_communication"
] as const;
export const onboardingSourceKeys = [
  "sportlink",
  "twelve",
  "rss",
  "own-media",
  "sponsors"
] as const;

export type OnboardingOrganizationType =
  (typeof onboardingOrganizationTypes)[number];
export type OnboardingUseCase = (typeof onboardingUseCases)[number];
export type OnboardingSourceKey = (typeof onboardingSourceKeys)[number];

const slugCharacters = /[^a-z0-9]+/g;

export function normalizeOnboardingSlug(name: string, idempotencyKey: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(slugCharacters, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  const suffix = idempotencyKey.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `${base || "organisatie"}-${suffix}`;
}

export function isOnboardingOrganizationType(
  value: string
): value is OnboardingOrganizationType {
  return onboardingOrganizationTypes.includes(
    value as OnboardingOrganizationType
  );
}

export function isOnboardingUseCase(value: string): value is OnboardingUseCase {
  return onboardingUseCases.includes(value as OnboardingUseCase);
}

export function parseOnboardingSourceKeys(values: FormDataEntryValue[]) {
  return [
    ...new Set(
      values.filter(
        (value): value is OnboardingSourceKey =>
          typeof value === "string" &&
          onboardingSourceKeys.includes(value as OnboardingSourceKey)
      )
    )
  ].sort();
}

export function validateRegistrationInput(input: Readonly<{
  accepted: boolean;
  displayName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}>) {
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  if (displayName.length < 2 || displayName.length > 120) return null;
  if (email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  if (input.password.length < 12 || input.password.length > 128) return null;
  if (input.password !== input.passwordConfirmation || !input.accepted) return null;
  return { displayName, email, password: input.password };
}
