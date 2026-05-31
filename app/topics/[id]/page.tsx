import { TopicDetailPage } from "@/components/TopicDetailPage";

export default async function TopicDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TopicDetailPage topicId={id} />;
}
