import { getPost } from "@/lib/blog";
import { brandImage, OG_SIZE } from "@/lib/og-image";

export { generateStaticParams } from "./page";

export const alt = "Roses Gallery – Blog";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = getPost((await params).slug);
  return brandImage({
    title: post?.title ?? "Blog",
    subtitle: post?.description,
  });
}
