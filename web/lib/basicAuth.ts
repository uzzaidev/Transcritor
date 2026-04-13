export type BasicAuthCredentials = {
  username: string;
  password: string;
};

export const decodeBasicAuthHeader = (
  authorizationHeader: string | null
): BasicAuthCredentials | null => {
  if (!authorizationHeader) return null;
  const [scheme, encoded] = authorizationHeader.split(" ");
  if (!scheme || !encoded || scheme.toLowerCase() !== "basic") return null;

  try {
    const decoded =
      typeof atob === "function"
        ? atob(encoded)
        : Buffer.from(encoded, "base64").toString("utf-8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
};

export const isBasicAuthAuthorized = (
  authorizationHeader: string | null,
  expectedUsername: string,
  expectedPassword: string
): boolean => {
  const creds = decodeBasicAuthHeader(authorizationHeader);
  if (!creds) return false;
  return creds.username === expectedUsername && creds.password === expectedPassword;
};
