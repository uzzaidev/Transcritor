import { AtaPipelineDefaults, AtaProjectProfile } from "../types";

export const getCurrentSprintLabel = (): string => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `Sprint-${date.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
};

export const parseCommaSeparatedValues = (value: string): string[] =>
  value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export const normalizeProjectKey = (value: string): string => value.trim().toLowerCase();

export const findProjectProfile = (
  profiles: AtaProjectProfile[],
  projeto: string
): AtaProjectProfile | undefined =>
  profiles.find(
    (profile) => normalizeProjectKey(profile.projeto) === normalizeProjectKey(projeto)
  );

export const canAutoGenerateAta = (defaults: AtaPipelineDefaults): boolean => {
  const matchedProfile = findProjectProfile(defaults.projectProfiles, defaults.projeto);
  const sprint = matchedProfile?.sprint || defaults.sprint;
  const destinatarios = matchedProfile?.destinatarios || defaults.destinatarios;
  return Boolean(
    defaults.autoGenerateAta &&
      defaults.projeto.trim() &&
      sprint.trim() &&
      destinatarios.trim()
  );
};
