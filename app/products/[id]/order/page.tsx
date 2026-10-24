import { redirect } from "next/navigation";

export default function OrderPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/products/${params.id}`);
}
