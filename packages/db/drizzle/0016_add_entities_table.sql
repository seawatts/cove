-- CreateTable
CREATE TABLE IF NOT EXISTS "entities" (
    "id" VARCHAR(128) NOT NULL,
    "deviceId" VARCHAR(128) NOT NULL,
    "key" INTEGER NOT NULL,
    "objectId" TEXT,
    "name" TEXT NOT NULL,
    "uniqueId" TEXT,
    "entityType" TEXT NOT NULL,
    "icon" TEXT,
    "deviceClass" TEXT,
    "unitOfMeasurement" TEXT,
    "minValue" REAL,
    "maxValue" REAL,
    "step" REAL,
    "supportsBrightness" BOOLEAN,
    "supportsColorTemp" BOOLEAN,
    "supportsRgb" BOOLEAN,
    "effects" JSONB,
    "disabled" BOOLEAN DEFAULT false,
    "currentValue" JSONB,
    "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "entities_deviceId_idx" ON "entities"("deviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "entities_entityType_idx" ON "entities"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "entities_deviceId_objectId_key" ON "entities"("deviceId", "objectId");

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
