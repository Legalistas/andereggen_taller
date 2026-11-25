-- CreateEnum
CREATE TYPE "WhatsappDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "channel" VARCHAR(10) NOT NULL DEFAULT 'email',
ADD COLUMN     "whatsappMessageId" TEXT;

-- CreateTable
CREATE TABLE "WhatsappContact" (
    "id" TEXT NOT NULL,
    "waId" VARCHAR(32) NOT NULL,
    "name" VARCHAR(150),
    "profileName" VARCHAR(255),
    "lastInboundAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "optOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" TEXT NOT NULL,
    "messageSid" VARCHAR(64) NOT NULL,
    "contactId" TEXT NOT NULL,
    "direction" "WhatsappDirection" NOT NULL,
    "body" TEXT,
    "media" JSONB,
    "status" VARCHAR(20),
    "errorCode" VARCHAR(20),
    "template" VARCHAR(100),
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappList" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappListMember" (
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappListMember_pkey" PRIMARY KEY ("listId","contactId")
);

-- CreateTable
CREATE TABLE "WhatsappCampaign" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "listId" TEXT,
    "templateSid" VARCHAR(64) NOT NULL,
    "templateName" VARCHAR(100) NOT NULL,
    "variables" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'enviando',
    "createdById" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "detail" VARCHAR(255),
    "messageId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappContact_waId_key" ON "WhatsappContact"("waId");

-- CreateIndex
CREATE INDEX "WhatsappContact_lastMessageAt_idx" ON "WhatsappContact"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_messageSid_key" ON "WhatsappMessage"("messageSid");

-- CreateIndex
CREATE INDEX "WhatsappMessage_contactId_createdAt_idx" ON "WhatsappMessage"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappListMember_contactId_idx" ON "WhatsappListMember"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCampaignRecipient_messageId_key" ON "WhatsappCampaignRecipient"("messageId");

-- CreateIndex
CREATE INDEX "WhatsappCampaignRecipient_campaignId_status_idx" ON "WhatsappCampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCampaignRecipient_campaignId_contactId_key" ON "WhatsappCampaignRecipient"("campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_whatsappMessageId_key" ON "NotificationLog"("whatsappMessageId");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_whatsappMessageId_fkey" FOREIGN KEY ("whatsappMessageId") REFERENCES "WhatsappMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsappContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappListMember" ADD CONSTRAINT "WhatsappListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "WhatsappList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappListMember" ADD CONSTRAINT "WhatsappListMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsappContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCampaign" ADD CONSTRAINT "WhatsappCampaign_listId_fkey" FOREIGN KEY ("listId") REFERENCES "WhatsappList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCampaign" ADD CONSTRAINT "WhatsappCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCampaignRecipient" ADD CONSTRAINT "WhatsappCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WhatsappCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCampaignRecipient" ADD CONSTRAINT "WhatsappCampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WhatsappContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCampaignRecipient" ADD CONSTRAINT "WhatsappCampaignRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsappMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

