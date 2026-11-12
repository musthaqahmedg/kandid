import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy · Kandid" };

export default function Privacy() {
  return (
    <article className="legal">
      <Link href="/" className="meta back">← Kandid</Link>
      <h1>Privacy policy</h1>
      <p className="meta">Last updated {LEGAL.updated}</p>

      <p>Kandid lets people report civic problems with a photo and location. This page explains, in plain words, what we collect, why, who can see it, and how to delete it.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your email address</strong>, to log you in with a one-time code.</li>
        <li><strong>Your reports</strong>: the photo, the location and time it was taken, the category and any note you write.</li>
        <li><strong>Your actions</strong>: &quot;I saw this too&quot;, &quot;It&apos;s fixed&quot; / &quot;Still broken&quot; (with your location at that moment and any after photo), ratings, official filings you record, and flags.</li>
        <li><strong>Your location</strong> is read only when you take a report photo or confirm a fix. We do not track you in the background.</li>
      </ul>

      <h2>What is public</h2>
      <p>Reports are public: anyone can see the photo, location, time, category, note, status and counts. <strong>Your name and email are never shown.</strong> Flags are private.</p>
      <p>Please don&apos;t photograph people&apos;s faces, number plates or the inside of homes, and don&apos;t write personal details in notes.</p>
      <p><strong>Automatic blurring:</strong> before a photo is uploaded, Kandid looks for faces <em>on your phone</em> and pixelates them, and you can tap to blur anything else (like a number plate). Only the blurred photo is uploaded; the original never leaves your phone. To do this, your browser downloads small AI models from Google and jsDelivr.</p>

      <h2>Why we use it</h2>
      <p>Only to run Kandid: show issues, count confirmations, close fixed issues, prevent abuse, and keep the service secure. We don&apos;t sell your data or use it for advertising.</p>

      <p className="meta">Constituency boundaries: DataMeet India community, CC BY 2.5 India (approximate).</p>

      <h2>Where it is stored</h2>
      <ul>
        <li>Accounts, reports and photos: Appwrite Cloud (Singapore region).</li>
        <li>Website hosting: Vercel.</li>
        <li>Maps: OpenStreetMap. Your browser loads map images from OpenStreetMap&apos;s servers, and sends the report&apos;s location to OpenStreetMap&apos;s Nominatim service to look up the place name.</li>
      </ul>
      <p>Your browser also keeps your login session and your list/map choice on your device.</p>

      <h2>How long we keep it</h2>
      <p>Until you delete it. You can delete any of your reports at any time, or delete your whole account and everything linked to it.</p>

      <h2>Your rights</h2>
      <p>You can ask what data we hold about you, correct it, or delete it. Go to <Link href="/account">My data</Link> to delete your account and all your reports, photos and votes.</p>

      <h2>Children</h2>
      <p>Kandid is meant for people aged 18 and over.</p>

      <h2>Grievance officer</h2>
      <p>
        {LEGAL.grievanceOfficer}
        {LEGAL.grievanceEmail ? <> · <a href={`mailto:${LEGAL.grievanceEmail}`}>{LEGAL.grievanceEmail}</a></> : <> · contact email coming soon</>}
        <br />We acknowledge complaints within 24 hours and aim to resolve them within 15 days.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy, we&apos;ll update the date at the top.</p>
    </article>
  );
}
