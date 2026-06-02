import { redirect } from "next/navigation";
import { DEMO_BOOKS } from "@/lib/demo/discover";

export const dynamic = "force-static";

export default function DemoIndex() {
  const flagship = DEMO_BOOKS[0];
  if (flagship === undefined) {
    throw new Error("no demo books configured (apps/site/src/lib/demo/discover.ts)");
  }
  redirect(`/demo/${flagship.slug}`);
}
