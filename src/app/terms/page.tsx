import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of use · Kandid" };

export default function Terms() {
  return (
    <article className="legal">
      <Link href="/" className="meta back">← Kandid</Link>
      <h1>Terms of use</h1>
      <p className="meta">Last updated {LEGAL.updated}</p>

      <p>By using Kandid you agree to these terms. Kandid is run by {LEGAL.operator}. It is <strong>not</strong> a government service and is not connected to any government department or political party.</p>

      <h2>Report honestly</h2>
      <ul>
        <li>Only report real civic problems you saw yourself, at the place shown.</li>
        <li>Use your own photos, taken on the spot.</li>
        <li>Stick to facts: what, where, when. <strong>Don&apos;t accuse named people</strong>, and don&apos;t post insults, hate or threats.</li>
        <li>Don&apos;t post personal information: faces, number plates, phone numbers, addresses of private homes.</li>
        <li>Don&apos;t post anything illegal, or spam, or fake reports.</li>
      </ul>

      <h2>Moderation</h2>
      <p>Anyone can flag a report. Reports flagged by several people are hidden until reviewed. We may remove reports or accounts that break these rules, and we remove content when required by law or by a court or government order.</p>

      <h2>Your content</h2>
      <p>You keep ownership of your photos and notes. By posting, you allow Kandid to show them publicly and to include them in shares and summaries about civic issues. You can delete your reports at any time.</p>

      <h2>No guarantee</h2>
      <p>Kandid helps make problems visible. It cannot guarantee that any authority will act, or that information posted by others is correct. Official complaints are filed by you, on the official channels.</p>

      <h2>Liability</h2>
      <p>Kandid is provided as is. To the extent the law allows, we&apos;re not liable for losses arising from using it or from content posted by users.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>Contact</h2>
      <p>See the grievance officer details in the <Link href="/privacy">privacy policy</Link>.</p>
    </article>
  );
}
