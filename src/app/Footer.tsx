import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/account">My data</Link>
      <p>Kandid is a product of MAG Infosystems. It is not a government service.</p>
    </footer>
  );
}
