import ReviewForm from "@/components/reviews/review-form";

type Props = { params: Promise<{ token: string }> };

export default async function ReviewPage({ params }: Props) {
  const { token } = await params;
  return <ReviewForm token={token} />;
}
