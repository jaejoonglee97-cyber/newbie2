import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";
import { saveReport, validateReport } from "@/lib/report-logs";

export async function POST(request: Request) {
  const role = await getSessionRole();
  if (!role) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const result = await validateReport(body);

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        errors: result.errors,
      });
    }

    const saveResult = await saveReport(result.value);

    return NextResponse.json({
      ok: true,
      reportId: saveResult.reportId,
    });
  } catch (error) {
    console.error("Failed to save report:", error);
    return NextResponse.json(
      { ok: false, message: "저장 중 서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
