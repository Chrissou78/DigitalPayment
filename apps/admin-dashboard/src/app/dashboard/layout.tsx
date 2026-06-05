"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!getAdminToken()) {
      router.push("/");
    }
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
