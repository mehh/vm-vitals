import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Not here</h1>
      <p className="mt-2 text-secondary">That machine or page doesn&apos;t exist, or sharing was turned off.</p>
      <Link href="/" className="btn mt-6">
        Home
      </Link>
    </div>
  );
}
