-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Gem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "carat" REAL NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "clarity" TEXT NOT NULL,
    "cut" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "lab" TEXT NOT NULL,
    "reportNo" TEXT NOT NULL,
    "dimensions" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GemImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gemId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GemImage_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GemKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "GemKey_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gemId" TEXT NOT NULL,
    "lotNumber" INTEGER NOT NULL,
    "startingPrice" INTEGER NOT NULL,
    "reservePrice" INTEGER,
    "increment" INTEGER NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "currentPrice" INTEGER NOT NULL DEFAULT 0,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "leaderId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Auction_gemId_fkey" FOREIGN KEY ("gemId") REFERENCES "Gem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Auction_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutoBid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxAmount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutoBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AutoBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Watch" (
    "userId" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "auctionId"),
    CONSTRAINT "Watch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Watch_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GemKey_code_key" ON "GemKey"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_gemId_key" ON "Auction"("gemId");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_lotNumber_key" ON "Auction"("lotNumber");

-- CreateIndex
CREATE INDEX "Bid_auctionId_createdAt_idx" ON "Bid"("auctionId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoBid_auctionId_userId_key" ON "AutoBid"("auctionId", "userId");

