import { NextRequest, NextResponse } from "next/server";
import { isBasicAuthAuthorized } from "./lib/basicAuth";

function unauthorizedResponse(message: string) {
  return new NextResponse(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Transcritor Dashboard", charset="UTF-8"',
    },
  });
}

export function middleware(request: NextRequest) {
  const expectedUser = process.env.DASHBOARD_BASIC_AUTH_USER?.trim() || "";
  const expectedPass = process.env.DASHBOARD_BASIC_AUTH_PASSWORD?.trim() || "";

  if (!expectedUser || !expectedPass) {
    return unauthorizedResponse(
      "Dashboard bloqueado por padrao. Configure DASHBOARD_BASIC_AUTH_USER e DASHBOARD_BASIC_AUTH_PASSWORD."
    );
  }

  const auth = request.headers.get("authorization");
  if (!isBasicAuthAuthorized(auth, expectedUser, expectedPass)) {
    return unauthorizedResponse("Credenciais invalidas.");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
