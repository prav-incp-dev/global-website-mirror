-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'Unconfirmed';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "adminCancelNote" TEXT,
ADD COLUMN     "adminCanceledAt" TIMESTAMP(3),
ADD COLUMN     "adminCanceledBy" INTEGER,
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "userDecision" TEXT,
ADD COLUMN     "userDecisionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_adminCanceledBy_fkey" FOREIGN KEY ("adminCanceledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
