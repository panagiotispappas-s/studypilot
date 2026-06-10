"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { LogOut, Save, ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  getCurrentProfile,
  loginStudyAccount,
  logoutStudyAccount,
  registerStudyAccount,
  updateStudyProfile,
} from "@/lib/auth/studyAuth";
import type { EducationType, StudyProfile } from "@/types/study";

const educationTypes: EducationType[] = ["Schüler", "Student", "Azubi", "Weiterbildung"];

export function AccountView() {
  const [profile, setProfile] = useState<StudyProfile | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [message, setMessage] = useState("");

  async function refreshProfile() {
    setProfile(await getCurrentProfile());
  }

  useEffect(() => {
    queueMicrotask(() => void refreshProfile());
  }, []);

  return (
    <div>
      <PageHeader
        title="Konto"
        subtitle="Eigenständiges StudyPilot-Konto für Profil und spätere Synchronisation."
        actions={<Link className="text-sm font-medium text-[#2f6f73]" href="/settings">Speicher und Export</Link>}
      />
      <div className="px-5 py-6 lg:px-8">
        {profile ? (
          <ProfilePanel
            profile={profile}
            onSaved={async () => {
              setMessage("Profil gespeichert.");
              await refreshProfile();
            }}
            onLogout={async () => {
              await logoutStudyAccount();
              setMessage("");
              await refreshProfile();
            }}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,560px)_minmax(280px,1fr)]">
            <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
              <div className="mb-5 flex gap-2">
                <Button variant={mode === "register" ? "primary" : "secondary"} onClick={() => setMode("register")}>
                  Registrieren
                </Button>
                <Button variant={mode === "login" ? "primary" : "secondary"} onClick={() => setMode("login")}>
                  Login
                </Button>
              </div>
              {mode === "register" ? (
                <RegisterForm
                  onDone={async (nextProfile) => {
                    setProfile(nextProfile);
                    setMessage("Konto erstellt.");
                  }}
                />
              ) : (
                <LoginForm
                  onDone={async (nextProfile) => {
                    setProfile(nextProfile);
                    setMessage("Angemeldet.");
                  }}
                />
              )}
            </section>
            <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
              <ShieldCheck className="text-[#2f6f73]" size={28} />
              <h2 className="mt-4 font-semibold">Getrennt und lokal</h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                Das Konto gehört ausschließlich zu StudyPilot. Es nutzt lokale IndexedDB-Speicherung und ist für eine spätere, getrennte Synchronisation vorbereitet.
              </p>
            </section>
          </div>
        )}
        {message ? <p className="mt-4 rounded-md border border-[#cfe1dc] bg-[#eef8f5] px-4 py-3 text-sm text-[#1f5f61]">{message}</p> : null}
      </div>
    </div>
  );
}

function RegisterForm({ onDone }: { onDone: (profile: StudyProfile) => Promise<void> }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [institution, setInstitution] = useState("");
  const [educationType, setEducationType] = useState<EducationType | "">("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const profile = await registerStudyAccount({
        firstName,
        lastName,
        displayName,
        email,
        password,
        confirmPassword,
        institution,
        educationType: educationType || undefined,
        acceptedTerms,
      });
      await onDone(profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Das Konto konnte nicht erstellt werden.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Vorname" value={firstName} onChange={setFirstName} required />
        <Input label="Nachname" value={lastName} onChange={setLastName} required />
      </div>
      <Input label="Anzeigename" value={displayName} onChange={setDisplayName} required />
      <Input label="E-Mail" type="email" value={email} onChange={setEmail} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Passwort" type="password" value={password} onChange={setPassword} required />
        <Input label="Passwort bestätigen" type="password" value={confirmPassword} onChange={setConfirmPassword} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Lernrolle" value={educationType} onChange={(value) => setEducationType(value as EducationType | "")} />
        <Input label="Schule, Uni oder Ausbildung" value={institution} onChange={setInstitution} />
      </div>
      <label className="flex gap-3 text-sm leading-6 text-[#475467]">
        <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4" />
        Ich bestätige Datenschutz und Nutzungsbedingungen für mein StudyPilot-Konto.
      </label>
      {error ? <p className="rounded-md bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{error}</p> : null}
      <Button type="submit">
        <UserPlus size={16} />
        Konto erstellen
      </Button>
    </form>
  );
}

function LoginForm({ onDone }: { onDone: (profile: StudyProfile) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onDone(await loginStudyAccount({ email, password }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anmeldung nicht möglich.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="E-Mail" type="email" value={email} onChange={setEmail} required />
      <Input label="Passwort" type="password" value={password} onChange={setPassword} required />
      <button
        type="button"
        className="text-sm font-medium text-[#2f6f73]"
        onClick={() => setInfo("Die Passwort-Wiederherstellung ist für die spätere Synchronisation vorbereitet. Für lokale Konten kann aktuell ein neues Konto erstellt werden.")}
      >
        Passwort vergessen
      </button>
      {info ? <p className="rounded-md bg-[#eef8f5] px-3 py-2 text-sm text-[#1f5f61]">{info}</p> : null}
      {error ? <p className="rounded-md bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{error}</p> : null}
      <Button type="submit">Einloggen</Button>
    </form>
  );
}

function ProfilePanel({
  profile,
  onSaved,
  onLogout,
}: {
  profile: StudyProfile;
  onSaved: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [institution, setInstitution] = useState(profile.institution ?? "");
  const [educationType, setEducationType] = useState<EducationType | "">(profile.educationType ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await updateStudyProfile(profile.id, {
      firstName,
      lastName,
      displayName,
      institution: institution || undefined,
      educationType: educationType || undefined,
    });
    await onSaved();
  }

  return (
    <section className="max-w-3xl rounded-lg border border-[#dfe6df] bg-white p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{profile.displayName}</h2>
        <p className="text-sm text-[#667085]">{profile.email}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Vorname" value={firstName} onChange={setFirstName} required />
          <Input label="Nachname" value={lastName} onChange={setLastName} required />
        </div>
        <Input label="Anzeigename" value={displayName} onChange={setDisplayName} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Lernrolle" value={educationType} onChange={(value) => setEducationType(value as EducationType | "")} />
          <Input label="Schule, Uni oder Ausbildung" value={institution} onChange={setInstitution} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">
            <Save size={16} />
            Profil speichern
          </Button>
          <Button type="button" variant="secondary" onClick={onLogout}>
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </form>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3 outline-none focus:border-[#2f6f73]"
      />
    </label>
  );
}

function Select({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3 outline-none focus:border-[#2f6f73]"
      >
        <option value="">Nicht ausgewählt</option>
        {educationTypes.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
    </label>
  );
}
