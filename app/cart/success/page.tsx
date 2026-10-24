import { redirect } from "next/navigation";

export default function CartSuccessPage() {
  redirect("/#categories");
}
