import { NextResponse } from "next/server";

import { createSession, resolveRole } from "@/lib/auth";

export async function POST(request: Request) {
  let password = "";

  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json(
      { ok: false, message: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!password) {
    return NextResponse.json(
      { ok: false, message: "비밀번호를 입력해 주세요." },
      { status: 422 },
    );
  }

  const result = resolveRole(password);

  if (!result.ok) {
    // 어떤 비밀번호가 틀렸는지 구분해 알려주지 않는다.
    return NextResponse.json({ ok: false, message: result.reason }, { status: 401 });
  }

  await createSession(result.role);

  return NextResponse.json({
    ok: true,
    role: result.role,
    redirectTo: result.role === "admin" ? "/admin" : "/cards",
  });
}
