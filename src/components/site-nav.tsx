"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { Role } from "@/lib/auth";

export type NavTab =
  | "home"
  | "apply"
  | "plan"
  | "worries"
  | "feedback"
  | "teams"
  | "cards"
  | "activities"
  | "polls"
  | "admin"
  | "diagnostics";

type NavItem = {
  tab: NavTab;
  label: string;
  href: string;
  /** 로그인해야 볼 수 있는 화면인지 */
  locked?: boolean;
  /** 한 줄 설명. 묶음 안에서 무엇을 고를지 알려 준다. */
  hint?: string;
};

type NavGroup = { label: string; items: NavItem[] };

/**
 * 메뉴 구성.
 *
 * 기능이 늘 때마다 탭을 하나씩 붙이면 휴대폰에서 두 줄, 세 줄로 접힌다.
 * 하는 일이 비슷한 것끼리 묶어 최상위는 넷으로 고정한다. 새 기능은
 * 탭을 만들지 말고 알맞은 묶음 안에 넣는다.
 */
const GROUPS: NavGroup[] = [
  {
    label: "모임",
    items: [
      { tab: "plan", label: "활동 계획", href: "/plan", hint: "회기별 일정과 예산" },
      {
        tab: "activities",
        label: "활동 기록",
        href: "/activities",
        locked: true,
        hint: "활동일지와 결과보고서",
      },
      { tab: "polls", label: "투표", href: "/polls", hint: "일정·참석 정하기" },
    ],
  },
  {
    label: "모임 도구",
    items: [
      { tab: "teams", label: "조 편성", href: "/teams", hint: "무작위로 조 나누기" },
      { tab: "worries", label: "고민 나눔", href: "/worries", hint: "익명으로 묻고 답하기" },
      { tab: "feedback", label: "만족도", href: "/feedback", hint: "회차별 짧은 설문" },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "운영",
  items: [
    { tab: "admin", label: "신청자 명단", href: "/admin", hint: "연락처가 담긴 화면" },
    {
      tab: "diagnostics",
      label: "연결 점검",
      href: "/admin/diagnostics",
      hint: "시트·설정 상태 확인",
    },
  ],
};

/**
 * 사이트 전체 공통 이동 막대.
 *
 * 로그인 여부와 무관하게 모든 화면에 같은 자리에 나온다.
 * role 이 null 이면 로그인하지 않은 상태다. 이때도 명함집·활동기록 링크는
 * 보여 준다. 눌러도 개인정보가 노출되지 않고 /login 으로 안내되며,
 * "무엇이 있는지"는 알려 주는 편이 안내에 유리하다.
 */
export function SiteNav({ role, current }: { role: Role | null; current?: NavTab }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  const groups = role === "admin" ? [...GROUPS, ADMIN_GROUP] : GROUPS;

  return (
    <nav aria-label="동문회 메뉴" className="border-b border-line bg-surface">
      <div className="relative mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-5 py-3 sm:gap-2 sm:px-8">
        <Link href="/" className={tabClass(current === "home")}>
          동문회 안내
        </Link>

        {/* 가장 자주 여는 화면이라 묶음에 넣지 않고 그대로 둔다. */}
        <Link href="/cards" className={tabClass(current === "cards")}>
          명함집
          {role ? null : <LockMark />}
        </Link>

        {groups.map((group) => (
          <NavMenu key={group.label} group={group} current={current} role={role} />
        ))}

        <span className="ml-auto flex items-center gap-2 sm:gap-3">
          {role ? (
            <>
              <span className="text-xs font-medium text-ink-muted">
                {role === "admin" ? "운영자" : "참여자"}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50 disabled:opacity-60"
              >
                {signingOut ? "로그아웃 중..." : "로그아웃"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-blue/50 hover:text-brand-blue"
            >
              로그인
            </Link>
          )}
        </span>
      </div>
    </nav>
  );
}

/**
 * 묶음 메뉴 하나.
 *
 * 마우스를 올려 여는 방식은 쓰지 않는다. 휴대폰에는 hover 가 없고,
 * 스치기만 해도 열리면 다른 것을 가린다. 눌러서 열고 Esc·바깥 누르기로 닫는다.
 */
function NavMenu({
  group,
  current,
  role,
}: {
  group: NavGroup;
  current?: NavTab;
  role: Role | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const active = group.items.some((item) => item.tab === current);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="sm:relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        className={tabClass(active)}
      >
        {group.label}
        <span aria-hidden="true" className="text-[10px] leading-none">
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          /*
           * 좁은 화면에서는 메뉴 막대 전체 폭으로 펼친다. 버튼 바로 아래에
           * 붙이면 오른쪽 끝 버튼의 패널이 화면 밖으로 나가 가로 스크롤이 생긴다.
           */
          className="absolute left-5 right-5 top-full z-40 mt-1 overflow-hidden rounded-[14px] border border-line bg-surface shadow-lg sm:left-0 sm:right-auto sm:w-60"
        >
          <ul>
            {group.items.map((item) => (
              <li key={item.tab}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={item.tab === current ? "page" : undefined}
                  className={`block px-4 py-3 transition-colors ${
                    item.tab === current ? "bg-brand-blue/10" : "hover:bg-canvas"
                  }`}
                >
                  <span
                    className={`flex items-center gap-1.5 text-sm font-semibold ${
                      item.tab === current ? "text-brand-blue" : "text-ink"
                    }`}
                  >
                    {item.label}
                    {item.locked && !role ? <LockMark /> : null}
                  </span>
                  {item.hint ? (
                    <span className="mt-0.5 block text-xs text-ink-muted">{item.hint}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function tabClass(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    active ? "bg-brand-blue/10 text-brand-blue" : "text-ink-soft hover:bg-canvas"
  }`;
}

/** 로그인이 필요한 메뉴임을 색상 외의 방법으로도 알린다. (PRD 13.1) */
function LockMark() {
  return (
    <>
      <span aria-hidden="true" className="text-xs text-ink-muted">
        🔒
      </span>
      <span className="sr-only">로그인 필요</span>
    </>
  );
}
