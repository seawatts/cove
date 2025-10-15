-- Add WidgetPreferences table for storing user widget preferences
CREATE TABLE IF NOT EXISTS "widgetPreferences" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"userId" varchar(128) NOT NULL,
	"deviceId" varchar(128) NOT NULL,
	"sensorKey" varchar(128) NOT NULL,
	"widgetType" varchar(50) NOT NULL,
	"widgetConfig" json DEFAULT '{}'::json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "user_device_sensor_unique" UNIQUE("userId","deviceId","sensorKey")
);

-- Add foreign key to devices table
DO $$ BEGIN
 ALTER TABLE "widgetPreferences" ADD CONSTRAINT "widgetPreferences_deviceId_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

