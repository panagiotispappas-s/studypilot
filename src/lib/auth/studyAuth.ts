import { db } from "@/lib/db/indexeddb";
import { createId } from "@/lib/editor/elementUtils";
import { nowIso } from "@/lib/utils/date";
import type { EducationType, StudyAccount, StudyAuthSession, StudyProfile } from "@/types/study";

export interface RegisterInput {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  educationType?: EducationType;
  institution?: string;
  acceptedTerms: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function getCurrentProfile(): Promise<StudyProfile | null> {
  const session = await db.authSessions.orderBy("createdAt").last();
  if (!session) return null;
  return (await db.profiles.get(session.profileId)) ?? null;
}

export async function registerStudyAccount(input: RegisterInput): Promise<StudyProfile> {
  const email = input.email.trim().toLowerCase();
  if (!input.firstName.trim() || !input.lastName.trim() || !input.displayName.trim()) {
    throw new Error("Bitte fülle Name und Anzeigename aus.");
  }
  if (!email.includes("@")) throw new Error("Bitte gib eine gültige E-Mail-Adresse ein.");
  if (input.password.length < 8) throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
  if (input.password !== input.confirmPassword) throw new Error("Die Passwörter stimmen nicht überein.");
  if (!input.acceptedTerms) throw new Error("Bitte bestätige Datenschutz und Nutzungsbedingungen.");

  const existing = await db.accounts.where("email").equals(email).first();
  if (existing) throw new Error("Für diese E-Mail-Adresse existiert bereits ein StudyPilot-Konto.");

  const timestamp = nowIso();
  const userId = createId("user");
  const profile: StudyProfile = {
    id: createId("profile"),
    userId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    displayName: input.displayName.trim(),
    email,
    educationType: input.educationType,
    institution: input.institution?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const salt = crypto.randomUUID();
  const account: StudyAccount = {
    id: userId,
    email,
    passwordSalt: salt,
    passwordHash: await hashPassword(input.password, salt),
    profileId: profile.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const session: StudyAuthSession = {
    id: "current",
    userId,
    profileId: profile.id,
    createdAt: timestamp,
  };

  await db.transaction("rw", [db.profiles, db.accounts, db.authSessions], async () => {
    await db.profiles.add(profile);
    await db.accounts.add(account);
    await db.authSessions.clear();
    await db.authSessions.put(session);
  });
  return profile;
}

export async function loginStudyAccount(input: LoginInput): Promise<StudyProfile> {
  const email = input.email.trim().toLowerCase();
  const account = await db.accounts.where("email").equals(email).first();
  if (!account) throw new Error("E-Mail oder Passwort ist nicht korrekt.");
  const hash = await hashPassword(input.password, account.passwordSalt);
  if (hash !== account.passwordHash) throw new Error("E-Mail oder Passwort ist nicht korrekt.");
  const profile = await db.profiles.get(account.profileId);
  if (!profile) throw new Error("Das Profil konnte nicht geladen werden.");
  await db.authSessions.clear();
  await db.authSessions.put({
    id: "current",
    userId: account.id,
    profileId: profile.id,
    createdAt: nowIso(),
  });
  return profile;
}

export async function updateStudyProfile(id: string, patch: Partial<StudyProfile>): Promise<void> {
  await db.profiles.update(id, { ...patch, updatedAt: nowIso() });
}

export async function logoutStudyAccount(): Promise<void> {
  await db.authSessions.clear();
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
