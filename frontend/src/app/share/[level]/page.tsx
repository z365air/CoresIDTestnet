import type { Metadata } from "next";
import { headers } from "next/headers";
import { RedirectNow } from "./redirect-now";

type Props = { params: Promise<{ level: string }> };

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") ?? "coresidtestnet.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { level } = await params;
  const n = Math.min(Math.max(Number(level), 0), 5);
  const base = await getBaseUrl();
  const img = `${base}/metadata/level${n}.png`;
  return {
    title: "Base Cores ID Level Up!",
    description: `I have connected ${n} Seeds to my Core on Base Cores ID`,
    openGraph: {
      title: "Base Cores ID Level Up!",
      description: `I have connected ${n} Seeds to my Core on Base Cores ID`,
      images: [{ url: img, width: 1200, height: 1200 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Base Cores ID Level Up!",
      description: `I have connected ${n} Seeds to my Core on Base Cores ID`,
      images: [img],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { level } = await params;
  const n = Math.min(Math.max(Number(level), 0), 5);
  const base = await getBaseUrl();
  const img = `${base}/metadata/level${n}.png`;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", background: "#0c1330",
      color: "white", fontFamily: "system-ui", gap: 16, padding: 24,
    }}>
      <RedirectNow to={base + "/"} />
      <img src={img} alt={`Level ${n}`} style={{ maxWidth: 400, borderRadius: 16 }} />
    </div>
  );
}
