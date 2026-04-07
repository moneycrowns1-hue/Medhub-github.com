import { getPlanForDate } from "@/lib/schedule";
import { DayClient } from "./day-client";

export default function DayPage() {
  const plan = getPlanForDate(new Date());
  return <DayClient plan={plan} />;
}
