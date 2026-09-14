import Link from "next/link";

/** 주소가 잘못됐거나 지워진 글을 열었을 때. */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-20 sm:px-8">
      <h1 className="text-2xl font-bold text-navy">찾는 화면이 없습니다</h1>

      <p className="mt-4 leading-relaxed text-ink-soft">
        주소가 바뀌었거나 지워진 글일 수 있습니다.
      </p>

      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        처음 화면으로
      </Link>
    </main>
  );
}
