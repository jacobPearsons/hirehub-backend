-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_bindings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "contextType" TEXT NOT NULL DEFAULT 'global',
    "contextId" TEXT,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "role_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "role_bindings_userId_idx" ON "role_bindings"("userId");

-- CreateIndex
CREATE INDEX "role_bindings_roleId_idx" ON "role_bindings"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_bindings_userId_roleId_contextType_contextId_key" ON "role_bindings"("userId", "roleId", "contextType", "contextId");

-- CreateIndex
CREATE INDEX "audit_events_actorId_idx" ON "audit_events"("actorId");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- CreateIndex
CREATE INDEX "audit_events_resource_resourceId_idx" ON "audit_events"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "role_bindings" ADD CONSTRAINT "role_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_bindings" ADD CONSTRAINT "role_bindings_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
