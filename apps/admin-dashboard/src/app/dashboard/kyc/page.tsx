"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

interface KycReview {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  requestedTier: number;
  idNumber?: string;
  idPhotoUrl?: string;
  selfieUrl?: string;
  submittedAt: string;
  status: string;
}

export default function KycPage() {
  const [reviews, setReviews] = useState<KycReview[]>([]);

  useEffect(() => {
    api.get<KycReview[]>("/admin/kyc-reviews?status=PENDING").then(setReviews);
  }, []);

  const approve = async (id: string) => {
    await api.patch(`/admin/kyc-reviews/${id}`, { status: "APPROVED" });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const reject = async (id: string) => {
    await api.patch(`/admin/kyc-reviews/${id}`, { status: "REJECTED" });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div>
      <h2 className="font-heading text-ink text-xl mb-6">KYC Reviews</h2>

      {reviews.length === 0 ? (
        <div className="bg-surface rounded-xl p-12 text-center">
          <p className="text-green font-heading text-lg mb-1">All clear</p>
          <p className="text-ink-muted text-sm">No pending KYC reviews.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="bg-surface rounded-xl p-5 flex items-start gap-6"
            >
              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-ink font-heading text-base">
                    {r.customerName}
                  </p>
                  <StatusBadge status={`TIER ${r.requestedTier}`} />
                </div>
                <p className="text-ink-muted text-sm mb-1">
                  Phone: {r.phone}
                </p>
                {r.idNumber && (
                  <p className="text-ink-muted text-sm mb-1">
                    ID: {r.idNumber}
                  </p>
                )}
                <p className="text-ink-muted text-xs">
                  Submitted:{" "}
                  {new Date(r.submittedAt).toLocaleString("en-ZA")}
                </p>
              </div>

              {/* Documents */}
              {r.requestedTier === 2 && (
                <div className="flex gap-3">
                  {r.idPhotoUrl && (
                    <a
                      href={r.idPhotoUrl}
                      target="_blank"
                      rel="noopener"
                      className="block w-20 h-20 bg-surface-2 rounded-lg overflow-hidden"
                    >
                      <img
                        src={r.idPhotoUrl}
                        alt="ID"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  )}
                  {r.selfieUrl && (
                    <a
                      href={r.selfieUrl}
                      target="_blank"
                      rel="noopener"
                      className="block w-20 h-20 bg-surface-2 rounded-lg overflow-hidden"
                    >
                      <img
                        src={r.selfieUrl}
                        alt="Selfie"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => approve(r.id)}
                  className="bg-green/10 text-green text-sm px-4 py-2 rounded-lg hover:bg-green/20 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => reject(r.id)}
                  className="bg-red/10 text-red text-sm px-4 py-2 rounded-lg hover:bg-red/20 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
