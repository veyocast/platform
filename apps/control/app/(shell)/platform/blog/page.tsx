import {hasCapability} from "@veyocast/auth";
import type {Metadata} from "next";

import {getBlogEntries, getBlogPublicOrigin} from "../../../../lib/blog-service";
import {requireControlCapability} from "../../../../lib/control-session";
import {BlogAdmin} from "./_components/blog-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {title: "Blogbeheer · VeyoCast", robots: {index: false, follow: false}};

export default async function PlatformBlogPage() {
  const session = await requireControlCapability("platform.blog.read");
  const origin = getBlogPublicOrigin();
  if (!session.isLive) return <section><h1>Blogbeheer</h1><p>Log in met een geverifieerd redactieaccount om artikelen te lezen en te beheren. De demonstratieomgeving bevat geen redactiegegevens.</p></section>;
  if (!origin) return <section><h1>Blogbeheer niet beschikbaar</h1><p>De openbare blogbestemming voor deze omgeving ontbreekt. Laat de platformbeheerder een afzonderlijke marketingtesthost instellen voordat je artikelen beheert.</p></section>;
  const entries = await getBlogEntries();
  return <BlogAdmin initialEntries={entries} canonicalOrigin={origin}
    canWrite={hasCapability(session.capabilities, "platform.blog.write")}
    canPublish={hasCapability(session.capabilities, "platform.blog.publish")} />;
}
