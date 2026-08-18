import { Badge } from "@/components/ui/badge";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  queued: "bg-blue-100 text-blue-800",
  running: "bg-green-100 text-green-800",
  idle: "bg-gray-100 text-gray-700",
  completed: "bg-emerald-100 text-emerald-800",
  ended: "bg-gray-100 text-gray-600",
  errored: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  timed_out: "bg-orange-100 text-orange-800",
  retrying: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-200 text-gray-600",
};

export default function StatusBadge({ status }) {
  const cls = statusColors[status] || "bg-gray-100 text-gray-700";
  return <Badge className={`${cls} border-0 font-medium`}>{status.replace("_", " ")}</Badge>;
}