import { withObjectParticle } from "@/lib/korean";

/**
 * 자료를 못 읽었을 때 그 자리에 대신 놓는 안내.
 *
 * 오류 내용을 그대로 보여 주지 않는다. 보는 사람이 할 수 있는 일은
 * 새로고침뿐이고, 내부 오류 문구는 도움이 되지 않는다.
 */
export function LoadFailureNotice({ what }: { what: string }) {
  return (
    <p
      role="status"
      className="rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning"
    >
      {withObjectParticle(what)} 지금 불러오지 못했습니다. 잠시 후 새로고침해 주세요. 계속
      같으면 운영자에게 알려 주세요.
    </p>
  );
}
